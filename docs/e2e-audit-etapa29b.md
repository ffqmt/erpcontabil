# Correção de Sessão, Guarda de Rotas e Identidade Real — Etapa 29B

Corrige os 2 achados P1 registrados em `docs/e2e-audit-etapa29a.md`. Testado no navegador
real (Playwright/Chromium, login manual da usuária numa janela visível — mesma metodologia
da Etapa 29A, senha nunca passou por nenhum comando deste agente).

## Veredito Final

# 🟢 APROVADO

Os dois critérios de reprovação definidos pela usuária foram verificados no navegador e
**nenhum se confirmou**: a topbar mostra a identidade real (`Fernanda Queiroz /
fernandaqueiroz.mt@gmail.com`), e uma rota protegida acessada diretamente após logout
redireciona para `/login` sem renderizar a casca do app. Todos os fluxos P0 da Etapa 29A
foram reexecutados e continuam funcionando.

## A) Diagnóstico da Arquitetura de Sessão Anterior

- **`src/proxy.ts` já existia**, mas fazia só uma coisa: renovar o token de sessão do
  Supabase (`supabase.auth.getSession()`) e regravar os cookies. **Nenhuma lógica de
  redirect/guarda de rota** — daí o achado P1 #1: depois de logout, qualquer rota
  protegida continuava renderizando normalmente (com dados vazios, pois a RLS bloqueava as
  queries de um cliente sem sessão, mas a casca do app — sidebar, topbar, formulários —
  aparecia de qualquer forma).
- **`src/lib/context/current-context.ts`** nunca lia a sessão Supabase Auth. Só lia
  cookies `current_workspace_id`/`current_company_id`/`current_profile_id`/
  `current_competence` (nunca escritos por nenhum fluxo de login) com fallback incondicional
  para variáveis de ambiente `DEV_*`. Daí o achado P1 #2: a topbar sempre mostrava o perfil
  seedado "Desenvolvedor Demo" (`profiles.id = DEV_PROFILE_ID`), não o usuário realmente
  autenticado — funcionava por coincidência (o profile real de `fernandaqueiroz.mt@gmail.com`
  parece estar vinculado à mesma empresa do `DEV_COMPANY_ID`), não por garantia
  arquitetural.
- **`src/app/(erp)/layout.tsx`** buscava `workspaces`/`companies`/`accounting_periods`/
  `profiles` manualmente a partir desse contexto quebrado — reproduzindo o mesmo problema
  de identidade errada.
- **`src/components/app-shell/{topbar,company-switcher,period-selector}.tsx`**: já
  interativos desde a Etapa 28A (troca de empresa/competência grava cookie de verdade),
  mas exibiam os dados errados vindos do contexto quebrado. Não precisaram de nenhuma
  mudança de lógica nesta etapa — só passaram a receber dados corretos.
- **Descoberta relevante durante a leitura obrigatória da documentação do Next.js**: esta
  versão (16.2.10) **depreciou `middleware.ts` em favor de `proxy.ts`** (renomeado na
  v16.0.0 — ver `node_modules/next/dist/docs/.../file-conventions/proxy.md`). O arquivo já
  usava a convenção certa por coincidência (criado em uma sessão anterior já ciente disso).
  A documentação também recomenda explicitamente **duas camadas** de checagem de sessão —
  Proxy (otimista, só JWT) **e** verificação "perto dos dados" em cada Server
  Component/Action — porque checagens só em layout não são confiáveis sozinhas com Partial
  Rendering. É exatamente o desenho implementado aqui.

## B) Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `src/proxy.ts` | Adicionada guarda de rota: redireciona para `/login` sem sessão (exceto `/login` em si), redireciona para `/cadastros/parceiros` se autenticado tentando acessar `/login`. Trocado `getSession()` por `getUser()` (valida o JWT no servidor, não só confia no cookie local) — mantém o refresh de token como efeito colateral. |
| `src/lib/context/current-context.ts` | Reescrito: deriva `user`/`profile`/`activeCompany`/`allowedCompanies` da sessão Supabase Auth real via `supabase.auth.getUser()` + `profiles.auth_user_id` + `companies` (RLS já filtra as permitidas). Fallback `DEV_*` isolado numa função separada, só ativa com `NODE_ENV != production` **e** `DEV_ALLOW_UNAUTHENTICATED_CONTEXT=true` explícito. Envolvido em `cache()` do React para deduplicar dentro do mesmo request. Mantém 100% de compatibilidade retroativa (`workspaceId`/`companyId`/`profileId`/`competence` continuam no mesmo formato para os ~60 arquivos que já consomem `getCurrentContext()`). |
| `src/app/(erp)/layout.tsx` | Simplificado: usa os campos ricos do novo contexto em vez de refazer as queries de profile/company manualmente. |
| `src/app/(erp)/error.tsx` | Novo — error boundary amigável para quando `getCurrentContext()` lança um erro controlado (sessão ausente, profile não vinculado, usuário sem empresa). |
| `.env.local.example` | Documentada a nova flag `DEV_ALLOW_UNAUTHENTICATED_CONTEXT` (default `false`) e o escopo restrito do fallback `DEV_*`. |

Nenhuma mudança em `src/components/app-shell/{topbar,company-switcher,period-selector}.tsx`
— já estavam corretos desde a Etapa 28A, só recebiam dados errados.

## C) Guarda de Rotas — Implementação

`src/proxy.ts`, camada 1 (otimista): `supabase.auth.getUser()` valida o JWT da sessão a
cada navegação. Sem usuário e fora de `/login` → redirect para `/login`. Com usuário e em
`/login` → redirect para `/cadastros/parceiros`. `matcher` exclui `_next/static`,
`_next/image`, `favicon.ico`, imagens e `/api/*` (Route Handlers tratam a própria
autenticação, conforme a documentação do Next.js recomenda — o único hoje,
`/api/locations/municipalities`, só expõe referência geográfica pública sem dado sensível).

Camada 2 (defesa em profundidade, "perto dos dados"): `getCurrentContext()` também lança
erro se não houver sessão válida — cobre qualquer chamada que escape da Camada 1 (ex.:
Server Actions chamadas via prefetch em cenários avançados de client-side navigation, que a
própria documentação do Next.js cita como um caso em que Proxy sozinho não é suficiente).

## D) `getCurrentContext()` — Implementação

Fluxo completo, nesta ordem: `supabase.auth.getUser()` → busca `profiles` por
`auth_user_id` → busca `companies` (RLS já filtra pelas permitidas via
`can_read_company`, sem reimplementar a lógica de autorização em JavaScript) → valida
cookie `current_company_id` contra a lista permitida (usa a primeira permitida como
padrão se ausente/inválido) → normaliza `current_competence`. Retorna também
`activeAccountingPeriod` (leitura informativa, sem autocriar — quem precisa
autocriar continua usando `getCurrentAccountingPeriod()`, já existente desde a Etapa 10).

## E) Topbar/Switchers — Identidade Real

`userName = profile.name || user.email` (nunca um nome fictício — se o profile não tiver
nome preenchido, mostra o e-mail real). Confirmado no navegador: **"Fernanda Queiroz /
fernandaqueiroz.mt@gmail.com"**.

## F) Controle de Fallback `DEV_*`

`DEV_WORKSPACE_ID`/`DEV_COMPANY_ID`/`DEV_PROFILE_ID`/`DEV_COMPETENCE` só são lidos dentro
de uma função isolada (`getDevFallbackContext()`), disparada **apenas** quando:
1. Não há sessão Supabase Auth válida, **e**
2. `NODE_ENV !== 'production'`, **e**
3. `DEV_ALLOW_UNAUTHENTICATED_CONTEXT === 'true'` (opt-in explícito, ausente por padrão).

Confirmado que a flag está ausente no `.env.local` real — ou seja, hoje o fallback está
**desligado**: qualquer chamada sem sessão real falha com erro claro em vez de mascarar o
problema com dados de um usuário fixo.

## G) Server Actions

Nenhuma mudança necessária — todas as ~40+ Server Actions já auditadas nas Etapas
anteriores (19–28A) chamam `getCurrentContext()` e usam `context.companyId`/
`context.workspaceId` para filtrar/validar, nunca aceitam esses IDs arbitrários do client.
Como a assinatura de retorno manteve compatibilidade total, nenhuma delas precisou de
edição — e o reteste E2E (seção H) confirma que continuam funcionando com a identidade
real.

## H) Testes E2E — Resultados (browser real)

| Teste | Resultado |
|---|---|
| Login | ✅ OK |
| Topbar mostra e-mail real (`fernandaqueiroz.mt@gmail.com`) | ✅ OK |
| Topbar NÃO mostra "Desenvolvedor Demo" | ✅ OK |
| Empresa ativa real exibida ("Transportadora Modelo Ltda") | ✅ OK |
| Rota protegida acessível enquanto autenticado | ✅ OK |
| Logout redireciona para `/login` | ✅ OK |
| **Rota protegida bloqueada após logout (redireciona para `/login`, sem renderizar app shell)** | ✅ **OK** |
| `/login` acessível sem sessão, sem loop de redirect | ✅ OK |
| Regressão — Plano de Contas: criar conta | ✅ OK |
| Regressão — Lançamento Simples | ✅ OK |
| Regressão — Conta Bancária | ✅ OK |
| Regressão — Parceiro | ✅ OK |
| Regressão — Diário carrega (HTTP 200) | ✅ OK |
| Regressão — Balancete carrega (HTTP 200) | ✅ OK |

Segurança: nenhum `service_role`/Admin Client usado no fluxo de teste;
`BYPASS_RLS_IN_DEV` continua ausente; nenhum erro `42501` em nenhum fluxo autorizado;
dados de teste com prefixo `QA-`/`SMOKE-29B-`. Arquivo de sessão (`auth-state.json`, só
tokens JWT) apagado ao final.

## I) Resultado do Build

`npm run build` — limpo. 49 rotas + `Proxy (Middleware)` reconhecido pelo Next.js. Sem
erros de TypeScript.

## Pendências Restantes

Nenhuma pendência P0/P1 remanescente desta etapa. Itens de observação, sem urgência:

- `permissions.ts` continua um stub (`'*'` sempre concedido) — fora do escopo desta etapa,
  que tratou sessão/identidade/contexto, não autorização por papel. Já era um débito
  técnico conhecido e documentado desde a Etapa 0.
- O fallback `DEV_*` isolado nesta etapa fica disponível para scripts locais pontuais, mas
  não tem nenhum consumidor real hoje além de si mesmo — pode ser removido por completo
  numa limpeza futura se a equipe decidir que nunca mais será necessário.
