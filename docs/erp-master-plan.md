# Plano Mestre do ERP Sela Sistem

Documento vivo de referência. Criado na Etapa 16 (Consolidação) para reconciliar a trilha
funcional (módulos de negócio) com a trilha técnica (schema/RLS/testes) e servir de fonte
única de verdade sobre o que existe, o que falta e em que ordem. Atualize-o a cada etapa
relevante — não deixe que ele fique desatualizado como o `README.md` original ficou.

---

## 1. Visão Geral do ERP

Sela Sistem é um ERP modular multiempresa (workspace → empresas → estabelecimentos) para
escritórios de contabilidade, construído em Next.js App Router + Supabase/PostgreSQL. O
módulo Contábil é a base do sistema (livro diário, DRE, Balanço, encerramento de
resultado); os demais módulos de negócio (Fiscal, Financeiro, Patrimônio, Folha,
Obrigações) foram desenhados desde o schema original para se apoiarem nele — todo
documento fiscal, folha de pagamento, depreciação e conciliação bancária gera um
`journal_entry` no mesmo livro diário único.

O sistema roda hoje inteiramente em **modo de desenvolvimento com tenant fixo**: não há
sessão real de Supabase Auth, o contexto (workspace/empresa/perfil/competência ativos) vem
de variáveis `DEV_*`/cookies (`src/lib/context/current-context.ts`), e 100% das
leituras/escritas passam pelo Admin Client (`service_role`), contornando a RLS já escrita.
A integração de autenticação real ("Francoos") é um ponto de extensão planejado, mas ainda
não iniciado.

## 2. Stack Técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.2.10 (App Router, Turbopack) |
| UI | React 19.2.4, Tailwind CSS v4, lucide-react |
| Backend/Dados | Supabase (PostgreSQL + Auth, ainda não habilitado de fato) |
| Validação | Zod (Server Actions) |
| Sem framework de testes | Nenhum instalado (`package.json` não tem Jest/Vitest/Playwright) |

`AGENTS.md`/`CLAUDE.md` documentam uma diretriz vinculante: esta versão do Next.js tem
breaking changes em relação ao conhecimento de treinamento — consultar
`node_modules/next/dist/docs/` antes de escrever código novo que dependa de APIs do
framework.

## 3. Módulos Previstos no Plano Original

**Achado importante, registrado como risco na Seção 8**: não existe no repositório um
arquivo de plano/roadmap/especificação de produto versionado (nenhum `plan.md`,
`roadmap.md`, `backlog.md` ou equivalente). A especificação de produto original (v1.0 →
v1.1, que definiu o desenho completo do ERP) foi produzida em uma conversa anterior como um
artefato publicado (documento web), **não como arquivo commitado neste repositório** — ela
não é recuperável a partir do código-fonte por mim ou por qualquer pessoa que abra este
projeto do zero.

O que existe, e que reconstitui com alta confiança o escopo original, é o **schema SQL em
si** (`erp_schema_v1_1.sql`), cujos enums e tabelas foram claramente desenhados para
suportar módulos que nunca foram implementados em código. Isso é evidência estrutural
forte, não um documento de produto, mas é a fonte mais confiável disponível hoje:

- **Fiscal/Tributário**: enums `fiscal_document_type`, `fiscal_direction`; tabelas
  `fiscal_imports`, `fiscal_documents`, `fiscal_document_items`, `tax_assessments`,
  `tax_assessment_lines`.
- **Departamento Pessoal/Folha**: enum `payroll_type`; tabelas `payroll_summaries`,
  `payroll_lines`, `payroll_payments`.
- **Patrimônio**: enums `asset_status`, `depreciation_method`, `asset_event_type`;
  tabelas `asset_categories`, `fixed_assets`, `asset_events`, `asset_depreciations`.
- **Financeiro/Bancos**: tabelas `bank_accounts`, `bank_statement_imports`,
  `bank_statement_lines`, `bank_reconciliations`.
- **Obrigações/IRPJ-CSLL**: enums `obligation_type`, `obligation_status`; tabelas
  `obligations`, `income_tax_assessments`, `income_tax_adjustments`.
- **Auditoria/Logs**: tabelas `period_audits`, `period_audit_findings`, `audit_logs`,
  `import_logs`.
- **Motor de Regras transversal**: `accounting_rules` (domínios FISCAL/PAYROLL/BANK/ASSET
  reaproveitando o mesmo motor).
- **Permissões extensíveis**: tabela `role_permissions` (catálogo global, ainda sem
  consumidor em código — `permissions.ts` continua sendo um stub que não lê esta tabela).

Isso confirma o que a Etapa 14 já havia proposto como roadmap macro (Cadastros → Fiscal →
Financeiro → Patrimônio → Folha → Obrigações → Francoos/RLS → Auditoria → Dashboards), e
que esta etapa de consolidação valida e refina.

## 4. Estado Atual por Módulo

| Módulo | Estado | Evidência |
|---|---|---|
| **Fundação técnica** | ✅ Implementada | App Shell, clientes Supabase (anon+admin), contexto dev-mode, permissões stub, libs de CSV/impressão |
| **Contabilidade** | ✅ MVP completo e auditado | Plano de Contas, Lançamentos, Postagem, Estorno, Períodos, Diário, Balancete, DRE, Balanço, Encerramento, Dashboard, Impressão, CSV (Etapas 1–14) |
| **Cadastros Base** | ✅ Implementado (Etapa 15) | Parceiros, Produtos/Serviços, Naturezas Fiscais, Contas Bancárias, Municípios/UF |
| **Segurança/RLS** | 🟡 Escrita e com suíte de teste pronta (Etapa 17), execução real ainda pendente | 124 policies / 45 tabelas / 16 funções auxiliares escritas; `db/tests/rls_isolation_tests.sql` preparado, não executado contra banco real |
| **Bancos e Conciliação Contábil (Etapa 18)** | ✅ MVP implementado | Importação de extrato CSV, classificação manual, geração de lançamento contábil (DRAFT→POSTED), conciliação/desconciliação, vínculo a lançamento existente — ver Seção 6 |
| **Financeiro empresarial (Contas a Pagar/Receber, títulos)** | ⛔ Adiado deliberadamente | Mudança de escopo decidida no início da Etapa 18: o ERP prioriza o fluxo de Bancos/Conciliação (uso de escritório contábil) antes de contas a pagar/receber (uso de gestão financeira empresarial) — ver nota na Seção 6 |
| **Fiscal/Tributário (Etapa 19)** | ✅ Implementado com escopo robusto | Documentos fiscais (CRUD, itens, retenções, workflow DRAFT→VALIDATED→BOOKED), contabilização manual — ver Seção 6 |
| **Apurações de Tributos (Etapa 20 + 24)** | ✅ Implementado com escopo robusto | Motor de apuração real (`calculateTaxAssessmentAction`) consolidando documentos `BOOKED` + retenções por competência/tributo, workflow DRAFT→CALCULATED→REVIEWED→CLOSED, contabilização. **Etapa 24**: créditos tributários automáticos (ICMS/IPI/PIS/COFINS de documentos de entrada) e manuais, saldo credor anterior, saldo a transportar, ajustes manuais positivos/negativos — estrutura operacional completa, **não** um motor de cálculo tributário legal (sem CIAP/regime/CST-CFOP-NCM) — ver `docs/tax-assessment-credits.md` |
| **Patrimônio (Etapa 22)** | ✅ Implementado com escopo robusto | Categorias, bens, depreciação linear em lote por competência, baixa, contabilização por bem — ver Seção 6 |
| **Folha/DP** | ⛔ Não iniciado | Schema já tem `payroll_*`; zero código de aplicação; Cadastros só tem `partners.is_employee` (insuficiente para folha real) |
| **Obrigações/Guias (Etapa 20.2)** | ✅ Implementado com escopo robusto | Agenda de obrigações, geração a partir de apuração fechada, controle OPEN/GENERATED/PAID/DELIVERED/OVERDUE, exige lançamento `POSTED` para marcar como paga — ver Seção 6 |
| **Integrações Fiscal/Apuração/Patrimônio ↔ Contábil (Etapa 21)** | ✅ Implementado (seleção manual de contas) | Sem motor de `accounting_rules` automático — usuário escolhe as contas em cada contabilização; ver Seção 6 |
| **Francoos/Auth real** | ⛔ Não iniciado | Só o padrão de placeholder `DEV_*` existe |
| **Auditoria/Logs** | ⛔ Não iniciado | Schema já tem `audit_logs`/`period_audits`/`import_logs`; zero código de aplicação |
| **Dashboards executivos multi-módulo** | ⛔ Não iniciado | Existe apenas o Dashboard Contábil (escopo único) |

## 5. Trilha Técnica: Schema, Testes, RLS, Francoos

Reconstituindo a trilha original de 7 passos que a usuária descreveu:

1. `erp_schema_v1.sql` — ✅ existe (schema inicial).
2. Auditoria do schema — ✅ aconteceu (achados CRÍTICO/ALTO/MÉDIO documentados no cabeçalho de `erp_schema_v1_1.sql`), mas **o relatório da auditoria em si não foi salvo como arquivo separado** — só o resumo embutido nos comentários do schema corrigido.
3. `erp_schema_v1_1.sql` corrigido — ✅ existe, é o schema em uso.
4. **Script de testes SQL das invariantes** — ✅ **feito na Etapa 17**: `db/tests/rls_isolation_tests.sql`, suíte automatizada com helpers de assert (`assert_true`/`assert_false`/`assert_count`/`assert_write_blocked`/`assert_write_succeeds`) e simulação de usuário autenticado via `set_test_auth()`/`reset_test_auth()` (GUCs `request.jwt.claim.sub`/`request.jwt.claims` + `SET LOCAL ROLE`). Substitui o roteiro manual de 6 casos que existia como comentários em `erp_rls_v1.sql` (Bloco 5, mantido no arquivo como documentação histórica) por 11 cenários executáveis cobrindo 8 personas, 2 workspaces, 3 empresas.
5. **Rodar/validar esses testes** — 🟡 **preparado, ainda não executado contra um banco real**. A suíte foi validada sintaticamente (`pglast`) e revisada manualmente linha a linha contra cada policy — dois bugs reais já foram encontrados e corrigidos nesse processo (ver Etapa 17 no `DEVELOPMENT_LOG.md`). Falta rodá-la de fato num projeto Supabase descartável, especialmente para confirmar qual formato de claim JWT `auth.uid()` lê na prática (a suíte cobre os dois formatos conhecidos defensivamente, mas isso não foi confirmado ao vivo).
6. **Gerar RLS policies** — ✅ feito: `erp_rls_v1.sql` (116 policies, 41 tabelas, 16 funções auxiliares: `is_workspace_member`, `has_workspace_role`, `is_company_member`, `has_company_role`, `can_read_company`, `can_write_company`, `can_admin_company`, `can_close_period`, `fn_prevent_tenant_change`, entre outras) + `db/migrations/erp_rls_v1_2_cadastros_base.sql` (8 policies adicionais para as 4 tabelas novas da Etapa 15). Total atual: **124 policies cobrindo 45 tabelas**.
7. **Auditar RLS com testes de isolamento** — 🟡 mesma situação do item 5: suíte pronta (`db/tests/rls_isolation_tests.sql`), execução real pendente. `db/README.md` classifica a aplicação da RLS como "Opcional — Apenas Pós-MVP", o que continua consistente com a estratégia atual (RLS real só entra em vigor na Etapa 23, com Francoos) — mas agora existe uma suíte pronta para rodar a qualquer momento antes disso, em vez de depender de um roteiro manual copiado à mão.

**Outras pendências técnicas** (achados da auditoria da Etapa 14, ver `docs/audit-accounting-mvp.md`):
- `server-only` em `src/lib/supabase/server.ts` — não instalado (decisão consciente de não adicionar dependência sem necessidade extrema).
- Permissões reais — `permissions.ts` continua sendo 100% stub (`'*'` sempre concedido); a tabela `role_permissions` do schema não é lida por nenhum código.
- Francoos/Auth — não iniciado; o próprio App Shell documenta isso com um banner visível ("⚠️ Integração Francoos pendente").
- Testes automatizados de aplicação (não-SQL) — inexistentes; nenhum framework de teste está instalado.

## 6. Trilha Funcional

| Trilha | Status |
|---|---|
| Contábil | ✅ Completo e auditado |
| Cadastros Base | ✅ Completo |
| Bancos e Conciliação Contábil | ✅ MVP completo (Etapa 18) |
| Financeiro empresarial (Contas a Pagar/Receber, títulos) | ⛔ **Adiado deliberadamente** — ver nota abaixo |
| Fiscal/Tributário | ✅ Implementado com escopo robusto (Etapa 19) — gap de FK do Risco R4 fechado nesta rodada |
| Apurações de Tributos | ✅ Implementado com escopo robusto (Etapa 20) |
| Obrigações/Guias | ✅ Implementado com escopo robusto (Etapa 20.2) |
| Patrimônio | ✅ Implementado com escopo robusto (Etapa 22) |
| Folha/DP | ⛔ Não iniciado — schema pronto, cadastro de colaborador insuficiente |
| Dashboards executivos | ⛔ Não iniciado — só existe o escopo Contábil (Fiscal/Obrigações/Patrimônio têm dashboard próprio, não consolidado) |
| Auditoria/Logs | ⛔ Não iniciado — schema pronto |

### Etapas 19–22: Fiscal/Tributário, Apurações, Obrigações e Patrimônio (concluídas)

Implementadas como macro-entrega única e integrada, com escopo deliberadamente robusto (não MVP mínimo), reaproveitando 100% das tabelas já existentes desde `erp_schema_v1_1.sql` — ver `DEVELOPMENT_LOG.md`, entrada "[2026-07-11] Etapas 19–22" para o detalhamento completo de schema/RLS/seed/módulos/integrações. Resumo:
- **Fiscal (19)**: CRUD de documentos fiscais com itens e retenções, workflow DRAFT→VALIDATED→BOOKED→(ACCOUNTED), fechando o gap de FK do Risco R4 (`fiscal_document_items.item_id`, `fiscal_documents.fiscal_operation_nature_id`).
- **Apurações (20)**: motor real de cálculo (`calculateTaxAssessmentAction`) consolidando documentos `BOOKED` + retenções por competência/tributo (ISS/ICMS/PIS/COFINS), preservando ajustes manuais em recálculos.
- **Obrigações (20.2)**: agenda com geração a partir de apuração fechada, workflow OPEN→GENERATED→PAID→DELIVERED, exige lançamento `POSTED` pré-existente para marcar como paga (sem baixa bancária automática).
- **Patrimônio (22)**: categorias, bens, depreciação linear em lote por competência (com valor residual sempre respeitado), baixa de bem, contabilização por bem (não por categoria).
- **Integrações (21)**: 6 pontes implementadas com seleção manual de contas (Fiscal→Contábil, Fiscal→Apuração, Apuração→Obrigação, Apuração→Contábil, Patrimônio→Contábil, Fiscal↔Patrimônio informacional) — nenhum motor de `accounting_rules` automático nesta rodada.
- **Atualizações posteriores**: Etapas 32B/32D implementaram importação XML NF-e/CT-e/NFS-e; Etapa 33A criou bem patrimonial a partir de item fiscal; Etapa 34A levou IRPJ/CSLL para `tax_assessments`; Etapa 34B adicionou baixa patrimonial com contabilização automática de ganho/perda.
- **Fora do escopo remanescente**: emissão real de NF-e/SEFAZ, transmissão de SPED/EFD/ECD/ECF, cálculo tributário legal completo, CIAP completo, folha completa, boleto/CNAB/Open Finance, baixa bancária automática, CSV fiscal amplo e UI dedicada para as tabelas legadas `income_tax_assessments`.

### Mudança de escopo registrada na Etapa 18: Financeiro empresarial adiado

A hipótese original (Etapa 14/16) previa "Financeiro básico" como Contas a Pagar/Receber.
No início da Etapa 18, a direção do produto mudou: o ERP é pensado primeiro como
**backoffice para escritório contábil**, não como gestão financeira empresarial completa.
O mínimo funcional financeiro que faz sentido agora é **Bancos e Conciliação** — importar
extrato, classificar movimentações, gerar/vincular lançamentos contábeis, conciliar — não
títulos/boletos/CNAB/fluxo de caixa. Essa trilha foi implementada nesta etapa. Contas a
Pagar/Receber como módulo de gestão financeira (títulos, parcelamento, fluxo de caixa
empresarial) continua no roadmap, mas depois do Fiscal — reavaliar prioridade quando essa
etapa começar.

## 7. Decisões Já Tomadas (e por quê)

- **Único livro diário para todos os módulos**: todo documento fiscal/folha/patrimônio/
  banco gera um `journal_entry` — decisão estrutural do schema original, mantida em todas
  as etapas até aqui.
- **`partners` única em vez de `customers`/`suppliers` separadas** (Etapa 15): papéis via
  colunas booleanas (`is_customer`/`is_supplier`/`is_carrier`/`is_employee`), permitindo
  múltiplos papéis simultâneos sem duplicar cadastro.
- **RLS escrita mas não aplicada em dev** (desde a Etapa 0): decisão consciente e
  documentada — `service_role` é usado como bypass temporário até existir uma sessão real
  de Auth. Reafirmada e mantida na Etapa 15.
- **Sem dependências novas sem necessidade extrema**: `server-only` permanece não
  instalado por essa razão (Etapa 15).
- **Cadastros Base antes de RLS validada**: decisão implícita da sequência real (não
  formalmente registrada até esta etapa) — analisada e validada na Seção 8 abaixo.
- **Financeiro empresarial adiado em favor de Bancos/Conciliação** (Etapa 18): o produto
  prioriza o fluxo de escritório contábil (extrato → classificação → lançamento →
  conciliação) antes de Contas a Pagar/Receber — ver nota na Seção 6.
- **`bank_statement_imports`/`bank_statement_lines`/`bank_reconciliations` reaproveitadas,
  não recriadas** (Etapa 18): essas 3 tabelas já existiam desde o schema v1.1 com RLS
  própria; a Etapa 18 apenas as estendeu (`ALTER TABLE ADD COLUMN`), preservando as colunas
  originais (`entry_date`, `hash`, `journal_entry_line_id`, `reconciled`) como fonte de
  verdade em vez de duplicá-las com nomes novos.

## 8. Riscos e Débitos Técnicos

| # | Risco/Débito | Severidade | Detalhe |
|---|---|---|---|
| R1 | **Plano original não encontrado como artefato versionado** | Alto (documental) | A especificação de produto v1.0/v1.1 que originou o schema nunca foi commitada neste repositório — só existiu como artefato de uma conversa anterior. Este documento (`erp-master-plan.md`) passa a ser a fonte de verdade a partir de agora; recomenda-se nunca mais deixar uma especificação de produto fora do repositório. |
| R2 | **RLS nunca exercitada contra dados reais** | Médio (era Alto — suíte automatizada já existe desde a Etapa 17, falta só rodá-la) | 124 policies escritas, suíte de 11 cenários pronta em `db/tests/rls_isolation_tests.sql`, mas ainda não executada contra um Supabase real. É um comando de "rodar", não mais um trabalho de "escrever do zero" — o esforço restante é pequeno. |
| R3 | **Cadastro de colaborador (`partners.is_employee`) insuficiente para Folha real** | Baixo (esperado) | Não tem cargo, salário, matrícula, data de admissão, PIS/PASEP. Gap esperado e aceitável — Folha ainda não começou. |
| R4 | ~~Gap de FK entre `fiscal_documents`/`fiscal_document_items` e os novos cadastros~~ | ✅ **Fechado na Etapa 19** | `fiscal_documents.fiscal_operation_nature_id` e `fiscal_document_items.item_id` adicionados em `erp_schema_v1_4_fiscal_tax_assets.sql` Blocos 3/4. |
| R5 | **100% do tráfego roda via `service_role`** | Médio (documentado desde Etapa 0) | Efetivamente sem isolamento multiempresa real em dev — mitigado porque toda query já filtra `company_id` explicitamente no código da aplicação, mas isso é defesa de aplicação, não de banco. |
| R6 | **Zero testes automatizados de aplicação** | Médio | Nenhum framework de teste instalado; toda validação até aqui foi manual/build-only. |
| R7 | **Relatório da auditoria do schema v1→v1.1 não versionado separadamente** | Baixo | Só existe resumido nos comentários do próprio `erp_schema_v1_1.sql`. |
| R8 | **`src/app/(erp)/layout.tsx` usa só o Anon Client (sem fallback Admin)** | Baixo | Diferente do padrão do resto do app; se a RLS for habilitada sem Auth real, o layout cai silenciosamente nos nomes fallback ("Escritório Demo") em vez de mostrar erro — comportamento inofensivo hoje, mas inconsistente com o padrão dos outros módulos. |

## 9. Roadmap Recomendado

A hipótese original da usuária (Etapas 16–25) está **quase correta**. Um ajuste: a Etapa 17
não deve ser "RLS completa" no sentido de produção — Francoos ainda não existe, então
aplicar RLS de verdade no banco de dev quebraria o fluxo de trabalho atual (que depende do
bypass via `service_role`). O que faz sentido agora é uma **validação da RLS em ambiente
descartável**, sem afetar o banco de desenvolvimento funcional.

| Etapa | Nome | Ajuste |
|---|---|---|
| 16 | Consolidação do Roadmap Mestre | ✅ Concluída |
| 17 | **Validação de Segurança** (RLS + testes de isolamento em projeto Supabase descartável) | 🟡 Suíte escrita e revisada, **ainda não executada contra um banco real** — ver `db/tests/README.md` e Etapa 17 no `DEVELOPMENT_LOG.md` |
| 18 | ~~Financeiro básico~~ → **Bancos e Conciliação Contábil MVP** | ✅ Concluída, com **mudança de escopo**: Contas a Pagar/Receber foi adiado; implementado importação de extrato CSV, classificação, geração/vínculo de lançamento contábil e conciliação — ver Seção 6 |
| 19 | Fiscal/Tributário básico | ✅ Concluída, escopo robusto (não MVP mínimo) — gap R4 fechado como parte da própria etapa, em vez de pré-requisito separado |
| 20 | Apurações de Tributos + Obrigações/Guias | ✅ Concluída, escopo robusto — combinada com a Etapa 21 (integrações) na execução real |
| 21 | Integrações Contábeis/Fiscais e Guias | ✅ Concluída — implementada como Server Actions dentro dos módulos 19/20/22, não como módulo à parte; 6 integrações com seleção manual de contas (sem `accounting_rules` automático) |
| 22 | Patrimônio, Depreciação e Integração Fiscal/Contábil | ✅ Concluída, escopo robusto |
| 23 | Auditoria a frio das Etapas 19–22 | ✅ Concluída — aprovado com ressalvas, 5 achados Alto/Médio corrigidos, 5 documentados sem correção. Ver `docs/audit-fiscal-tax-assets.md` |
| 24 | **Apurações Fiscais: Créditos Tributários, Saldos e Ajustes** | ✅ Concluída — trata o achado B1 da Etapa 23 (crédito tributário automático/manual, saldo credor anterior/a transportar, ajustes). Ver `docs/tax-assessment-credits.md` |
| 24.5 | Financeiro empresarial (Contas a Pagar/Receber, títulos) | Mantido adiado — reavaliar prioridade agora que Fiscal/Apurações/Obrigações/Patrimônio estão maduros |
| 25 | Folha/DP | Ajustado (era Etapa 21 na hipótese original) — precisa antes estender `partners`/criar `employees` |
| 26 | Francoos/RLS final/produção | Confirmado — é aqui que a RLS validada na Etapa 17 finalmente é ativada de verdade |
| 27 | Auditoria/Logs + Dashboards executivos multi-módulo | Combinadas — confirmado |

## 10. Próximas 5 Etapas Sugeridas (detalhado)

1. **Etapa 17 — Validação de Segurança (RLS + Isolamento)**: aplicar `erp_schema_v1_1.sql` + `erp_schema_v1_2_cadastros_base.sql` + `erp_rls_v1.sql` + `erp_rls_v1_2_cadastros_base.sql` num projeto Supabase de teste (não o de dev); semear 2 workspaces/empresas/usuários; rodar o roteiro de 6 casos já escrito no Bloco 5 de `erp_rls_v1.sql`; documentar resultado em `docs/`. Não bloqueia as etapas seguintes, mas deve acontecer antes de a superfície de policies crescer ainda mais.
2. **Etapa 18 — Bancos e Conciliação Contábil MVP** (✅ concluída, escopo alterado durante a etapa): importação de extrato CSV, classificação manual, geração de lançamento contábil (`origin='BANK_STATEMENT'`, padrão DRAFT→POSTED do módulo Contábil), conciliação/desconciliação e vínculo a lançamento já existente — usando `bank_accounts`/`bank_statement_imports`/`bank_statement_lines`/`bank_reconciliations` já existentes no schema desde a v1.1, estendidas (não recriadas) em `db/migrations/erp_schema_v1_3_bank_reconciliation_mvp.sql`. Contas a Pagar/Receber (Financeiro empresarial) foi movido para a Etapa 22.5.
3. **Etapa 19 — Fiscal básico**: antes de começar, migração pequena para adicionar `fiscal_documents.fiscal_operation_nature_id` (FK) e `fiscal_document_items.item_id` (FK); depois, Entradas/Saídas simples usando `partners`/`items`/`fiscal_operation_natures`, sem apuração tributária completa.
4. **Etapa 20 — Patrimônio**: Ativo Imobilizado usando `chart_accounts`/`cost_centers` já existentes; depreciação básica.
5. **Etapa 21 — Folha/DP**: começa com uma extensão de cadastro (cargo, salário-base, matrícula, admissão) sobre `partners.is_employee` ou uma tabela `employees` dedicada — decisão a tomar no início dessa etapa, não agora.

---

## Respostas às Perguntas de Diagnóstico

**1. O que o plano original previa?** Ver Seção 3 — reconstituído a partir do schema, pois o documento de especificação original não está no repositório (Risco R1).

**2. O que já foi implementado?** Ver Seção 4 (tabela por módulo).

**3. O que foi implementado fora da ordem original?** Cadastros Base (Etapa 15) foi implementado antes de a RLS (passos 4–7 da trilha técnica) ser validada. **Não é um problema em si** — é uma escolha pragmática razoável para um MVP em desenvolvimento solo, mas só permanece razoável se for rastreada explicitamente (o que esta etapa faz) e se a validação de RLS acontecer antes da Etapa 23 (produção), não for esquecida indefinidamente.

**4. O que falta da trilha técnica?** Testes SQL automatizados (só existe roteiro manual), execução desses testes, aplicação real da RLS, `server-only`, permissões reais, Francoos/Auth, testes automatizados de aplicação. Detalhe completo na Seção 5.

**5. O que falta da trilha funcional?** Financeiro, Fiscal, Patrimônio, Folha, Obrigações, Dashboards executivos, Auditoria/Logs — todos sem uma linha de código de aplicação, mas todos já com schema desenhado. Detalhe na Seção 6.

**6. Cadastros Base estão adequados para os próximos módulos?** Sim para Financeiro e Patrimônio (adequados como estão). Sim com uma pequena migração de FK para Fiscal (Risco R4). Não para Folha real (esperado — Risco R3, será resolvido no início da Etapa 21).

**7. Financeiro antes de Fiscal?** Sim, confirmado — ver Seção 9/10. Financeiro não tem nenhum gap de schema hoje; Fiscal tem um gap pequeno mas real (R4) que precisa ser fechado primeiro.

**8. Pausar para RLS antes de novos módulos?** Não pausar o desenvolvimento funcional, mas **validar a RLS já escrita em um ambiente descartável antes da Etapa 18 começar** (opção intermediária, não as duas extremas) — ver Etapa 17 revisada na Seção 9.

**9. O que deve virar milestone oficial?** Ver a tabela de roadmap na Seção 9 — cada etapa 16 a 25 é agora uma milestone rastreável neste documento.
