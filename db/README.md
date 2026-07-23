# Instruções de Setup do Banco de Dados & Seed

Este diretório contém o schema estruturado e os scripts de seed para inicializar o ERP Contábil localmente no Supabase/PostgreSQL.

## 1. Ordem de Aplicação Recomendada

Para evitar problemas de permissões e chaves estrangeiras com o Supabase Auth, siga rigorosamente a ordem abaixo:

1. **Schema base**: `erp_schema_v1_1.sql` (raiz do projeto).
2. **Seed contábil**: `db/seed/seed_demo_accounting.sql`.
3. **Schema Cadastros Base (Etapa 15)**: `db/migrations/erp_schema_v1_2_cadastros_base.sql`.
4. **Seed Cadastros Base**: `db/seed/seed_demo_base_registrations.sql`.
5. **Schema Bancos/Conciliação (Etapa 18)**: `db/migrations/erp_schema_v1_3_bank_reconciliation_mvp.sql`.
6. **Seed Bancos/Conciliação**: `db/seed/seed_demo_banking.sql`.
7. **Schema Fiscal/Apurações/Obrigações/Patrimônio (Etapas 19–22)**: `db/migrations/erp_schema_v1_4_fiscal_tax_assets.sql`. Inclui migração de enum em colunas existentes (`fiscal_documents.status`/`document_type`, `tax_assessments.tax_type`/`status`, `obligations.status`/`obligation_type`) — ver decisão de modelagem no topo do arquivo antes de aplicar em um ambiente com dados reais.
8. **Schema Créditos Tributários (Etapa 24)**: `db/migrations/erp_schema_v1_5_tax_credits.sql`. Só adiciona `tax_assessment_lines.notes` — nenhum enum novo, nenhuma tabela nova (ver decisão de modelagem no topo do arquivo).
9. **Seed Fiscal/Apurações/Obrigações/Patrimônio**: `db/seed/seed_demo_fiscal_tax_assets.sql` (já inclui os casos de crédito/saldo credor/ajuste manual da Etapa 24 — requer o passo 8 aplicado antes, por causa da coluna `notes`).
10. **Aplicar as Regras de RLS (Opcional - Apenas Pós-MVP)**: `erp_rls_v1.sql` (raiz) + `db/migrations/erp_rls_v1_2_cadastros_base.sql` + `db/migrations/erp_rls_v1_4_fiscal_tax_assets.sql`. Não existe um `erp_rls_v1_3_*` nem `erp_rls_v1_5_*` — a Etapa 18 só estendeu tabelas com RLS já existente/coberta, e a Etapa 24 só adicionou uma coluna a uma tabela já coberta (ver cabeçalho de `erp_schema_v1_5_tax_credits.sql`), sem exigir policies novas.
11. **Validação de segurança (Etapa 17/25, opcional, ambiente descartável — NUNCA no banco de dev)**: [rls_isolation_tests.sql](file:///c:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/tests/rls_isolation_tests.sql), ver [README.md](file:///c:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/db/tests/README.md). A suíte foi ampliada na Etapa 25 para cobrir as tabelas e comportamentos das Etapas 18–24 (Cenário 12), incluindo retenções, apurações, obrigações, patrimônio e conciliação bancária.

*Nota: Se a RLS já estiver aplicada e bloquear a inserção de um seed, execute-o como administrador (Superuser / postgres) no editor SQL do Supabase ou utilizando a chave de bypass `SUPABASE_SERVICE_ROLE_KEY` — os seeds `seed_demo_accounting.sql`, `seed_demo_banking.sql` e `seed_demo_fiscal_tax_assets.sql` transicionam lançamentos de DRAFT para POSTED via UPDATE direto, o que exige `can_write_company()` = true quando a RLS já está ativa.*

---

## 2. Configuração do `.env.local`

Crie um arquivo chamado `.env.local` na raiz do seu projeto Next.js com base no modelo [.env.local.example](file:///C:/Users/peace/OneDrive/Área de Trabalho/SELA SISTEM/.env.local.example).

Preencha os seguintes valores de desenvolvimento fixados no script de seed:

```env
NEXT_PUBLIC_SUPABASE_URL=seu_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_publica
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role

# UUIDs correspondentes ao seed demo contábil
DEV_WORKSPACE_ID=88888888-8888-8888-8888-888888888888
DEV_COMPANY_ID=99999999-9999-9999-9999-999999999999
DEV_PROFILE_ID=11111111-1111-1111-1111-111111111111
DEV_ESTABLISHMENT_ID=55555555-5555-5555-5555-555555555555
DEV_COMPETENCE=2025-01-01
```

*Nota: `DEV_ESTABLISHMENT_ID` corresponde ao estabelecimento Matriz criado no seed (`seed_demo_accounting.sql`, bloco 4). Não é lido por `getCurrentContext()` hoje (que expõe apenas workspace/company/profile/competência), mas está reservado para quando o contexto passar a expor o estabelecimento ativo — mantenha-o no `.env.local` para evitar retrabalho futuro.*

---

## 3. O que é possível testar após rodar o Seed

Após aplicar o seed, o banco conterá dados para validar as seguintes funcionalidades no Next.js:

* **Empresa Ativa**: "Transportadora Modelo Ltda" com estabelecimento Matriz em São Paulo.
* **Competência Ativa**: Competência aberta para Janeiro/2025 (`2025-01-01`), com o período de abertura de Dezembro/2024 também disponível.
* **Plano de Contas**: Uma árvore contábil de contas sintéticas e analíticas prontas para transporte em Lucro Real.
* **Diário Contábil**: Livro diário consolidando as transações de Janeiro/2025 com o status `POSTED`.
* **Balancete & Relatórios Contábeis (DRE e Balanço)**: Os lançamentos inseridos possuem contrapartidas equilibradas (Débito = Crédito), possibilitando o teste de DRE, Balancete de Verificação e Balanço Patrimonial coerentes e sem distorções aritméticas.
* **Cadastros Base**: Parceiros, Produtos/Serviços, Naturezas Fiscais, Contas Bancárias e Municípios/UF de demonstração (após `seed_demo_base_registrations.sql`).
* **Bancos e Conciliação** (após `seed_demo_banking.sql`): 1 importação de extrato demo com 4 linhas — 2 `PENDING` (para testar classificação/geração de lançamento), 1 `IGNORED` (com justificativa) e 1 `RECONCILED` (com lançamento contábil real gerado, origem `BANK_STATEMENT`, e trilha em `bank_reconciliations`).
* **Fiscal/Apurações/Obrigações/Patrimônio** (após `seed_demo_fiscal_tax_assets.sql`): 4 documentos fiscais (1 `DRAFT`, 1 `BOOKED`+`ACCOUNTED` com lançamento real, 1 `VALIDATED` com retenção de ISS, 1 `CANCELLED`); 4 apurações (ISS `CLOSED` com lançamento de provisão, ICMS `DRAFT`, PIS `CLOSED` sem lançamento e com imposto a recolher, **COFINS `CLOSED` com saldo credor a transportar — crédito manual, saldo anterior e ajuste manual negativo, Etapa 24**); 5 obrigações (`OPEN`, `OVERDUE`, `GENERATED` a partir de apuração, `PAID` com lançamento vinculado, `DELIVERED`); 2 categorias patrimoniais e 3 bens (`ACTIVE` depreciando com 1 depreciação `POSTED`, `FULLY_DEPRECIATED`, `DISPOSED`); 6 novas contas contábeis (ISS/ICMS a recolher, ISS sobre receitas, despesa de depreciação, 2 contas de bem patrimonial).
