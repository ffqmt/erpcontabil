# Auditoria Funcional E2E Completa — Etapa 29A

> **Follow-up (Etapa 29B, 2026-07-12)**: os 2 achados P1 registrados nesta auditoria foram
> corrigidos e reconfirmados no navegador — ver `docs/e2e-audit-etapa29b.md`. Resumo:
> P1 #1 (sem guarda de rota pós-logout) corrigido em `src/proxy.ts`; P1 #2 (identidade da
> sessão desacoplada) corrigido em `src/lib/context/current-context.ts`, agora derivada da
> sessão Supabase Auth real. A matriz e os achados abaixo continuam válidos como registro
> histórico do estado encontrado na Etapa 29A.

Auditoria end-to-end real (navegador automatizado, não leitura de código) do ERP Sela
Sistem, cobrindo autenticação, contexto global, plano de contas, lançamentos, bancos,
parceiros, relatórios e varredura de todas as rotas. Executada com login **real** do
usuário `fernandaqueiroz.mt@gmail.com` contra o banco de homologação conectado ao servidor
de desenvolvimento local.

## Metodologia e ressalva sobre a senha

O ambiente de execução do Claude Code não tem acesso direto a um browser interativo nem
permite que uma senha em texto puro passe por um comando de shell (o classificador de
segurança bloqueou a primeira tentativa, corretamente, citando a própria instrução do
usuário de não deixar credenciais em logs). Solução usada, acordada com a usuária: uma
janela **visível** do Chromium foi aberta via Playwright, a usuária digitou o e-mail/senha
diretamente nessa janela (a senha nunca passou por nenhuma ferramenta/comando deste
agente), e a sessão autenticada resultante foi reaproveitada (via `storageState`) para todo
o resto da auditoria automatizada. O arquivo de sessão (`auth-state.json`, continha apenas
tokens JWT, nunca a senha) foi apagado ao final dos testes.

**Recomendação de segurança**: como a senha de `fernandaqueiroz.mt@gmail.com` foi digitada
em texto puro no chat desta sessão em algum momento anterior, **recomenda-se fortemente
trocar essa senha** assim que esta auditoria for revisada, independentemente do cuidado
tomado a partir daqui.

## Veredito Final

# 🟡 APROVADO COM RESSALVAS

Todos os 6 fluxos que o critério de veredito definia como bloqueantes (login, contexto
empresa/competência, criar/editar conta contábil, lançamento simples/múltiplo) **passaram
após a correção aplicada nesta etapa**. As ressalvas são 2 achados reais (identidade do
usuário na topbar e ausência de guarda de rota pós-logout) que não impedem o uso do sistema
hoje mas precisam de correção numa próxima etapa dedicada.

---

## A) Matriz Completa de Auditoria

| Módulo | Rota | Ação | Status Inicial | Erro Encontrado | Causa Raiz | Correção Aplicada | Status Final |
|---|---|---|---|---|---|---|---|
| Autenticação | `/login` | Login real | 🟡 Não testado antes | — | — | — | ✅ OK — login real funcionou, redirecionou para `/cadastros/parceiros` |
| Autenticação | qualquer | Sessão persiste após reload | — | — | — | — | ✅ OK |
| Autenticação | qualquer (pós-logout) | Acessar rota protegida sem sessão | — | Página carregou normalmente em vez de redirecionar para `/login` | Não existe `middleware.ts` nem checagem de sessão nos Server Components de `(erp)/layout.tsx` — só RLS protege os *dados*, não a *rota* | Nenhuma (fora do escopo desta etapa — ver Pendências P1) | 🟡 **Falha funcional confirmada, não bloqueante pela RLS mas ruim de UX/segurança** |
| Autenticação | topbar (qualquer rota) | Identidade exibida | — | Topbar mostra "Desenvolvedor Demo / dev@contabil.model.com" mesmo logada como `fernandaqueiroz.mt@gmail.com` | `getCurrentContext()` lê `profileId`/`companyId`/`workspaceId` de cookies/env `DEV_*`, nunca da sessão Supabase Auth real — arquitetura herdada da Etapa 0, nunca migrada quando o login real foi implementado | Nenhuma (mudança arquitetural grande — ver Pendências P1) | 🟡 **Identidade errada exibida, mas RLS real usa a sessão certa por baixo** |
| Contexto Global | topbar | Empresa ativa visível | — | — | — | — | ✅ OK — "Transportadora Modelo Ltda" |
| Contexto Global | topbar | Troca de competência | — | — | — | — | ✅ OK — cookie `current_competence` gravado corretamente, UI atualizou |
| Contexto Global | topbar | Troca de empresa | N/A | — | Usuária só tem 1 empresa vinculada — switcher mostra texto fixo, não `<select>` (comportamento intencional do componente) | — | ⚪ Não testável neste ambiente (não é bug) |
| Plano de Contas | `/contabilidade/plano-contas` | Criar conta SINTÉTICA | 🔴 Reportado como falho pela usuária | — (passou no reteste) | Bug original provavelmente já corrigido na Etapa 28A (actions.ts não existia antes) | — | ✅ OK |
| Plano de Contas | `/contabilidade/plano-contas` | Criar conta ANALÍTICA filha | 🔴 Reportado como falho | — | idem acima | — | ✅ OK |
| Plano de Contas | `/contabilidade/plano-contas` | Editar conta | 🔴 Reportado como falho | — | idem acima | — | ✅ OK |
| Plano de Contas | `/contabilidade/plano-contas` | Inativar / Reativar | — | — | — | — | ✅ OK |
| Plano de Contas | `/contabilidade/plano-contas` | Persistência após reload | — | — | — | — | ✅ OK |
| Plano de Contas | `/contabilidade/plano-contas` | Busca/filtro | — | — | — | — | ✅ OK |
| Lançamentos | `/contabilidade/lancamentos` | Criar Partida Simples | 🔴 Reportado: "ID de conta inválido" nas 2 linhas | **Reproduzido**: payload real `{"accountId":"c0000000-0000-0000-0000-000000000101", ...}` rejeitado por `fieldErrors.lines: ["ID de conta inválido.", "ID de conta inválido."]` | **Zod v4 `.uuid()` exige nibble de versão `[1-8]` e variante `[89ab]` — os IDs "vanity" do seed (`c0000000-...-0101`, `88888888-...`) têm `0` nessas posições e falham a validação estrita, mesmo sendo UUIDs válidos para o Postgres** | Substituído `.uuid(` por `.guid(` (validador Zod v4 que aceita qualquer UUID bem-formado, sem exigir versão/variante) em **13 arquivos, 73 ocorrências** | ✅ **OK — confirmado no navegador após a correção** |
| Lançamentos | `/contabilidade/lancamentos` | Criar Partida Múltipla (balanceada) | 🔴 Mesma causa raiz do simples | Mesma causa | Mesma correção | Mesma correção | ✅ OK |
| Lançamentos | `/contabilidade/lancamentos` | Bloqueio de desbalanceado | — | — | — | — | ✅ OK — botão "Salvar Rascunho" fica desabilitado |
| Lançamentos | `/contabilidade/lancamentos` | Postar lançamento (DRAFT→POSTED) | — | Botão usa `window.confirm()` nativo — armadilha de teste (Playwright dismissa por padrão sem handler), não um bug do app | Confirmado como comportamento correto após registrar handler de diálogo | — | ✅ OK — nº oficial atribuído, status mudou para POSTED |
| Relatórios | `/contabilidade/diario` | Reflete lançamento postado | — | — | — | — | ✅ OK — "SMOKE-SIMPLES-001" apareceu após postar |
| Relatórios | `/contabilidade/balancete` | Reflete lançamento postado | — | — | — | — | ✅ OK — conta "Caixa Geral" aparece, sem alerta de desequilíbrio |
| Relatórios | `/contabilidade/dre` | Carrega | — | — | — | — | ✅ OK |
| Relatórios | `/contabilidade/balanco` | Carrega | — | — | — | — | ✅ OK |
| Bancos | `/cadastros/contas-bancarias/novo` | Select de conta contábil populado | — | — | — | — | ✅ OK — 28 opções |
| Bancos | `/cadastros/contas-bancarias/novo` | Criar conta bancária | 🔴 Reportado como falho | Mesma causa raiz do UUID (o `chartAccountId` selecionado é um ID vanity do seed) | Mesma causa raiz | Mesma correção (`.guid(`) | ✅ **OK — confirmado no navegador** |
| Parceiros | `/cadastros/parceiros/novo` | Criar parceiro | — | — | — | — | ✅ OK |
| Demais módulos | 36 rotas (ver lista abaixo) | Carregar sem erro/crash | — | — | — | — | ✅ OK — todas HTTP 200, sem `Application error`, sem erro de console |

## B) Lista de Rotas Testadas (36)

`/`, `/cadastros`, `/cadastros/parceiros`, `/cadastros/parceiros/novo`, `/cadastros/itens`,
`/cadastros/itens/novo`, `/cadastros/naturezas-fiscais`, `/cadastros/naturezas-fiscais/novo`,
`/cadastros/contas-bancarias`, `/cadastros/contas-bancarias/novo`, `/cadastros/municipios`,
`/contabilidade`, `/contabilidade/plano-contas`, `/contabilidade/lancamentos`,
`/contabilidade/diario`, `/contabilidade/balancete`, `/contabilidade/dre`,
`/contabilidade/balanco`, `/contabilidade/encerramento`, `/contabilidade/periodos`,
`/bancos`, `/bancos/importar`, `/bancos/extratos`, `/bancos/conciliacao`, `/fiscal`,
`/fiscal/documentos`, `/fiscal/documentos/novo`, `/fiscal/apuracoes`,
`/fiscal/apuracoes/nova`, `/obrigacoes`, `/obrigacoes/novo`, `/patrimonio`,
`/patrimonio/categorias`, `/patrimonio/bens`, `/patrimonio/bens/novo`,
`/patrimonio/depreciacoes`, `/patrimonio/depreciacoes/gerar`.

Todas retornaram HTTP 200, sem texto de erro de aplicação, sem erro de console JS. As
rotas de detalhe por UUID (`/patrimonio/bens/[id]`, `/fiscal/apuracoes/[id]`, etc.) não
foram varridas por não haver um ID conhecido de antemão sem antes criar o registro — não
testadas nesta rodada (pendência menor, ver seção D).

## C) Lista de Bugs Corrigidos

### Bug 1 (P0 — bloqueante): `.uuid()` do Zod v4 rejeita IDs "vanity" do seed

- **Descrição**: qualquer formulário que envia um ID vindo de um registro semeado
  (`seed_demo_*.sql`) para um campo validado com `z.string().uuid()` falha com "ID
  inválido", mesmo o ID sendo um UUID sintaticamente válido para o Postgres.
- **Causa raiz**: Zod v4 mudou `.uuid()` para exigir o formato RFC4122 estrito (nibble de
  versão `1-8`, nibble de variante `8/9/a/b`). Os UUIDs "vanity" usados em todos os seeds
  deste projeto (`88888888-8888-...`, `c0000000-0000-0000-0000-000000000101`,
  `99999999-9999-...`, etc. — escolhidos deliberadamente por legibilidade em dev) têm `0`
  nessas posições e não passam nessa validação mais estrita, embora o Postgres os aceite
  sem problema (o tipo `uuid` do Postgres não exige nenhuma versão/variante específica).
- **Arquivos alterados** (13, 73 ocorrências): `src/modules/accounting/journal/validations.ts`,
  `src/modules/accounting/accounts/validations.ts`, `src/modules/tax-assessments/validations.ts`,
  `src/modules/assets/validations.ts`, `src/modules/obligations/validations.ts`,
  `src/modules/fiscal/validations.ts`, `src/modules/banking/validations.ts`,
  `src/modules/registrations/partners/validations.ts`,
  `src/modules/registrations/bank-accounts/validations.ts`,
  `src/modules/registrations/fiscal-natures/validations.ts`,
  `src/modules/registrations/items/validations.ts`, `src/modules/accounting/closing/validations.ts`,
  `src/modules/accounting/periods/validations.ts`.
- **Correção**: substituição mecânica de `.uuid(` por `.guid(` — validador nativo do Zod v4
  que aceita qualquer UUID bem formado (8-4-4-4-12 hex) sem exigir versão/variante
  específica, mantendo a mesma assinatura (aceita mensagem de erro customizada) e
  continuando a rejeitar strings que não têm o formato de UUID.
- **Como foi testado**: reproduzido o erro original via browser real (payload/resposta
  capturados), aplicada a correção, `npm run build` limpo, e reteste completo no browser
  confirmando sucesso em: lançamento simples, lançamento múltiplo, conta bancária.

### Bug 2 (achado, não corrigido nesta etapa): ausência de guarda de rota pós-logout

- Ver linha da matriz acima e seção Pendências (P1).

### Bug 3 (achado, não corrigido nesta etapa): identidade errada na topbar

- Ver linha da matriz acima e seção Pendências (P1).

## D) Lista de Pendências

**P0 (bloqueante)**: nenhuma remanescente — o único P0 real encontrado (UUID) foi corrigido
e confirmado no navegador.

**P1 (importante)**:
1. **Ausência de guarda de sessão em nível de rota** (`middleware.ts` inexistente): após
   logout, uma rota protegida ainda carrega (com dados vazios, pois a RLS bloqueia as
   queries — não há vazamento de dados, mas a UX/segurança em profundidade está fraca).
   Corrigir exigiria criar `src/middleware.ts` verificando a sessão Supabase antes de
   servir qualquer rota de `(erp)`, redirecionando para `/login` se ausente — mudança
   arquitetural best-effort para uma etapa dedicada, não feita agora por estar fora do
   escopo "não avançar para novas features" desta auditoria.
2. **`getCurrentContext()` nunca reflete o usuário realmente autenticado**: sempre lê
   `profileId`/`companyId`/`workspaceId` de cookies (nunca escritos por nenhum login real)
   ou de variáveis `DEV_*`, nunca da sessão Supabase Auth. Hoje isso "funciona" porque o
   perfil real da usuária de teste parece estar vinculado à mesma empresa do
   `DEV_COMPANY_ID` — mas é coincidência de dados de teste, não uma garantia arquitetural.
   Qualquer segundo usuário real com vínculo diferente veria dados errados ou RLS bloqueando
   tudo. Requer religar `getCurrentContext()` a `supabase.auth.getUser()` + lookup de
   `profiles`/`company_users` reais — mudança grande, não feita nesta etapa.
3. Rotas de detalhe por UUID (`/patrimonio/bens/[id]`, `/fiscal/apuracoes/[id]`,
   `/fiscal/documentos/[id]`, `/obrigacoes/[id]/editar`) não foram varridas por falta de um
   ID conhecido de antemão — recomenda-se um passe futuro que primeiro cria um registro e
   depois visita sua página de detalhe.

**P2 (melhoria)**:
1. Seletor de "Centro de Custo" ainda ausente do lançamento múltiplo (documentado desde a
   Etapa 28A — não existe módulo de Centros de Custo na aplicação).
2. Dados de teste `QA-`/`SMOKE-` ficaram no banco de desenvolvimento (conta contábil "QA
   Analitica Smoke EDITADA", conta bancária "QA Banco Smoke", parceiro "QA Parceiro Smoke",
   lançamentos SMOKE-SIMPLES-001/SMOKE-MULTI-001, um deles já POSTED) — não foram
   removidos fisicamente (RLS bloqueia DELETE de propósito). Recomenda-se inativar
   manualmente se incomodar a demonstração, mas não há risco técnico em mantê-los.

**P3 (backlog)**:
1. Investigar por que `/cadastros/itens/novo` levou ~7.7s no primeiro carregamento da
   sessão (não reproduzido de forma limpa no reteste devido a uma colisão de execução
   concorrente de scripts — ver observação em Performance). Suspeita: compilação
   sob-demanda do Turbopack em modo dev para uma rota ainda não visitada nesta sessão do
   servidor — não é necessariamente um problema em produção (build já pré-compila tudo).

## E) Evidências E2E

- **Login**: real, via janela Chromium visível — usuária digitou as credenciais, sessão
  capturada e reaproveitada para o resto da auditoria.
- **Sessão persistente**: confirmado após reload de página.
- **Troca de competência**: cookie `current_competence=2025-03-01` confirmado gravado após
  interação real com o seletor.
- **Plano de Contas**: conta sintética `9.9 — QA Sintetica Smoke` e filha analítica
  `9.9.01 — QA Analitica Smoke` criadas, editada para "EDITADA", inativada e reativada,
  todas confirmadas via tela + persistência pós-reload.
- **Lançamento Simples**: `SMOKE-SIMPLES-001`, débito Caixa Geral / crédito Banco Conta
  Movimento, R$ 150,00 — criado como DRAFT, depois **postado** (nº 1 atribuído), aparece no
  Diário e no Balancete.
- **Lançamento Múltiplo**: `SMOKE-MULTI-001` balanceado criado com sucesso; tentativa
  desbalanceada corretamente bloqueada (botão desabilitado antes mesmo de chegar ao
  servidor).
- **Conta Bancária**: "QA Banco Smoke" vinculada a conta contábil analítica ativa, criada
  com sucesso.
- **Parceiro**: "QA Parceiro Smoke" (papel Cliente) criado com sucesso.
- **Relatórios**: Diário e Balancete confirmados refletindo o lançamento postado.
- **36 rotas**: todas carregam, HTTP 200, zero erros de console JS capturados.
- **Logout**: redireciona corretamente para `/login`; porém rota protegida acessada
  diretamente depois NÃO redireciona (achado P1).

## F) Performance

Medido via `page.goto(..., waitUntil: 'domcontentloaded')` real, servidor Next.js 16.2.10
Turbopack em modo dev (não produção — números não comparáveis a produção real).

- **Rápidas (<1.2s)**: 18 rotas, incluindo `/`, `/cadastros/parceiros`,
  `/contabilidade/plano-contas`, `/contabilidade/lancamentos`, `/contabilidade/diario`,
  `/contabilidade/dre`, `/bancos`, `/bancos/conciliacao`, `/fiscal/documentos`,
  `/patrimonio`.
- **Aceitáveis (1.2–3s)**: 17 rotas, incluindo `/contabilidade` (2.87s),
  `/contabilidade/balanco` (2.75s), `/contabilidade/encerramento` (2.45s),
  `/bancos/importar`, `/obrigacoes`, `/patrimonio/depreciacoes/gerar`.
- **Lenta**: `/cadastros/itens/novo` — 7.7s numa única medição (não reproduzida
  consistentemente; ver P3). Nenhuma outra rota lenta ou travando.
- **Gargalos identificados e já corrigidos em etapa anterior (28A)**: paralelização das 4
  queries sequenciais do `(erp)/layout.tsx` com `Promise.all` — esse fix já estava em
  produção durante esta auditoria, contribuindo para os tempos "rápida"/"aceitável" acima
  em vez de piores.
- **Pendência de performance**: nenhum gargalo novo e reproduzível identificado nesta
  rodada que justifique correção imediata.

## G) Resultado do Build

`npm run build` — limpo antes E depois da correção do bug de UUID. 49 rotas geradas, sem
erros de TypeScript, sem erros de lint bloqueantes de build.
