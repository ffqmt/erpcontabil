import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cria o cliente Supabase para o usuário final autenticado (User Client).
 * Lê os cookies de sessão da requisição HTTP do Next.js e utiliza a chave pública anon.
 * Sujeito estritamente às políticas de Row Level Security (RLS) do banco de dados.
 */
export async function createServerUserClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // O método setAll pode ser chamado de Server Components e gerar erros de cookies.
            // Ignorado conforme comportamento padrão do Next.js.
          }
        },
      },
    }
  )
}

/**
 * Cria o cliente Supabase administrativo com a chave privada service_role (Admin Client).
 * Ignora por completo a Row Level Security (RLS) do banco de dados.
 * USO RESTRITO: Apenas para rotinas internas de sistema, seeds, auditorias ou onde RLS
 * impeça justificadamente a operação de backend server-only.
 */
export function createServerAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Retorna o cliente Supabase adequado para operações comuns de usuário na aplicação.
 * 
 * - Em Produção: Retorna estritamente o cliente sujeito a RLS (User Client).
 * - Em Desenvolvimento Local: Se e somente se a flag BYPASS_RLS_IN_DEV=true estiver ativa no .env,
 *   faz fallback para o Admin Client para viabilizar testes sem sessão real de login, registrando
 *   um aviso explícito no console.
 */
export async function getClient() {
  const userClient = await createServerUserClient()

  // Se estiver em modo de desenvolvimento local com flag de bypass de RLS ativada
  const isDev = process.env.NODE_ENV === 'development'
  const isBypassEnabled = process.env.BYPASS_RLS_IN_DEV === 'true'

  if (isDev && isBypassEnabled) {
    try {
      // Se houver uma sessão ativa de usuário real no navegador (cookies), preferimos
      // usar o User Client para testar as políticas de RLS ativamente.
      const { data: { session } } = await userClient.auth.getSession()
      if (session) {
        return userClient
      }
    } catch {
      // Ignora erro ao tentar verificar sessão e cai no fallback administrativo
    }

    console.warn(
      '⚠️ SUPABASE BYPASS: RLS está sendo ignorada em desenvolvimento através de fallback administrativo (Admin Client).'
    )
    return createServerAdminClient()
  }

  return userClient
}

// =====================================================================================
// ALIASES DE COMPATIBILIDADE (Evitam quebrar builds existentes durante a refatoração)
// =====================================================================================
export async function createClient() {
  return createServerUserClient()
}

export function createAdminClient() {
  return createServerAdminClient()
}
