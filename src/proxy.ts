import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Proxy (anteriormente "middleware") — duas responsabilidades:
 * 1. Renovar o access_token do Supabase Auth quando ele expira, gravando os novos cookies
 *    na resposta antes do Next.js renderizar Server Components. Sem isso, getClient() em
 *    server.ts leria cookies expirados → role: anon → RLS bloqueia.
 * 2. (Etapa 29B — achado P1 #1 da auditoria E2E) Guarda de rota — Camada 1 (checagem
 *    otimista) de defesa: bloqueia navegação para rotas protegidas sem sessão válida,
 *    ANTES de qualquer Server Component renderizar a casca do app (sidebar/topbar/dados).
 *    Antes desta etapa, este arquivo só fazia (1) — após logout, uma rota protegida ainda
 *    carregava normalmente (com dados vazios, pois a RLS bloqueava as queries de um
 *    cliente sem sessão, mas a UX/defesa em profundidade estava fraca).
 *
 *    Esta é só a Camada 1. A Camada 2 ("perto dos dados") é `getCurrentContext()`
 *    (`src/lib/context/current-context.ts`), que valida a sessão de novo em todo Server
 *    Component/Server Action — o guia oficial de autenticação do Next.js recomenda
 *    explicitamente as duas camadas, já que checagens só em Proxy/layout não são
 *    confiáveis sozinhas com Partial Rendering (client-side navigation entre rotas já
 *    visitadas pode pular o Proxy em alguns casos de prefetch).
 *
 * Convenção "proxy.ts" é obrigatória no Next.js 16+ (anteriormente "middleware.ts").
 */

const LOGIN_PATH = '/login'
const APP_HOME_PATH = '/'
const PARTNERS_PATH = '/cadastros/parceiros'
const PUBLIC_PATHS = [LOGIN_PATH]
const PERF_WARNING_MS = 300

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isDevRuntime(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function getRequestedPath(request: NextRequest): string {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`
}

function getSafeNextPath(request: NextRequest): string {
  const next = request.nextUrl.searchParams.get('next')
  if (!next || !next.startsWith('/') || next.startsWith('//')) return APP_HOME_PATH
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`) || next.startsWith(`${LOGIN_PATH}/`)) {
    return APP_HOME_PATH
  }
  return next
}

function redirectPreservingCookies(url: URL, sourceResponse: NextResponse): NextResponse {
  const response = NextResponse.redirect(url)
  sourceResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
  return response
}

function warnPartnerRedirect(origin: string, targetPath: string, details: Record<string, unknown>) {
  if (isDevRuntime() && targetPath.startsWith(PARTNERS_PATH)) {
    console.warn(`[redirect-debug] origem ${origin} -> /cadastros/parceiros`, details)
  }
}

function warnProxyPerf(details: Record<string, unknown>) {
  if (isDevRuntime() && typeof details.totalMs === 'number' && details.totalMs >= PERF_WARNING_MS) {
    console.warn('[perf-debug] proxy', details)
  }
}

export async function proxy(request: NextRequest) {
  const proxyStartedAt = Date.now()
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() (não getSession()) para a decisão de redirect: valida o JWT contra o
  // servidor de Auth do Supabase em vez de só confiar no cookie local — é o que também
  // renova o token como efeito colateral (mesmo papel que getSession() cumpria antes),
  // então substituí a chamada em vez de manter as duas.
  const authStartedAt = Date.now()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const authMs = Date.now() - authStartedAt

  const { pathname } = request.nextUrl
  const totalMs = Date.now() - proxyStartedAt

  warnProxyPerf({ rota: pathname, authMs, totalMs, hasUser: Boolean(user) })

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = LOGIN_PATH
    loginUrl.search = ''
    loginUrl.searchParams.set('next', getRequestedPath(request))
    return redirectPreservingCookies(loginUrl, supabaseResponse)
  }

  if (user && pathname === LOGIN_PATH) {
    const targetPath = getSafeNextPath(request)
    const targetUrl = new URL(targetPath, request.url)
    warnPartnerRedirect('proxy-login-authenticated', targetUrl.pathname, {
      rota: pathname,
      motivo: 'login-com-sessao',
      next: targetPath,
      authMs,
      totalMs
    })
    return redirectPreservingCookies(targetUrl, supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Roda em toda rota exceto assets estáticos e /api (Route Handlers tratam a própria
     * autenticação — ver src/app/api/locations/municipalities/route.ts, que só expõe
     * dados públicos de referência geográfica sem informação sensível).
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
