-- =====================================================================================
-- ERP CONTÁBIL — SCHEMA POSTGRESQL / SUPABASE
-- Baseado na Especificação Técnica & de Produto v1.1
-- =====================================================================================
-- Escopo desta migração:
--   - Extensões, enums, tabelas, constraints, triggers, functions, views, índices.
--   - RLS habilitada em todas as tabelas sensíveis (policies ficam para a próxima etapa).
--   - Sem seed de dados de negócio (apenas comentários e os enums em si).
--
-- Convenção de nomenclatura:
--   - tabelas e colunas: inglês, snake_case (ex.: journal_entries, chart_accounts).
--   - comentários (COMMENT ON): português, para aderência ao vocabulário contábil BR.
--   - enums: inglês, valores em inglês (consistência com o restante do schema).
--
-- Ordem de criação: as tabelas NÃO seguem a ordem de numeração da especificação
-- (Identidade → Fiscal → Folha → Patrimônio → ...), e sim a ordem de DEPENDÊNCIA DE FK,
-- exigida pelo PostgreSQL. journal_entries/journal_entry_lines são criadas cedo (logo
-- após períodos) porque quase todo módulo referencia journal_entries.id como origem do
-- lançamento. Um único caso de referência circular (journal_entry_lines ↔
-- bank_statement_lines) é resolvido com uma FK adicionada via ALTER TABLE ao final —
-- ver bloco "FKs CRUZADAS" antes das views.
-- =====================================================================================


-- =====================================================================================
-- BLOCO 1 — EXTENSÕES
-- =====================================================================================
-- pgcrypto: fornece gen_random_uuid(), usada como default de todo id uuid primary key.
-- Nenhuma outra extensão é necessária para este schema (evitamos dependências extras
-- não justificadas pela especificação).
create extension if not exists pgcrypto;


-- =====================================================================================
-- BLOCO 2 — ENUMS
-- =====================================================================================
-- Os 5 primeiros enums não tiveram valores literais definidos na v1.1; os valores
-- abaixo são a interpretação mais direta da especificação e estão listados em
-- "pontos a revisar" na resposta que acompanha este arquivo.

create type workspace_role as enum ('OWNER', 'ADMIN', 'ACCOUNTANT', 'ASSISTANT');
create type company_role as enum ('ACCOUNTANT', 'ASSISTANT', 'CLIENT_VIEWER');
create type tax_regime as enum ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL');
create type company_profile as enum ('TRANSPORTATION', 'TRADE', 'SERVICES', 'INDUSTRY', 'OTHER');
create type establishment_type as enum ('HEADQUARTERS', 'BRANCH');

-- Os enums abaixo têm valores literais definidos explicitamente na solicitação.

create type account_type as enum ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'REVENUE_DEDUCTION', 'COST', 'EXPENSE');
create type normal_balance as enum ('DEBIT', 'CREDIT');

create type journal_status as enum ('DRAFT', 'POSTED', 'REVERSED', 'CANCELLED', 'PENDING_CLASSIFICATION');

create type journal_origin as enum (
  'MANUAL', 'OPENING', 'FISCAL_DOCUMENT', 'FISCAL_ASSESSMENT', 'PAYROLL_SUMMARY',
  'PAYROLL_PAYMENT', 'BANK_STATEMENT', 'ASSET_ACQUISITION', 'ASSET_DEPRECIATION',
  'ASSET_DISPOSAL', 'IRPJ_CSLL', 'RESULT_CLOSING', 'REVERSAL'
);

-- debit_credit é mantido como um enum DISTINTO de normal_balance mesmo tendo os mesmos
-- valores: normal_balance descreve a natureza de uma CONTA (dado cadastral, estável),
-- debit_credit descreve o lado de uma LINHA DE LANÇAMENTO (dado transacional). Hoje têm
-- o mesmo domínio de valores, mas representam conceitos diferentes e podem divergir no
-- futuro — por isso dois tipos, como pedido na especificação (itens 7 e 10).
create type debit_credit as enum ('DEBIT', 'CREDIT');

create type period_status as enum ('OPEN', 'IN_REVIEW', 'CLOSED', 'REOPENED');
create type fiscal_document_type as enum ('NFE', 'CTE', 'NFSE', 'OTHER');
create type fiscal_direction as enum ('IN', 'OUT');
create type generic_status as enum ('DRAFT', 'READY', 'POSTED', 'CANCELLED');
create type obligation_type as enum ('PIS', 'COFINS', 'IRPJ', 'CSLL', 'FGTS', 'INSS', 'ISS', 'ICMS', 'OTHER');
create type obligation_status as enum ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');
create type asset_status as enum ('DRAFT', 'ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED', 'SOLD', 'INACTIVE');
create type depreciation_method as enum ('STRAIGHT_LINE', 'MANUAL', 'UNITS_OF_PRODUCTION', 'ACCELERATED');

create type asset_event_type as enum (
  'ACQUISITION', 'ACTIVATION', 'IMPROVEMENT', 'ADDITION', 'REVALUATION',
  'IMPAIRMENT', 'PARTIAL_DISPOSAL', 'DISPOSAL', 'SALE', 'REVERSAL'
);

create type import_status as enum ('SUCCESS', 'WARNING', 'ERROR', 'PROCESSING');
create type audit_severity as enum ('INFO', 'WARNING', 'ERROR', 'CRITICAL');
create type rule_domain as enum ('FISCAL', 'PAYROLL', 'BANK', 'ASSET');
create type rule_status as enum ('ACTIVE', 'INACTIVE');


-- =====================================================================================
-- BLOCO 3 — FUNÇÕES UTILITÁRIAS DE APOIO (usadas por triggers definidos mais abaixo)
-- =====================================================================================

-- Mantém updated_at sempre corrente em qualquer UPDATE.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function set_updated_at() is 'Atualiza updated_at = now() a cada UPDATE. Anexada via trigger em toda tabela que possui a coluna.';


-- =====================================================================================
-- BLOCO 4 — TABELAS: IDENTIDADE / TENANCY
-- =====================================================================================

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table profiles is 'Espelho de auth.users com dados de perfil usados na aplicação (nome, e-mail). Não carrega workspace/empresa — isso vem de workspace_users/company_users.';

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();


create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  plan text not null default 'starter',
  status text not null default 'active' check (status in ('active', 'suspended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);
comment on table workspaces is 'Escritório de contabilidade — tenant de topo. Todo o restante do sistema (empresas, usuários) pendura a partir daqui.';

create trigger trg_workspaces_updated_at before update on workspaces
  for each row execute function set_updated_at();


create table workspace_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role workspace_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);
comment on table workspace_users is 'Papel de um usuário dentro de um escritório. Remoção de acesso é DELETE físico; o histórico da ação fica em audit_logs.';

create trigger trg_workspace_users_updated_at before update on workspace_users
  for each row execute function set_updated_at();


create table account_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_regime tax_regime not null,
  company_profile company_profile not null,
  version int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
comment on table account_templates is 'Catálogo GLOBAL de templates de plano de contas por perfil de empresa + regime tributário (ex.: "Transportadora — Lucro Real"). Não pertence a nenhum workspace: é compartilhado pela plataforma inteira.';

create trigger trg_account_templates_updated_at before update on account_templates
  for each row execute function set_updated_at();


create table companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  legal_name text not null,
  trade_name text,
  cnpj text not null,
  state_registration text,
  municipal_registration text,
  nire text,
  incorporation_date date,
  tax_regime tax_regime not null,
  company_profile company_profile not null,
  city text,
  state char(2),
  account_template_id uuid references account_templates(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique (workspace_id, cnpj)
);
comment on table companies is 'Empresa-cliente do escritório — unidade central de isolamento de dados contábeis (equivalente à "empresa ativa" do protótipo).';

create trigger trg_companies_updated_at before update on companies
  for each row execute function set_updated_at();


create table company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role company_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, profile_id)
);
comment on table company_users is 'Papel de um usuário dentro de uma empresa específica (pode ser mais restrito que o papel no escritório).';

create trigger trg_company_users_updated_at before update on company_users
  for each row execute function set_updated_at();


create table establishments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  type establishment_type not null default 'HEADQUARTERS',
  cnpj text not null,
  state_registration text,
  municipal_registration text,
  city text,
  state char(2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique (company_id, cnpj)
);
comment on table establishments is 'Matriz/filial de uma empresa. Opcional: empresas sem filial simplesmente não têm registro aqui (o "estabelecimento" fica implícito na própria empresa).';

create trigger trg_establishments_updated_at before update on establishments
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 5 — TABELAS: TRANSVERSAIS (centros de custo, parceiros)
-- =====================================================================================

create table cost_centers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique (company_id, code)
);
comment on table cost_centers is 'Centro de custo — entidade transversal referenciada por lançamentos, fiscal, folha, patrimônio e regras.';

create trigger trg_cost_centers_updated_at before update on cost_centers
  for each row execute function set_updated_at();


create table partners (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  document text,
  partner_type text check (partner_type in ('CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'OTHER')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);
comment on table partners is 'Clientes, fornecedores e demais parceiros usados em lançamentos e documentos fiscais.';

create trigger trg_partners_updated_at before update on partners
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 6 — TABELAS: PLANO DE CONTAS & TEMPLATES
-- =====================================================================================

create table account_template_lines (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references account_templates(id) on delete cascade,
  parent_id uuid references account_template_lines(id),
  code text not null,
  name text not null,
  account_type account_type not null,
  normal_balance normal_balance not null,
  is_synthetic boolean not null default false,
  dre_group text,
  bp_group text,
  order_dre int,
  order_bp int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, code)
);
comment on table account_template_lines is 'Linha "modelo" de um template de plano de contas. Aplicar um template para uma empresa COPIA estas linhas para chart_accounts (não referencia ao vivo).';

create trigger trg_account_template_lines_updated_at before update on account_template_lines
  for each row execute function set_updated_at();


create table chart_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  parent_id uuid references chart_accounts(id),
  code text not null,
  name text not null,
  account_type account_type not null,
  normal_balance normal_balance not null,
  level int generated always as (array_length(string_to_array(code, '.'), 1)) stored,
  is_synthetic boolean not null default false,
  accepts_entries boolean not null default true,
  non_entry_reason text,
  is_active boolean not null default true,
  dre_group text,
  bp_group text,
  order_dre int,
  order_bp int,
  default_cost_center_id uuid references cost_centers(id),
  template_line_origin_id uuid references account_template_lines(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  unique (company_id, code),
  -- Regra 2 (obrigatória): conta sintética nunca aceita lançamento direto.
  constraint chk_chart_accounts_synthetic_no_entries check (not (is_synthetic and accepts_entries)),
  -- Regra 3 (obrigatória, com ressalva): conta analítica só pode ter accepts_entries = false
  -- se houver uma justificativa registrada (ex.: conta de encerramento/transferência que
  -- só deve ser usada por rotina controlada, não por lançamento manual).
  constraint chk_chart_accounts_analytic_needs_reason check (is_synthetic or accepts_entries or non_entry_reason is not null)
);
comment on table chart_accounts is 'Plano de contas por empresa. "level" é derivado do código (quantidade de segmentos separados por ponto) — mesma lógica de nivelContaPorCodigo() validada no protótipo, usada para indentação em cascata no Balancete.';
comment on column chart_accounts.non_entry_reason is 'Obrigatório quando accepts_entries = false numa conta analítica (não sintética) — justificativa de por que essa conta não deve receber lançamento manual direto.';

create trigger trg_chart_accounts_updated_at before update on chart_accounts
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 7 — TABELAS: MOTOR DE REGRAS & PERÍODOS
-- =====================================================================================

create table accounting_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  domain rule_domain not null,
  name text not null,
  priority int not null default 100,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  status rule_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);
comment on table accounting_rules is 'Motor de regras único reaproveitado nos 4 domínios (fiscal/folha/banco/patrimônio). "conditions" e "actions" em jsonb dão flexibilidade sem precisar de uma tabela por domínio.';

create trigger trg_accounting_rules_updated_at before update on accounting_rules
  for each row execute function set_updated_at();


create table accounting_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  competence date not null,
  start_date date not null,
  end_date date not null,
  status period_status not null default 'OPEN',
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  reopened_by uuid references auth.users(id),
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, competence),
  constraint chk_accounting_periods_competence_first_day check (competence = date_trunc('month', competence)::date),
  constraint chk_accounting_periods_dates check (start_date <= end_date)
);
comment on table accounting_periods is 'Estratégia de competência: sempre o primeiro dia do mês (ex.: 2026-07-01), garantido pela constraint. Facilita comparação/ordenação sem precisar de campos year/month separados.';

create trigger trg_accounting_periods_updated_at before update on accounting_periods
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 8 — TABELAS: NÚCLEO DO LIVRO CONTÁBIL (journal_entries / journal_entry_lines)
-- =====================================================================================
-- Criadas cedo, logo após períodos, porque quase todos os módulos abaixo (fiscal, folha,
-- bancos, obrigações, patrimônio, IRPJ) referenciam journal_entries.id como origem.

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  establishment_id uuid references establishments(id),
  number bigint not null,
  entry_date date not null,
  competence date not null,
  description text not null,
  document text,
  partner_id uuid references partners(id),
  origin journal_origin not null default 'MANUAL',
  origin_id uuid,
  status journal_status not null default 'DRAFT',
  reversal_of_id uuid references journal_entries(id),
  reversed_by_entry_id uuid references journal_entries(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (company_id, number),
  constraint chk_journal_entries_competence_first_day check (competence = date_trunc('month', competence)::date)
);
comment on table journal_entries is 'Cabeçalho do lançamento contábil. Não possui deleted_at: lançamento nunca é apagado — sai de circulação via status CANCELLED (nunca foi POSTED) ou REVERSED (foi POSTED e foi revertido por um lançamento inverso).';
comment on column journal_entries.origin_id is 'Referência polimórfica ao registro que originou o lançamento (fiscal_documents.id, payroll_summaries.id, fixed_assets.id, etc., conforme "origin"). Sem FK física por ser polimórfica — a integridade é garantida pelas funções/Server Actions que criam o lançamento.';
comment on column journal_entries.number is 'Numeração sequencial por empresa. Atribuída pela aplicação (MAX(number)+1 dentro de uma transação); a unicidade (company_id, number) é a rede de segurança contra corrida.';

create trigger trg_journal_entries_updated_at before update on journal_entries
  for each row execute function set_updated_at();

-- Regra 9 (obrigatória): no máximo um lançamento de abertura (não cancelado) por empresa.
create unique index uq_journal_entries_one_opening on journal_entries (company_id)
  where origin = 'OPENING' and status <> 'CANCELLED';


create table journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references chart_accounts(id),
  debit_credit debit_credit not null,
  amount numeric(18,2) not null,
  memo text,
  cost_center_id uuid references cost_centers(id),
  reconciled boolean not null default false,
  bank_statement_line_id uuid, -- FK adicionada mais abaixo (bloco "FKs CRUZADAS")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Regra 6 (obrigatória): valor sempre positivo; o lado (D/C) é quem carrega o sinal.
  constraint chk_journal_entry_lines_amount_positive check (amount > 0)
);
comment on table journal_entry_lines is 'Item do lançamento: uma linha de débito ou crédito contra uma conta. "reconciled"/"bank_statement_line_id" espelham o estado atual da conciliação bancária; bank_reconciliations guarda o histórico do evento de (des)conciliação.';

create trigger trg_journal_entry_lines_updated_at before update on journal_entry_lines
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 9 — TABELAS: BANCOS & CONCILIAÇÃO
-- =====================================================================================

create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  chart_account_id uuid not null references chart_accounts(id),
  bank_name text,
  agency text,
  account_number text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);
comment on table bank_accounts is 'Conta bancária operacional, sempre vinculada a uma conta do plano de contas (chart_account_id).';

create trigger trg_bank_accounts_updated_at before update on bank_accounts
  for each row execute function set_updated_at();


create table bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  file_name text,
  status import_status not null default 'PROCESSING',
  message text,
  records_created int not null default 0,
  records_ignored int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table bank_statement_imports is 'Lote de importação de extrato (CSV/OFX/texto colado).';


create table bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  bank_statement_import_id uuid references bank_statement_imports(id),
  entry_date date not null,
  description text not null,
  amount numeric(18,2) not null,
  hash text not null,
  reconciled boolean not null default false,
  journal_entry_line_id uuid references journal_entry_lines(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Regra 10 (obrigatória): hash anti-duplicidade por conta bancária.
  unique (bank_account_id, hash)
);
comment on table bank_statement_lines is 'Item de extrato bancário. "hash" = empresa+conta+data+valor+descrição normalizada, calculado pela aplicação antes do INSERT, para bloquear reimportação do mesmo extrato.';

create trigger trg_bank_statement_lines_updated_at before update on bank_statement_lines
  for each row execute function set_updated_at();


create table bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  bank_statement_line_id uuid not null references bank_statement_lines(id) on delete cascade,
  journal_entry_line_id uuid not null references journal_entry_lines(id) on delete cascade,
  reconciled_at timestamptz not null default now(),
  reconciled_by uuid references auth.users(id),
  unreconciled_at timestamptz,
  unreconciled_by uuid references auth.users(id)
);
comment on table bank_reconciliations is 'Histórico de eventos de conciliação/desconciliação — trilha de auditoria própria, complementar aos campos denormalizados em journal_entry_lines e bank_statement_lines (que guardam só o estado atual).';


-- =====================================================================================
-- BLOCO 10 — TABELAS: FISCAL
-- =====================================================================================

create table fiscal_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  file_name text,
  hash text not null,
  status import_status not null default 'PROCESSING',
  message text,
  records_created int not null default 0,
  records_ignored int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  -- Regra 10 (obrigatória): hash anti-duplicidade de importação por empresa.
  unique (company_id, hash)
);
comment on table fiscal_imports is 'Lote de importação de XML fiscal (NF-e/CT-e/NFS-e), individual ou em massa.';


create table fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  establishment_id uuid references establishments(id),
  fiscal_import_id uuid references fiscal_imports(id),
  direction fiscal_direction not null,
  document_type fiscal_document_type not null,
  issue_date date,
  competence date,
  number text,
  series text,
  access_key text,
  partner_id uuid references partners(id),
  description text,
  cfop text,
  cst_pis text,
  cst_cofins text,
  operation_nature text,
  document_amount numeric(18,2) not null default 0,
  merchandise_amount numeric(18,2),
  discount_amount numeric(18,2),
  freight_amount numeric(18,2),
  insurance_amount numeric(18,2),
  other_expenses_amount numeric(18,2),
  pis_base numeric(18,2),
  pis_rate numeric(7,4),
  pis_amount numeric(18,2),
  pis_creditable boolean not null default false,
  cofins_base numeric(18,2),
  cofins_rate numeric(7,4),
  cofins_amount numeric(18,2),
  cofins_creditable boolean not null default false,
  iss_base numeric(18,2),
  iss_rate numeric(7,4),
  iss_amount numeric(18,2),
  icms_base numeric(18,2),
  icms_rate numeric(7,4),
  icms_amount numeric(18,2),
  payment_method text,
  financial_account_id uuid references chart_accounts(id),
  offset_account_id uuid references chart_accounts(id),
  cost_center_id uuid references cost_centers(id),
  status generic_status not null default 'DRAFT',
  journal_entry_id uuid references journal_entries(id),
  import_hash text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);
comment on table fiscal_documents is 'Documento fiscal de entrada/saída (NF-e/CT-e/NFS-e). "access_key" é a chave primária de deduplicação; "import_hash" é a rede de segurança quando a chave não pôde ser extraída do XML.';
comment on column fiscal_documents.offset_account_id is 'Conta de contrapartida (receita/custo/despesa) definida na classificação do documento.';

create trigger trg_fiscal_documents_updated_at before update on fiscal_documents
  for each row execute function set_updated_at();

-- Regra 10 (obrigatória): chave de acesso única por empresa, quando informada.
create unique index uq_fiscal_documents_access_key on fiscal_documents (company_id, access_key)
  where access_key is not null;


create table fiscal_document_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  fiscal_document_id uuid not null references fiscal_documents(id) on delete cascade,
  description text,
  cfop text,
  ncm text,
  quantity numeric(18,4),
  unit_amount numeric(18,4),
  total_amount numeric(18,2),
  created_at timestamptz not null default now()
);
comment on table fiscal_document_items is 'Linha de item/produto dentro de um documento fiscal (quando o XML detalha múltiplos itens).';


create table tax_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  tax_type obligation_type not null,
  competence date not null,
  gross_revenue numeric(18,2),
  deductions numeric(18,2),
  credits numeric(18,2),
  base_amount numeric(18,2),
  rate numeric(7,4),
  amount_due numeric(18,2),
  status generic_status not null default 'DRAFT',
  journal_entry_id uuid references journal_entries(id),
  calculation_memory jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  -- Regra 10 (obrigatória): uma apuração por empresa + competência + tributo.
  unique (company_id, competence, tax_type)
);
comment on table tax_assessments is 'Apuração mensal de PIS/COFINS/ICMS/ISS. Reaproveita o enum obligation_type (mesmo domínio de tributos) em vez de criar um enum próprio duplicado. "calculation_memory" guarda a memória de cálculo completa e imprimível.';

create trigger trg_tax_assessments_updated_at before update on tax_assessments
  for each row execute function set_updated_at();


create table tax_assessment_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  tax_assessment_id uuid not null references tax_assessments(id) on delete cascade,
  fiscal_document_id uuid references fiscal_documents(id),
  description text,
  base_amount numeric(18,2),
  amount numeric(18,2),
  created_at timestamptz not null default now()
);
comment on table tax_assessment_lines is 'Detalhamento de uma apuração fiscal por documento/lançamento de origem.';


-- =====================================================================================
-- BLOCO 11 — TABELAS: FOLHA
-- =====================================================================================

create table payroll_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  competence date not null,
  description text not null,
  cost_center_id uuid references cost_centers(id),
  status generic_status not null default 'DRAFT',
  origin text not null default 'MANUAL' check (origin in ('MANUAL', 'ESOCIAL_XML')),
  totals jsonb,
  journal_entry_id uuid references journal_entries(id),
  import_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  constraint chk_payroll_summaries_competence_first_day check (competence = date_trunc('month', competence)::date)
);
comment on table payroll_summaries is 'Resumo de folha por competência, sem cadastro de funcionário — mesmo modelo validado no protótipo. "totals" replica o objeto de totais (vencimentos/descontos/líquido/FGTS/INSS/IRRF).';

create trigger trg_payroll_summaries_updated_at before update on payroll_summaries
  for each row execute function set_updated_at();

-- Regra 10 (obrigatória, com ADAPTAÇÃO — ver "pontos a revisar" na resposta):
-- a especificação v1.1 permite MAIS DE UM resumo por competência (ex.: um por centro de
-- custo). Uma unicidade estrita em (company_id, competence) quebraria esse fluxo já
-- validado no protótipo. Em vez disso, a unicidade abaixo impede o caso real de
-- duplicidade (reimportar/recriar o mesmo resumo com a mesma descrição na competência).
create unique index uq_payroll_summaries_company_competence_desc on payroll_summaries (company_id, competence, description);


create table payroll_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  payroll_summary_id uuid not null references payroll_summaries(id) on delete cascade,
  item_type text not null check (item_type in ('VENCIMENTO', 'DESCONTO', 'ENCARGO_EMPRESA', 'PROVISAO', 'LIQUIDO', 'INFORMATIVO')),
  rubric_code text,
  rubric_description text,
  amount numeric(18,2) not null,
  debit_account_id uuid references chart_accounts(id),
  credit_account_id uuid references chart_accounts(id),
  cost_center_id uuid references cost_centers(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table payroll_lines is 'Rubrica de um resumo de folha. item_type não virou enum de banco por não constar na lista de 23 enums solicitados — mantido como texto + CHECK para não introduzir um tipo fora do escopo pedido.';

create trigger trg_payroll_lines_updated_at before update on payroll_lines
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 12 — TABELAS: OBRIGAÇÕES (criada antes de payroll_payments, que a referencia)
-- =====================================================================================

create table obligations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  obligation_type obligation_type not null,
  competence date not null,
  amount numeric(18,2) not null,
  due_date date not null,
  status obligation_status not null default 'PENDING',
  origin_assessment_id uuid,
  origin_assessment_table text check (origin_assessment_table in ('tax_assessments', 'payroll_summaries', 'income_tax_assessments')),
  provision_journal_entry_id uuid references journal_entries(id),
  payment_journal_entry_id uuid references journal_entries(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint chk_obligations_competence_first_day check (competence = date_trunc('month', competence)::date)
);
comment on table obligations is 'Guia/obrigação consolidada (PIS/COFINS/IRPJ/CSLL/FGTS/INSS/ISS/ICMS), alimentada pelas apurações de Fiscal, Folha e IRPJ/CSLL. "origin_assessment_id" é polimórfico — a tabela de origem vem em "origin_assessment_table" (sem FK física, documentado, mesmo padrão de journal_entries.origin_id).';

create trigger trg_obligations_updated_at before update on obligations
  for each row execute function set_updated_at();


create table payroll_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  competence date not null,
  payment_type text not null check (payment_type in ('LIQUIDO', 'FGTS', 'INSS', 'IRRF')),
  amount numeric(18,2) not null,
  bank_account_id uuid references bank_accounts(id),
  obligation_id uuid references obligations(id),
  journal_entry_id uuid references journal_entries(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint chk_payroll_payments_competence_first_day check (competence = date_trunc('month', competence)::date)
);
comment on table payroll_payments is 'Pagamento de líquido de salários, FGTS, INSS ou IRRF sobre a folha de uma competência.';


-- =====================================================================================
-- BLOCO 13 — TABELAS: PATRIMÔNIO / IMOBILIZADO
-- =====================================================================================

create table asset_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  default_useful_life_months int not null,
  default_annual_rate numeric(7,4),
  default_asset_account_id uuid references chart_accounts(id),
  default_depreciation_account_id uuid references chart_accounts(id),
  default_expense_account_id uuid references chart_accounts(id),
  depreciation_start_rule text not null default 'NEXT_MONTH' check (depreciation_start_rule in ('SAME_MONTH', 'NEXT_MONTH')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);
comment on table asset_categories is 'Categoria patrimonial com valores padrão de vida útil, taxa e contas — usada como regra de sugestão ao cadastrar um bem novo.';

create trigger trg_asset_categories_updated_at before update on asset_categories
  for each row execute function set_updated_at();


create table fixed_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  category_id uuid not null references asset_categories(id),
  asset_principal_id uuid references fixed_assets(id),
  description text not null,
  asset_tag text,
  acquisition_date date not null,
  acquisition_amount numeric(18,2) not null,
  residual_amount numeric(18,2) not null default 0,
  useful_life_months int not null,
  fiscal_useful_life_months int,
  depreciation_method depreciation_method not null default 'STRAIGHT_LINE',
  depreciation_start_rule text not null default 'NEXT_MONTH' check (depreciation_start_rule in ('SAME_MONTH', 'NEXT_MONTH')),
  fiscal_document_id uuid references fiscal_documents(id),
  partner_id uuid references partners(id),
  asset_account_id uuid not null references chart_accounts(id),
  depreciation_account_id uuid not null references chart_accounts(id),
  expense_account_id uuid not null references chart_accounts(id),
  cost_center_id uuid references cost_centers(id),
  status asset_status not null default 'DRAFT',
  acquisition_journal_entry_id uuid references journal_entries(id),
  disposal_date date,
  disposal_amount numeric(18,2),
  disposal_reason text,
  disposal_journal_entry_id uuid references journal_entries(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  -- MVP restringe o método a STRAIGHT_LINE; os demais valores do enum existem para o
  -- pós-MVP mas ficam bloqueados por esta constraint até serem implementados.
  constraint chk_fixed_assets_mvp_method check (depreciation_method = 'STRAIGHT_LINE')
);
comment on table fixed_assets is 'Bem patrimonial. "asset_principal_id" modela componentes/melhorias vinculados a um bem principal (ex.: guincho instalado depois num veículo).';
comment on column fixed_assets.fiscal_useful_life_months is 'Vida útil fiscal (RFB), quando diverge da vida útil contábil adotada — alimenta a sugestão de ajuste em income_tax_adjustments.';

create trigger trg_fixed_assets_updated_at before update on fixed_assets
  for each row execute function set_updated_at();


create table asset_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  fixed_asset_id uuid not null references fixed_assets(id) on delete cascade,
  event_type asset_event_type not null,
  event_date date not null,
  amount numeric(18,2),
  journal_entry_id uuid references journal_entries(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table asset_events is 'Histórico de eventos do bem além da depreciação de rotina: melhoria, adição, reavaliação, impairment, baixa parcial/total, venda, reversão.';


create table asset_depreciations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  fixed_asset_id uuid not null references fixed_assets(id) on delete cascade,
  competence date not null,
  accounting_amount numeric(18,2) not null,
  fiscal_amount numeric(18,2),
  journal_entry_id uuid references journal_entries(id),
  created_at timestamptz not null default now(),
  -- Regra 10 (obrigatória): uma depreciação por bem + competência.
  unique (fixed_asset_id, competence),
  constraint chk_asset_depreciations_competence_first_day check (competence = date_trunc('month', competence)::date)
);
comment on table asset_depreciations is 'Depreciação mensal de um bem — contábil e fiscal lado a lado. A diferença entre as duas alimenta a sugestão de ajuste (adição/exclusão) na apuração de IRPJ/CSLL do período.';


-- =====================================================================================
-- BLOCO 14 — TABELAS: IRPJ / CSLL
-- =====================================================================================

create table income_tax_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  periodicity text not null check (periodicity in ('MONTHLY', 'QUARTERLY', 'ANNUAL')),
  accounting_result numeric(18,2) not null default 0,
  taxable_base numeric(18,2),
  irpj_base_rate numeric(18,2),
  irpj_surtax numeric(18,2),
  csll_rate_amount numeric(18,2),
  irpj_deductions numeric(18,2) not null default 0,
  csll_deductions numeric(18,2) not null default 0,
  irpj_due numeric(18,2),
  csll_due numeric(18,2),
  status generic_status not null default 'DRAFT',
  journal_entry_id uuid references journal_entries(id),
  calculation_memory jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  -- Regra 10 (obrigatória): uma apuração por empresa + período.
  unique (company_id, period_start, period_end),
  constraint chk_income_tax_assessments_period check (period_start <= period_end)
);
comment on table income_tax_assessments is 'Apuração de IRPJ/CSLL do Lucro Real. "irpj_surtax" já nasce pensado para ser calculado pela aplicação como R$20.000 × meses do período (regra corrigida na auditoria do protótipo), não um valor fixo por rótulo de periodicidade.';

create trigger trg_income_tax_assessments_updated_at before update on income_tax_assessments
  for each row execute function set_updated_at();


create table income_tax_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  income_tax_assessment_id uuid not null references income_tax_assessments(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('ADDITION', 'EXCLUSION', 'OFFSET')),
  description text not null,
  amount numeric(18,2) not null,
  source_table text check (source_table in ('fixed_assets', 'asset_depreciations', 'manual')),
  source_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table income_tax_adjustments is 'Adições/exclusões/compensações do Lucro Real. "source_table"/"source_id" registram quando o ajuste veio de uma sugestão automática (ex.: divergência de depreciação em asset_depreciations) em vez de digitação manual.';


-- =====================================================================================
-- BLOCO 15 — TABELAS: AUDITORIA DE PERÍODO, IMPORT LOG, LOGS GERAIS, ANEXOS
-- =====================================================================================

create table period_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  accounting_period_id uuid references accounting_periods(id),
  period_start date not null,
  period_end date not null,
  executed_at timestamptz not null default now(),
  executed_by uuid references auth.users(id),
  ok boolean not null,
  summary jsonb
);
comment on table period_audits is 'Execução da auditoria consolidada de período (somente leitura, nunca altera dados) — equivalente a auditarPeriodo(de, ate) do protótipo.';


create table period_audit_findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  period_audit_id uuid not null references period_audits(id) on delete cascade,
  severity audit_severity not null,
  category text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);
comment on table period_audit_findings is 'Um achado individual de uma execução de auditoria (ex.: "lançamento nº 120 desequilibrado", severidade CRITICAL).';


create table import_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  import_type text not null,
  file_name text,
  status import_status not null,
  message text,
  records_created int not null default 0,
  records_ignored int not null default 0,
  hash text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table import_logs is 'Log GERAL de importações da Central de Importações (fiscal, eSocial, extrato), cross-módulo — distinto de fiscal_imports, que é específico do módulo fiscal e tem FK direta com fiscal_documents.';


create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
comment on table audit_logs is 'Trilha de atividade genérica ("quem fez o quê, quando") — diferente de period_audits, que é uma checagem de consistência contábil, não um log de ações do usuário. Tabela append-only: sem updated_at/deleted_at.';


create table attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  storage_path text not null,
  file_name text,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table attachments is 'Anexo genérico (comprovante, foto de bem, XML original) apontando para um caminho no Supabase Storage. Referência polimórfica via entity_type/entity_id.';


-- =====================================================================================
-- BLOCO 16 — TABELA: PERMISSÕES (extensibilidade pós-MVP)
-- =====================================================================================

create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_scope text not null check (role_scope in ('WORKSPACE', 'COMPANY')),
  role_name text not null,
  permission_key text not null,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_scope, role_name, permission_key)
);
comment on table role_permissions is 'Catálogo GLOBAL de permissões por papel — extensibilidade pós-MVP sobre os papéis fixos (workspace_role/company_role) do MVP. Não pertence a nenhum workspace.';

create trigger trg_role_permissions_updated_at before update on role_permissions
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 17 — FKs CRUZADAS (resolvendo a única dependência circular do schema)
-- =====================================================================================

alter table journal_entry_lines
  add constraint fk_journal_entry_lines_bank_statement_line
  foreign key (bank_statement_line_id) references bank_statement_lines(id);


-- =====================================================================================
-- BLOCO 18 — FUNÇÕES DE VALIDAÇÃO E TRIGGERS DE INTEGRIDADE CONTÁBIL
-- =====================================================================================

-- Função utilitária pedida explicitamente: lança exceção se a conta não existe, é
-- sintética ou está inativa. Reaproveitada pelo trigger de journal_entry_lines abaixo.
create or replace function assert_account_accepts_entries(p_account_id uuid)
returns void
language plpgsql
as $$
declare
  v_account chart_accounts%rowtype;
begin
  select * into v_account from chart_accounts where id = p_account_id;

  if not found then
    raise exception 'Conta contábil % não existe.', p_account_id
      using errcode = '23503';
  end if;

  if v_account.is_synthetic then
    raise exception 'Conta % (%) é sintética e não aceita lançamento direto.', v_account.code, v_account.name
      using errcode = '23514';
  end if;

  if not v_account.accepts_entries then
    raise exception 'Conta % (%) está marcada como accepts_entries = false.', v_account.code, v_account.name
      using errcode = '23514';
  end if;

  if not v_account.is_active then
    raise exception 'Conta % (%) está inativa.', v_account.code, v_account.name
      using errcode = '23514';
  end if;
end;
$$;

comment on function assert_account_accepts_entries(uuid) is 'Lança exceção se a conta não existir, for sintética, tiver accepts_entries=false ou estiver inativa. Regra 4 obrigatória.';


-- Função utilitária pedida explicitamente: lança exceção se o período (mês da data
-- informada) estiver fechado para a empresa. Competência sem accounting_periods
-- cadastrado é tratada como aberta (mesma tolerância do protótipo).
create or replace function assert_period_open(p_company_id uuid, p_date date)
returns void
language plpgsql
as $$
declare
  v_status period_status;
begin
  select status into v_status
  from accounting_periods
  where company_id = p_company_id
    and competence = date_trunc('month', p_date)::date;

  if found and v_status = 'CLOSED' then
    raise exception 'Período % da empresa % está FECHADO.', date_trunc('month', p_date)::date, p_company_id
      using errcode = '23514';
  end if;
end;
$$;

comment on function assert_period_open(uuid, date) is 'Lança exceção se o período estiver CLOSED. Regra 8 obrigatória.';


-- Função utilitária pedida explicitamente: soma débitos/créditos de um lançamento e
-- retorna true apenas se estiverem equilibrados (dentro de 1 centavo de tolerância).
create or replace function validate_journal_entry_balance(p_entry_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_debit numeric(18,2);
  v_credit numeric(18,2);
begin
  select
    coalesce(sum(amount) filter (where debit_credit = 'DEBIT'), 0),
    coalesce(sum(amount) filter (where debit_credit = 'CREDIT'), 0)
  into v_debit, v_credit
  from journal_entry_lines
  where journal_entry_id = p_entry_id;

  return abs(v_debit - v_credit) < 0.01;
end;
$$;

comment on function validate_journal_entry_balance(uuid) is 'Retorna true se débito = crédito no lançamento. Usada pelo trigger de POSTED e disponível para chamadas avulsas.';


-- Trigger de journal_entry_lines: valida a conta (regra 4) e a consistência de
-- company_id entre lançamento/conta/linha (regra 11).
create or replace function fn_validate_journal_entry_line()
returns trigger
language plpgsql
as $$
declare
  v_entry_company_id uuid;
  v_account_company_id uuid;
  v_entry_status journal_status;
begin
  perform assert_account_accepts_entries(new.account_id);

  select company_id, status into v_entry_company_id, v_entry_status
  from journal_entries where id = new.journal_entry_id;

  if v_entry_company_id is null then
    raise exception 'Lançamento % não encontrado.', new.journal_entry_id;
  end if;

  if v_entry_company_id <> new.company_id then
    raise exception 'company_id da linha (%) diverge do lançamento (%).', new.company_id, v_entry_company_id
      using errcode = '23514';
  end if;

  select company_id into v_account_company_id from chart_accounts where id = new.account_id;
  if v_account_company_id <> new.company_id then
    raise exception 'company_id da linha (%) diverge da conta (%).', new.company_id, v_account_company_id
      using errcode = '23514';
  end if;

  -- Regra 7 (obrigatória): não permite alterar linhas de um lançamento já POSTED/REVERSED,
  -- exceto quando a sessão está marcada como "mutação controlada" (bypass administrativo
  -- reservado para ferramentas de correção/migração — nenhuma função deste schema usa
  -- hoje, ver "pontos a revisar"). DELETE é tratado à parte por fn_protect_journal_entry_line_delete,
  -- já que um trigger BEFORE UPDATE/INSERT não dispara em DELETE.
  if tg_op = 'UPDATE' and v_entry_status in ('POSTED', 'REVERSED')
     and coalesce(current_setting('app.allow_ledger_mutation', true), 'off') <> 'on' then
    raise exception 'Não é permitido alterar linhas de um lançamento %.', v_entry_status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger trg_journal_entry_lines_validate
  before insert or update on journal_entry_lines
  for each row execute function fn_validate_journal_entry_line();

-- DELETE físico de linha também precisa respeitar a mesma trava (o trigger acima só
-- cobre INSERT/UPDATE porque BEFORE DELETE não tem NEW; tratamos DELETE à parte).
create or replace function fn_protect_journal_entry_line_delete()
returns trigger
language plpgsql
as $$
declare
  v_entry_status journal_status;
begin
  select status into v_entry_status from journal_entries where id = old.journal_entry_id;
  if v_entry_status in ('POSTED', 'REVERSED')
     and coalesce(current_setting('app.allow_ledger_mutation', true), 'off') <> 'on' then
    raise exception 'Não é permitido excluir linha de um lançamento %.', v_entry_status
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger trg_journal_entry_lines_protect_delete
  before delete on journal_entry_lines
  for each row execute function fn_protect_journal_entry_line_delete();


-- Trigger de journal_entries: valida saldo ao efetivar (regra 5), bloqueia edição de
-- lançamento POSTED/REVERSED fora do caminho controlado (regra 7), e bloqueia
-- lançar em período fechado (regra 8).
create or replace function fn_validate_journal_entry()
returns trigger
language plpgsql
as $$
begin
  -- Regra 8: sempre que a data efetiva/competência é definida ou alterada, período deve
  -- estar aberto (aplica-se tanto na criação quanto em qualquer atualização).
  perform assert_period_open(new.company_id, new.entry_date);

  -- Regra 5: só pode entrar em POSTED se estiver equilibrado.
  if new.status = 'POSTED' and (tg_op = 'INSERT' or old.status is distinct from 'POSTED') then
    if not validate_journal_entry_balance(new.id) then
      raise exception 'Lançamento % está desequilibrado — débito e crédito não batem.', new.id
        using errcode = '23514';
    end if;
  end if;

  -- Regra 7: bloqueia alteração de campos de um lançamento já POSTED/REVERSED, exceto
  -- pela função controlada de estorno (que seta app.allow_ledger_mutation = 'on').
  if tg_op = 'UPDATE' and old.status in ('POSTED', 'REVERSED')
     and coalesce(current_setting('app.allow_ledger_mutation', true), 'off') <> 'on' then
    if new.entry_date is distinct from old.entry_date
       or new.competence is distinct from old.competence
       or new.description is distinct from old.description
       or new.document is distinct from old.document
       or new.partner_id is distinct from old.partner_id
       or new.origin is distinct from old.origin
       or new.origin_id is distinct from old.origin_id
       or (new.status is distinct from old.status and not (old.status = 'POSTED' and new.status = 'REVERSED')) then
      raise exception 'Lançamento % (%) só pode ser alterado via função de estorno controlada.', new.id, old.status
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_journal_entries_validate
  before insert or update on journal_entries
  for each row execute function fn_validate_journal_entry();


-- Trigger de accounting_periods: fechamento em cascata (regra 13) — não permite fechar
-- a competência atual se a competência anterior existir e não estiver CLOSED.
create or replace function fn_assert_previous_period_closed()
returns trigger
language plpgsql
as $$
declare
  v_previous_status period_status;
begin
  if new.status = 'CLOSED' and (tg_op = 'INSERT' or old.status is distinct from 'CLOSED') then
    select status into v_previous_status
    from accounting_periods
    where company_id = new.company_id
      and competence = (new.competence - interval '1 month')::date;

    if found and v_previous_status <> 'CLOSED' then
      raise exception 'Não é possível fechar % — a competência anterior ainda não está fechada.', new.competence
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_accounting_periods_cascade_close
  before insert or update on accounting_periods
  for each row execute function fn_assert_previous_period_closed();


-- Trigger de chart_accounts: garante que parent_id (quando informado) pertence à
-- mesma empresa — extensão natural da regra 11, não pedida literalmente mas necessária
-- para a hierarquia do plano de contas fazer sentido.
create or replace function fn_validate_chart_account_parent()
returns trigger
language plpgsql
as $$
declare
  v_parent_company_id uuid;
begin
  if new.parent_id is not null then
    select company_id into v_parent_company_id from chart_accounts where id = new.parent_id;
    if v_parent_company_id is distinct from new.company_id then
      raise exception 'Conta pai % pertence a outra empresa.', new.parent_id
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_chart_accounts_validate_parent
  before insert or update on chart_accounts
  for each row execute function fn_validate_chart_account_parent();


-- Trigger de asset_events / asset_depreciations: impede company_id divergente do bem
-- (regra 12 obrigatória).
create or replace function fn_validate_asset_child_company()
returns trigger
language plpgsql
as $$
declare
  v_asset_company_id uuid;
begin
  select company_id into v_asset_company_id from fixed_assets where id = new.fixed_asset_id;
  if v_asset_company_id is distinct from new.company_id then
    raise exception 'company_id (%) diverge do bem patrimonial (%).', new.company_id, v_asset_company_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_asset_events_validate_company
  before insert or update on asset_events
  for each row execute function fn_validate_asset_child_company();

create trigger trg_asset_depreciations_validate_company
  before insert or update on asset_depreciations
  for each row execute function fn_validate_asset_child_company();


-- Função pedida explicitamente: reverte um lançamento POSTED criando um lançamento
-- inverso (nunca apaga o original). Implementação completa (não-stub): o algoritmo é
-- direto e já foi validado em produto no protótipo (estornarLancamentoPorReversao()).
create or replace function reverse_journal_entry(p_entry_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  v_original journal_entries%rowtype;
  v_new_id uuid;
  v_next_number bigint;
begin
  select * into v_original from journal_entries where id = p_entry_id for update;

  if not found then
    raise exception 'Lançamento % não encontrado.', p_entry_id;
  end if;

  if v_original.status <> 'POSTED' then
    raise exception 'Só é possível estornar um lançamento POSTED (status atual: %).', v_original.status;
  end if;

  perform assert_period_open(v_original.company_id, v_original.entry_date);

  select coalesce(max(number), 0) + 1 into v_next_number
  from journal_entries where company_id = v_original.company_id;

  v_new_id := gen_random_uuid();

  -- Insere o cabeçalho do estorno como DRAFT (não POSTED) de propósito: se inseríssemos
  -- já como POSTED, o trigger de equilíbrio validaria contra ZERO linhas (ainda não
  -- inseridas) e passaria trivialmente (0 = 0), sem checar nada de verdade. Ao inserir
  -- como DRAFT, depois as linhas, e só então subir para POSTED via UPDATE, o trigger
  -- valida o equilíbrio real das linhas espelhadas.
  insert into journal_entries (
    id, workspace_id, company_id, establishment_id, number, entry_date, competence,
    description, document, partner_id, origin, origin_id, status, reversal_of_id, notes
  ) values (
    v_new_id, v_original.workspace_id, v_original.company_id, v_original.establishment_id,
    v_next_number, v_original.entry_date, v_original.competence,
    'ESTORNO — ' || v_original.description, v_original.document, v_original.partner_id,
    'REVERSAL', v_original.id, 'DRAFT', v_original.id, coalesce(p_reason, 'Estorno do lançamento nº ' || v_original.number)
  );

  insert into journal_entry_lines (workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo, cost_center_id)
  select
    workspace_id, company_id, v_new_id, account_id,
    case debit_credit when 'DEBIT' then 'CREDIT'::debit_credit else 'DEBIT'::debit_credit end,
    amount, memo, cost_center_id
  from journal_entry_lines
  where journal_entry_id = v_original.id;

  update journal_entries set status = 'POSTED' where id = v_new_id;

  -- Transição POSTED -> REVERSED do original: permitida sem precisar de nenhum bypass,
  -- porque o guard da regra 7 (fn_validate_journal_entry) já abre uma exceção explícita
  -- exatamente para este caso (ver comentário na função).
  update journal_entries
    set status = 'REVERSED', reversed_by_entry_id = v_new_id
    where id = v_original.id;

  return v_new_id;
end;
$$;

comment on function reverse_journal_entry(uuid, text) is 'Estorna um lançamento POSTED por reversão (nunca apaga o original). SECURITY DEFINER para poder rodar como rotina de sistema independente do papel de quem chama; não precisa do bypass app.allow_ledger_mutation porque a transição POSTED->REVERSED do original e o ciclo DRAFT->POSTED do novo lançamento já são permitidos pelas regras normais dos triggers.';


-- =====================================================================================
-- BLOCO 19 — updated_at TRIGGERS PARA TABELAS AINDA NÃO COBERTAS ACIMA
-- =====================================================================================
-- (fiscal_document_items, tax_assessment_lines, bank_statement_imports, asset_events,
--  asset_depreciations, payroll_payments, period_audits, period_audit_findings,
--  import_logs, audit_logs, attachments não têm updated_at por serem tabelas de
--  detalhe/log — só o cabeçalho é editável depois de criado. income_tax_adjustments
--  idem.)


-- =====================================================================================
-- BLOCO 20 — VIEWS
-- =====================================================================================

create or replace view view_posted_journal_lines as
select
  jel.id as journal_entry_line_id,
  je.id as journal_entry_id,
  je.workspace_id,
  je.company_id,
  je.number,
  je.entry_date,
  je.competence,
  je.description,
  je.origin,
  je.origin_id,
  jel.account_id,
  ca.code as account_code,
  ca.name as account_name,
  ca.normal_balance,
  jel.debit_credit,
  jel.amount,
  jel.cost_center_id
from journal_entry_lines jel
join journal_entries je on je.id = jel.journal_entry_id
join chart_accounts ca on ca.id = jel.account_id
where je.status = 'POSTED';

comment on view view_posted_journal_lines is 'Linhas de lançamento apenas de lançamentos POSTED, já com os dados da conta — base para relatórios (Razão/Balancete/DRE/BP).';


create or replace view account_movements_view as
select
  company_id,
  account_id,
  competence,
  sum(amount) filter (where debit_credit = 'DEBIT') as debit_total,
  sum(amount) filter (where debit_credit = 'CREDIT') as credit_total
from view_posted_journal_lines
group by company_id, account_id, competence;

comment on view account_movements_view is 'Movimento agregado (débito/crédito) por empresa, conta e competência — substitui, em SQL, o recálculo O(n²) em memória do protótipo.';


-- =====================================================================================
-- BLOCO 21 — FUNÇÃO DE SALDO (get_account_balance)
-- =====================================================================================
-- Replica a lógica validada no protótipo (calcularSaldosContas/saldoContaAteData):
-- soma o movimento de TODAS as contas analíticas cujo código começa com o código da
-- conta informada (isso cobre tanto contas sintéticas — que agregam descendentes —
-- quanto contas analíticas — que "agregam" apenas a si mesmas), até uma data-limite,
-- aplicando o sinal conforme normal_balance.

create or replace function get_account_balance(p_company_id uuid, p_account_id uuid, p_as_of_date date)
returns numeric(18,2)
language plpgsql
stable
as $$
declare
  v_code text;
  v_normal_balance normal_balance;
  v_debit numeric(18,2);
  v_credit numeric(18,2);
begin
  select code, normal_balance into v_code, v_normal_balance
  from chart_accounts where id = p_account_id and company_id = p_company_id;

  if not found then
    raise exception 'Conta % não encontrada na empresa %.', p_account_id, p_company_id;
  end if;

  select
    coalesce(sum(jel.amount) filter (where jel.debit_credit = 'DEBIT'), 0),
    coalesce(sum(jel.amount) filter (where jel.debit_credit = 'CREDIT'), 0)
  into v_debit, v_credit
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join chart_accounts ca on ca.id = jel.account_id
  where je.company_id = p_company_id
    and je.status = 'POSTED'
    and je.entry_date <= p_as_of_date
    and (ca.id = p_account_id or ca.code like v_code || '.%');

  if v_normal_balance = 'DEBIT' then
    return v_debit - v_credit;
  else
    return v_credit - v_debit;
  end if;
end;
$$;

comment on function get_account_balance(uuid, uuid, date) is 'Saldo de uma conta (sintética ou analítica) até uma data, com sinal já aplicado pela natureza. Equivale a saldoContaAteData()/calcularSaldosContas() do protótipo, agora em SQL agregado em vez de recálculo em memória.';


-- =====================================================================================
-- BLOCO 22 — ÍNDICES
-- =====================================================================================

-- workspace_id / company_id (praticamente toda tabela de negócio)
create index idx_companies_workspace on companies (workspace_id);
create index idx_establishments_company on establishments (company_id);
create index idx_cost_centers_company on cost_centers (company_id);
create index idx_partners_company on partners (company_id);
create index idx_chart_accounts_company on chart_accounts (company_id);
create index idx_accounting_rules_company on accounting_rules (company_id);
create index idx_accounting_periods_company on accounting_periods (company_id);

-- competence / entry_date
create index idx_accounting_periods_competence on accounting_periods (company_id, competence);
create index idx_journal_entries_competence on journal_entries (company_id, competence);
create index idx_journal_entries_entry_date on journal_entries (company_id, entry_date);
create index idx_fiscal_documents_competence on fiscal_documents (company_id, competence);
create index idx_tax_assessments_competence on tax_assessments (company_id, competence);
create index idx_payroll_summaries_competence on payroll_summaries (company_id, competence);
create index idx_obligations_competence on obligations (company_id, competence);
create index idx_asset_depreciations_competence on asset_depreciations (company_id, competence);

-- account_id
create index idx_journal_entry_lines_account on journal_entry_lines (account_id);
create index idx_journal_entry_lines_entry on journal_entry_lines (journal_entry_id);
create index idx_journal_entry_lines_company on journal_entry_lines (company_id);

-- origin / origin_id (rastreabilidade)
create index idx_journal_entries_origin on journal_entries (company_id, origin, origin_id);

-- status
create index idx_journal_entries_status on journal_entries (company_id, status);
create index idx_fiscal_documents_status on fiscal_documents (company_id, status);
create index idx_payroll_summaries_status on payroll_summaries (company_id, status);
create index idx_obligations_status on obligations (company_id, status);
create index idx_fixed_assets_status on fixed_assets (company_id, status);

-- fiscal: chave de acesso já tem índice único (bloco 10); reforço de busca simples
create index idx_fiscal_documents_partner on fiscal_documents (partner_id);

-- hashes de importação/extrato (unicidade já cria índice; aqui só os campos de apoio)
create index idx_bank_statement_lines_account_date on bank_statement_lines (bank_account_id, entry_date);
create index idx_bank_statement_lines_reconciled on bank_statement_lines (bank_account_id, reconciled);

-- patrimônio por status/categoria
create index idx_fixed_assets_category on fixed_assets (company_id, category_id);
create index idx_fixed_assets_principal on fixed_assets (asset_principal_id);

-- obrigações por vencimento/status
create index idx_obligations_due_date on obligations (company_id, due_date, status);

-- auditoria por entidade/data
create index idx_audit_logs_entity on audit_logs (company_id, entity_type, entity_id);
create index idx_audit_logs_created_at on audit_logs (workspace_id, created_at);
create index idx_period_audit_findings_audit on period_audit_findings (period_audit_id);
create index idx_attachments_entity on attachments (company_id, entity_type, entity_id);


-- =====================================================================================
-- BLOCO 23 — ROW LEVEL SECURITY (habilitação apenas — policies na próxima etapa)
-- =====================================================================================
-- Habilitamos RLS em TODAS as tabelas, inclusive nos catálogos globais
-- (account_templates, account_template_lines, role_permissions): mesmo sendo dados
-- compartilhados e não sensíveis por empresa, a prática recomendada do Supabase é
-- nunca deixar uma tabela em public sem RLS habilitada. A policy que virá na próxima
-- etapa para essas três será simplesmente "SELECT liberado para qualquer usuário
-- autenticado, INSERT/UPDATE/DELETE restrito a um papel de administração global".
-- Para as demais tabelas, a policy futura seguirá o padrão: linha visível/editável
-- apenas se o usuário autenticado pertence (via workspace_users/company_users) ao
-- workspace_id/company_id daquela linha.

alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_users enable row level security;
alter table account_templates enable row level security;
alter table companies enable row level security;
alter table company_users enable row level security;
alter table establishments enable row level security;
alter table cost_centers enable row level security;
alter table partners enable row level security;
alter table account_template_lines enable row level security;
alter table chart_accounts enable row level security;
alter table accounting_rules enable row level security;
alter table accounting_periods enable row level security;
alter table journal_entries enable row level security;
alter table journal_entry_lines enable row level security;
alter table bank_accounts enable row level security;
alter table bank_statement_imports enable row level security;
alter table bank_statement_lines enable row level security;
alter table bank_reconciliations enable row level security;
alter table fiscal_imports enable row level security;
alter table fiscal_documents enable row level security;
alter table fiscal_document_items enable row level security;
alter table tax_assessments enable row level security;
alter table tax_assessment_lines enable row level security;
alter table payroll_summaries enable row level security;
alter table payroll_lines enable row level security;
alter table obligations enable row level security;
alter table payroll_payments enable row level security;
alter table asset_categories enable row level security;
alter table fixed_assets enable row level security;
alter table asset_events enable row level security;
alter table asset_depreciations enable row level security;
alter table income_tax_assessments enable row level security;
alter table income_tax_adjustments enable row level security;
alter table period_audits enable row level security;
alter table period_audit_findings enable row level security;
alter table import_logs enable row level security;
alter table audit_logs enable row level security;
alter table attachments enable row level security;
alter table role_permissions enable row level security;

-- Nenhuma policy é criada nesta migração — todas as tabelas acima ficam, a partir daqui,
-- com RLS habilitada e SEM policies, o que por padrão do Postgres BLOQUEIA todo acesso
-- (inclusive do dono, exceto via service_role). Isso é intencional: o schema fica "seguro
-- por padrão" até a etapa seguinte definir as policies de leitura/escrita.


-- =====================================================================================
-- FIM DO SCHEMA
-- =====================================================================================
