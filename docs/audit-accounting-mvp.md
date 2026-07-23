# Auditoria Técnica e Contábil — MVP Contábil (Etapa 14)

Data: 2026-07-11
Escopo: schema, RLS, contexto de tenant, permissões, App Shell, Plano de Contas, Lançamentos Manuais, Postagem, Estorno, Períodos Contábeis, Livro Diário, Balancete, DRE, Balanço Patrimonial, Impressão, Exportação CSV, Encerramento de Resultado, Dashboard Contábil.

## 1. Visão Geral

O MVP Contábil está funcionalmente completo até a Etapa 13 (Encerramento de Resultado), com uma Etapa 14 (Dashboard Contábil) que havia sido implementada por uma sessão anterior e ficou interrompida com o build quebrado e sem entrada no `DEVELOPMENT_LOG.md`. Esta auditoria finalizou essa etapa e revisou o conjunto completo do módulo contábil em busca de inconsistências de arquitetura Next.js/Supabase e de regras contábeis (partidas dobradas, encerramento, períodos).

A arquitetura geral está sólida: Server Actions com validação Zod, checagem de período em toda escrita, trigger de banco para balanceamento e numeração, separação de Server/Client Components respeitada, e um padrão de fallback Anon→Admin Client documentado desde a Etapa 0 como débito técnico temporário (ausência de sessão real de Auth em modo dev, futura substituição pelo Francoos).

Foi encontrado **um bug contábil crítico real**: a DRE não excluía o próprio lançamento de encerramento da apuração da competência, o que zerava o resultado histórico após o encerramento — exatamente o risco que o roteiro de auditoria pedia para verificar. Foi corrigido nesta etapa.

## 2. Lista de Arquivos Analisados

**Documentação/config**: `README.md`, `DEVELOPMENT_LOG.md`, `AGENTS.md`, `CLAUDE.md`, `package.json`, `db/README.md`, `db/seed/seed_demo_accounting.sql`.

**Contexto/infra**: `src/lib/context/current-context.ts`, `src/lib/supabase/{server,client}.ts`, `src/lib/permissions/permissions.ts`, `src/lib/csv/export-csv.ts`.

**App Shell**: `src/components/app-shell/{app-shell,sidebar,topbar,company-switcher,period-selector}.tsx`.

**Relatórios**: `src/components/reports/{report-header,report-footer,print-button,export-csv-button}.tsx`.

**Módulo Accounting** (`src/modules/accounting/`):
- `accounts/queries.ts`
- `journal/{queries,actions}.ts`
- `periods/actions.ts`
- `closing/{queries,actions}.ts`
- `dre/{types,queries,dre-calculator,export}.ts`
- `balance-sheet/{types,queries,balance-sheet-calculator,export}.ts`
- `trial-balance/queries.ts`
- `dashboard/{types,queries,dashboard-utils}.ts` e `components/{accounting-dashboard,accounting-status-card,accounting-alerts,accounting-kpi-card,recent-journal-entries,accounting-shortcuts}.tsx`

**Rotas**: `src/app/(erp)/page.tsx`, `src/app/(erp)/contabilidade/page.tsx`.

**Build**: `npm run build` executado 2x (antes e depois das correções).

## 3. Achados por Severidade

### CRÍTICO

**C1 — DRE incluía o lançamento de encerramento na apuração (CORRIGIDO)**
`src/modules/accounting/dre/queries.ts`, função `getDreRawData`. A query de lançamentos `POSTED` da competência não filtrava `origin != 'RESULT_CLOSING'`. As pernas de zeramento do encerramento tocam exatamente as mesmas contas de RECEITA/DEDUÇÃO/CUSTO/DESPESA que a DRE soma — então, após o encerramento, a DRE daquela competência passava a mostrar o resultado anulado (próximo de zero) em vez do lucro/prejuízo real apurado. Isso é o cenário que o roteiro de auditoria pediu para verificar explicitamente. Corrigido com `.neq('origin', 'RESULT_CLOSING')`.

**C2 — Build quebrado por incompatibilidade de nomes de campo (CORRIGIDO)**
`src/modules/accounting/dashboard/components/accounting-dashboard.tsx` referenciava `dre.deductions`, `dre.costs`, `dre.expenses`, que não existem em `DreReportData` (os nomes reais são `deductionsTotal`, `costsTotal`, `expensesTotal`). Impedia `npm run build`. Corrigido nas 3 ocorrências (linhas ~49, ~87, ~94).

### ALTO

**A1 — `src/lib/supabase/server.ts` sem guarda `server-only` (não corrigido — recomendação)**
O arquivo exporta `createAdminClient()` (chave `service_role`) sem o import `import 'server-only'` no topo. Hoje nenhum Client Component (`'use client'`) importa esse arquivo — confirmado por busca cruzada em todos os `'use client'` do projeto — então não há vazamento ativo da chave para o navegador. Mas nada no build impede que isso aconteça por engano no futuro (ex.: um novo componente client importar `createAdminClient` para "resolver" um erro de RLS rapidamente). É a defesa recomendada oficialmente pelo Next.js para exatamente este cenário. **Não apliquei porque envolve instalar uma dependência nova (`server-only`) e as instruções pediram para não instalar dependências sem justificar explicitamente com o usuário** — mas deixo como recomendação de prioridade alta para a próxima etapa (é uma mudança de ~2 linhas, zero risco). **STATUS (Etapa 15): ainda não resolvido.** Confirmado que `node_modules/server-only` não está instalado; a Etapa 15 tinha instrução explícita de não instalar dependências novas sem necessidade extrema, então o achado permanece como recomendação pendente de decisão do usuário.

### MÉDIO

**M1 — Padrão "Anon Client → fallback Admin Client" duplicado em ~15 arquivos**
Presente em praticamente toda query/action (`accounts/queries.ts`, `journal/*`, `dre/queries.ts`, `balance-sheet/queries.ts`, `trial-balance/queries.ts`, `closing/*`, `periods/actions.ts`, `report-header.tsx`). Como não existe sessão real de Supabase Auth em modo dev, o caminho Anon sempre falha por RLS e cai para o Admin Client — ou seja, hoje **100% do tráfego de leitura/escrita roda com `service_role`, contornando RLS por completo**. Isso já está documentado desde a Etapa 0 como decisão consciente e temporária, então não é uma descoberta nova, mas o volume de duplicação (a mesma lógica de try/catch copiada 15 vezes) é um risco de manutenção: qualquer ajuste futuro (ex. logging, telemetria, timeout) precisa ser replicado em 15 lugares. Recomendo consolidar em um helper único `getDbClient()` quando a integração real de Auth/Francoos começar — não faz sentido abstrair antes disso, pois a lógica ainda pode mudar de forma at ainda desconhecida. **STATUS (Etapa 15): não resolvido — o módulo novo de Cadastros Base repete o mesmo padrão (deliberadamente, por consistência com o restante do código), então o volume de duplicação cresceu (~15 → ~20 arquivos). Continua sendo a recomendação certa esperar a integração Francoos antes de abstrair.**

**M2 — `db/README.md` não documenta `DEV_ESTABLISHMENT_ID`** — **RESOLVIDO na Etapa 15.** Variável adicionada ao exemplo de `.env.local` em `db/README.md`, com nota explicando que ainda não é lida por `getCurrentContext()`.

### BAIXO

**B1 — `getCurrentContext()` cai para placeholder string não-UUID em último caso** — **RESOLVIDO na Etapa 15.** Fallback substituído por `throw` explícito com mensagem orientando a configurar `DEV_WORKSPACE_ID`/`DEV_COMPANY_ID`/`DEV_PROFILE_ID`/`DEV_ESTABLISHMENT_ID`/`DEV_COMPETENCE` no `.env.local`.

**B2 — Link "Novo Lançamento" no atalho do dashboard não é fisicamente desabilitado quando o período está fechado** — **RESOLVIDO na Etapa 15.** Quando desabilitado, o atalho agora renderiza como bloco inerte (sem `href`, `aria-disabled`, `cursor-not-allowed`) em vez de `<Link>`.

### SUGESTÃO

**S1** — `README.md` na raiz ainda é o boilerplate padrão do `create-next-app`, nunca customizado. — **RESOLVIDO na Etapa 15.** Substituído por descrição real do projeto, stack e ordem de aplicação dos scripts SQL.

**S2** — `accounting-dashboard.tsx` recalcula `marginPct` manualmente (`dre.netProfit / netRevenue * 100`) quando `DreReportData` já expõe `dre.netMargin` pronto. Redundante, não incorreto (os dois cálculos são equivalentes), mas poderia usar o campo já calculado.

## 4. Correções Aplicadas Nesta Etapa

1. `src/modules/accounting/dashboard/components/accounting-dashboard.tsx` — corrigidos os 3 usos de campos inexistentes (`deductions`→`deductionsTotal`, `costs`→`costsTotal`, `expenses`→`expensesTotal`), restaurando o build.
2. `src/modules/accounting/dre/queries.ts` — `getDreRawData` agora exclui lançamentos de origem `RESULT_CLOSING` (`.neq('origin', 'RESULT_CLOSING')`), preservando o resultado histórico da DRE após o encerramento.
3. `DEVELOPMENT_LOG.md` — adicionada a Etapa 14 documentando o Dashboard e esta auditoria.
4. Este documento (`docs/audit-accounting-mvp.md`) criado.

Nenhuma outra alteração de código foi feita. Os achados A1, M1, M2, B1, B2, S1, S2 ficam registrados como pendências para decisão explícita do usuário (alguns envolvem trade-offs — ex. A1 pede uma nova dependência — que preferi não decidir sozinho).

## 5. Resultado do `npm run build`

Limpo nas duas execuções (antes de C1/C2 o build falhava com o erro de tipo de C2; depois das correções, `npm run build` completa sem erros de TypeScript, com as 10 rotas do App Router geradas corretamente, `/` e `/contabilidade/*` como dinâmicas e `/_not-found` estática).

## 6. Decisões Contábeis Validadas

- **REOPENED tratado como aberto para escrita**: confirmado em `journal/actions.ts` (criar rascunho, postar, estornar), `closing/actions.ts` (encerrar) e `periods/actions.ts` (fechar/reabrir) — todos usam `status !== 'OPEN' && status !== 'REOPENED'` como condição de bloqueio, nunca tratando `REOPENED` como fechado.
- **Balancete inclui o lançamento de encerramento**: correto — o Balancete deve refletir o razão real, incluindo o zeramento físico.
- **Livro Diário inclui o lançamento de encerramento e de estorno**: correto — é o registro cronológico oficial, não deve ocultar nada que seja `POSTED`.
- **Balanço Patrimonial não duplica o resultado após o encerramento físico**: já resolvido na Etapa 13 — `balance-sheet-calculator.ts` zera o `netPeriodResult` calculado quando `hasClosing` é verdadeiro, evitando dupla contagem (o resultado já está fisicamente na conta de PL).
- **Encerramento**: identifica a conta de PL por pontuação de nome, bloqueia com rascunhos pendentes, bloqueia se já houver encerramento ativo, valida que a conta de destino é EQUITY/analítica/ativa, valida Débito=Crédito em centavos antes de publicar, insere como DRAFT→POSTED (mesmo padrão seguro usado em outros lançamentos), e pode ser estornado livremente reabrindo a possibilidade de novo encerramento.
- **DRE agora exclui corretamente o lançamento de encerramento** (após a correção C1).

## 7. Riscos Ainda Pendentes para Produção

1. **RLS efetivamente bypassada em 100% do tráfego atual** (via fallback para Admin Client) — aceitável em dev, mas é um lembrete de que a migração para sessão real de Supabase Auth/Francoos é pré-requisito para produção, não um "nice to have".
2. **Ausência da guarda `server-only`** em `src/lib/supabase/server.ts` (achado A1) — baixo risco hoje, mas deve ser resolvido antes de qualquer PR que mexa em Client Components próximos a dados sensíveis.
3. **Nenhum teste automatizado** cobrindo as regras contábeis (balanceamento, bloqueio de período, exclusão do encerramento na DRE) — o bug C1 só foi encontrado por leitura manual de código; um teste de integração simples (seed → fechar competência → conferir DRE do mês fechado ainda bate com o resultado pré-encerramento) evitaria regressões futuras.
4. **Permissões são um stub proposital** (`permissions.ts` sempre concede `'*'`) — funcionando como documentado, mas é um lembrete vivo de que nenhuma ação crítica está de fato protegida por papel de usuário até a integração Francoos.

## 8. Estado Atual do MVP Contábil

Completo e funcional ponta a ponta para o ciclo mensal de uma empresa: Plano de Contas → Lançamento Manual (rascunho) → Postagem → Livro Diário → Balancete → DRE → Balanço Patrimonial → Encerramento de Resultado → Fechamento/Reabertura de Período → Dashboard consolidado. Estorno funciona em qualquer lançamento `POSTED` (incluindo o de encerramento). Impressão e exportação CSV cobrem todos os relatórios. Build limpo. Nenhum bloqueador conhecido restante para uso em ambiente de desenvolvimento/demonstração.

## 9. Roadmap Macro Atualizado

Ordem proposta, considerando dependências reais entre módulos (não a ordem de "importância" isolada):

1. **Cadastros Base compartilhados** (Pessoas/Parceiros, Clientes, Fornecedores, Produtos/Serviços, Municípios/UF, Naturezas fiscais básicas, Contas bancárias) — pré-requisito de todos os módulos seguintes; hoje só existe uma tabela `partners` mínima usada no seed, sem CRUD real.
2. **Financeiro** (Contas a Pagar/Receber, Conciliação Bancária) — depende de Cadastros (Pessoas/Parceiros, Contas bancárias) e já tem contas de plano prontas (Caixa, Bancos, Clientes, Fornecedores) esperando integração.
3. **Fiscal/Tributário** (Notas fiscais, apuração de impostos) — depende de Cadastros (Clientes/Fornecedores/Produtos/Naturezas fiscais) mais fortemente que o Financeiro, e também se beneficia de o Financeiro já existir (pagamento/recebimento de tributos apurados).
4. **Patrimônio** (Ativo imobilizado, depreciação) — depende do Plano de Contas (já existe) e de Centros de Custo (já existe); pode avançar em paralelo ao Fiscal, mas depois do Financeiro para tratar baixas/aquisições via contas a pagar.
5. **Departamento Pessoal/Folha** — depende de Cadastros (Pessoas como colaboradores) e beneficia-se do Financeiro (pagamento de folha) e Contábil (lançamento automático dos encargos); mais isolado dos demais, pode ser adiado sem bloquear o restante.
6. **Obrigações/Exportações** (SPED, guias, declarações) — depende de Fiscal e Contábil estarem maduros e consistentes; naturalmente o penúltimo módulo.
7. **Integração Francoos/RLS final** — tecnicamente pode começar em paralelo a qualquer momento, mas faz mais sentido consolidar depois que o modelo de dados dos módulos de negócio estabilizar (menos retrabalho de policies).
8. **Auditoria/Logs** — melhor implementado depois que as Server Actions dos demais módulos existirem (para instrumentar todas de uma vez).
9. **Dashboards executivos** — consolidação final, depende de todos os módulos de dados terem histórico real.

### Sobre a preferência do usuário (Cadastros Base como próximo passo)

Confirmo que **Cadastros Base é de fato a ordem correta segundo o próprio desenho do roadmap** — é pré-requisito estrutural de Fiscal, Financeiro e Folha simultaneamente, e hoje o sistema não tem nada além do `partners` mínimo do seed. Não há motivo para propor outra ordem.

## 10. Próximo Prompt/Etapa Recomendada

Recomendo abrir a Etapa 15 com escopo: **CRUD de Cadastros Base** — schema (`partners` já existe parcialmente; avaliar se basta estendê-lo com `partner_type` mais rico ou se vale separar `customers`/`suppliers` como views/queries filtradas do mesmo `partners`), telas de listagem/criação/edição para Pessoas/Parceiros (Clientes e Fornecedores), Produtos/Serviços (tabela nova), Municípios/UF (provavelmente uma tabela de referência estática/seed, não CRUD do usuário), Naturezas Fiscais básicas (tabela nova, simples), e uma avaliação sobre se Contas Bancárias deve nascer aqui ou esperar o módulo Financeiro (recomendo nascer aqui, já que é cadastro puro sem lógica de conciliação). Sugiro pedir explicitamente para não modelar ainda nenhuma regra fiscal/tributária dentro dos Cadastros — apenas os campos estruturais necessários para os módulos futuros referenciarem.
