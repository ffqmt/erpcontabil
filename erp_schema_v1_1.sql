-- =====================================================================================
-- ERP CONTÁBIL — SCHEMA POSTGRESQL / SUPABASE — v1.1
-- Baseado na Especificação Técnica & de Produto v1.1 + Auditoria Técnica do erp_schema_v1.sql
-- =====================================================================================
-- Este arquivo corrige os achados CRÍTICO/ALTO/MÉDIO da auditoria (ver relatório em
-- separado). Segue o mesmo escopo do v1: sem policies de RLS completas (apenas
-- ENABLE), sem frontend, sem Server Actions.
--
-- Mudanças em relação ao v1 (resumo — detalhes em cada bloco via comentário "AUDITORIA"):
--   - search_path fixado em toda função; grants de EXECUTE revogados de PUBLIC.
--   - Validação de saldo agora também via constraint triggers DEFERRED (pega qualquer
--     ordem de inserção, não só o caminho feliz).
--   - on delete cascade trocado por restrict nas tabelas-raiz de tenant.
--   - Numeração de lançamento via contador transacional por empresa, atribuída só no POSTED.
--   - app.allow_ledger_mutation removido.
--   - payroll_summaries ganha payroll_type; unicidade não depende mais de description.
--   - Checagem de company_id divergente estendida a fiscal_documents/payroll_lines/
--     fixed_assets/bank_accounts.
--   - Diversas constraints, triggers e índices faltantes adicionados (ver relatório).
-- =====================================================================================


-- =====================================================================================
-- BLOCO 1 — EXTENSÕES
-- =====================================================================================
create extension if not exists pgcrypto;


-- =====================================================================================
-- BLOCO 2 — ENUMS
-- =====================================================================================
-- Os 5 primeiros enums não tiveram valores literais definidos na v1.1 do produto; os
-- valores abaixo são a interpretação mais direta da especificação (ver relatório de
-- auditoria — "pontos a revisar").
--
-- AUDITORIA (B1): tax_regime é deliberadamente em PORTUGUÊS — os três valores são nomes
-- próprios de regimes tributários brasileiros (Simples Nacional, Lucro Presumido, Lucro
-- Real) sem tradução natural que um contador brasileiro reconheceria em inglês. Todos os
-- OUTROS enums do schema são em inglês. Essa é a única exceção deliberada de idioma —
-- mantida e documentada aqui para não parecer descuido.

create type workspace_role as enum ('OWNER', 'ADMIN', 'ACCOUNTANT', 'ASSISTANT');
comment on type workspace_role is 'Papel de um usuário dentro de um escritório (workspace).';

create type company_role as enum ('ACCOUNTANT', 'ASSISTANT', 'CLIENT_VIEWER');
comment on type company_role is 'Papel de um usuário dentro de uma empresa específica.';

create type tax_regime as enum ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL');
comment on type tax_regime is 'Regime tributário da empresa. Valores em PORTUGUÊS deliberadamente — nomes próprios de regimes tributários brasileiros, sem equivalente natural em inglês (exceção única de idioma neste schema).';

create type company_profile as enum ('TRANSPORTATION', 'TRADE', 'SERVICES', 'INDUSTRY', 'OTHER');
comment on type company_profile is 'Perfil de atividade da empresa, usado para selecionar o template de plano de contas.';

create type establishment_type as enum ('HEADQUARTERS', 'BRANCH');
comment on type establishment_type is 'Matriz (HEADQUARTERS) ou filial (BRANCH).';

-- AUDITORIA (M1): novo enum, substitui o text+CHECK minúsculo de workspaces.status na v1
-- (única exceção de caixa baixa no schema anterior — corrigida para o padrão UPPER_SNAKE_CASE).
create type workspace_status as enum ('ACTIVE', 'SUSPENDED', 'CANCELLED');
comment on type workspace_status is 'Status de assinatura/uso do escritório na plataforma.';

create type account_type as enum ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'REVENUE_DEDUCTION', 'COST', 'EXPENSE');
create type normal_balance as enum ('DEBIT', 'CREDIT');

create type journal_status as enum ('DRAFT', 'POSTED', 'REVERSED', 'CANCELLED', 'PENDING_CLASSIFICATION');

create type journal_origin as enum (
  'MANUAL', 'OPENING', 'FISCAL_DOCUMENT', 'FISCAL_ASSESSMENT', 'PAYROLL_SUMMARY',
  'PAYROLL_PAYMENT', 'BANK_STATEMENT', 'ASSET_ACQUISITION', 'ASSET_DEPRECIATION',
  'ASSET_DISPOSAL', 'IRPJ_CSLL', 'RESULT_CLOSING', 'REVERSAL'
);

-- debit_credit permanece distinto de normal_balance (ver comentário no v1): natureza da
-- CONTA vs. lado da LINHA são conceitos diferentes, mesmo com o mesmo domínio de valores.
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

-- AUDITORIA (A3 / correção obrigatória #4): novo enum para tipificar o resumo de folha,
-- permitindo mensal/pró-labore/13º/férias/rescisão/complementar sem depender de texto livre.
create type payroll_type as enum ('MONTHLY', 'PROLABORE', 'THIRTEENTH_SALARY', 'VACATION', 'TERMINATION', 'COMPLEMENTARY');
comment on type payroll_type is 'Tipo do resumo de folha: mensal, pró-labore, 13º salário, férias, rescisão ou complementar (ajuste/retificação de uma folha já contabilizada).';


-- =====================================================================================
-- BLOCO 3 — FUNÇÕES UTILITÁRIAS DE APOIO (usadas por triggers definidos mais abaixo)
-- =====================================================================================
-- AUDITORIA (C1 / correção obrigatória #7): toda função ganha "set search_path" fixo,
-- para não depender do search_path da sessão de quem chama (proteção contra
-- search_path hijacking, especialmente relevante nas SECURITY DEFINER).

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
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
-- AUDITORIA (C3): "on delete cascade" removido das tabelas-raiz de tenant (workspaces,
-- companies) para as tabelas que dependem delas quando essa dependência representa DADOS
-- FINANCEIROS/DE NEGÓCIO (não meros vínculos de acesso). Cascade é mantido apenas onde a
-- linha filha não tem NENHUM sentido sem o pai (ex.: um vínculo de usuário-workspace).
-- Exclusão de empresa/escritório passa a exigir RESTRICT (bloco explicitamente, forçando
-- um fluxo de soft-delete via "deleted_at" ou uma limpeza manual e consciente).

create table if not exists profiles (
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


create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  plan text not null default 'starter',
  status workspace_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz
);
comment on table workspaces is 'Escritório de contabilidade — tenant de topo. Todo o restante do sistema (empresas, usuários) pendura a partir daqui.';

create trigger trg_workspaces_updated_at before update on workspaces
  for each row execute function set_updated_at();


create table if not exists workspace_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role workspace_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);
comment on table workspace_users is 'Papel de um usuário dentro de um escritório. Cascade mantido: este vínculo não tem sentido sem o workspace ou o profile. Remoção de acesso é DELETE físico; o histórico da ação fica em audit_logs.';

create trigger trg_workspace_users_updated_at before update on workspace_users
  for each row execute function set_updated_at();


create table if not exists account_templates (
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


create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
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
comment on table companies is 'Empresa-cliente do escritório — unidade central de isolamento de dados contábeis (equivalente à "empresa ativa" do protótipo). workspace_id é ON DELETE RESTRICT: excluir um escritório com empresas ativas é bloqueado — use deleted_at para arquivar.';

create trigger trg_companies_updated_at before update on companies
  for each row execute function set_updated_at();


create table if not exists company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role company_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, profile_id)
);
comment on table company_users is 'Papel de um usuário dentro de uma empresa específica. Cascade mantido: vínculo de acesso, não dado financeiro.';

create trigger trg_company_users_updated_at before update on company_users
  for each row execute function set_updated_at();


create table if not exists establishments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
comment on table establishments is 'Matriz/filial de uma empresa. Opcional: empresas sem filial simplesmente não têm registro aqui. RESTRICT: um estabelecimento referenciado por lançamentos/documentos não pode ser removido por cascade acidental.';

create trigger trg_establishments_updated_at before update on establishments
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 5 — TABELAS: TRANSVERSAIS (centros de custo, parceiros)
-- =====================================================================================

create table if not exists cost_centers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
comment on table cost_centers is 'Centro de custo — entidade transversal referenciada por lançamentos, fiscal, folha, patrimônio e regras. RESTRICT: desativar (active=false) em vez de excluir um centro já usado.';

create trigger trg_cost_centers_updated_at before update on cost_centers
  for each row execute function set_updated_at();


create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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

create table if not exists account_template_lines (
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
comment on table account_template_lines is 'Linha "modelo" de um template de plano de contas. Aplicar um template para uma empresa COPIA estas linhas para chart_accounts (não referencia ao vivo). Cascade mantido: linha de catálogo global, não dado de empresa.';

create trigger trg_account_template_lines_updated_at before update on account_template_lines
  for each row execute function set_updated_at();


create table if not exists chart_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
  constraint chk_chart_accounts_synthetic_no_entries check (not (is_synthetic and accepts_entries)),
  constraint chk_chart_accounts_analytic_needs_reason check (is_synthetic or accepts_entries or non_entry_reason is not null)
);
comment on table chart_accounts is 'Plano de contas por empresa. "level" é derivado do código — mesma lógica de nivelContaPorCodigo() validada no protótipo. RESTRICT: conta com lançamentos não pode ser removida por cascade de empresa.';
comment on column chart_accounts.non_entry_reason is 'Obrigatório quando accepts_entries = false numa conta analítica (não sintética) — justificativa de por que essa conta não deve receber lançamento manual direto.';

create trigger trg_chart_accounts_updated_at before update on chart_accounts
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 7 — TABELAS: MOTOR DE REGRAS & PERÍODOS
-- =====================================================================================

create table if not exists accounting_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
comment on table accounting_rules is 'Motor de regras único reaproveitado nos 4 domínios (fiscal/folha/banco/patrimônio).';

create trigger trg_accounting_rules_updated_at before update on accounting_rules
  for each row execute function set_updated_at();


create table if not exists accounting_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
  -- AUDITORIA (A6): start_date/end_date agora são travados para bater EXATAMENTE com o
  -- mês da competência — fn_assert_previous_period_closed() assume "competence - 1 mês"
  -- como o período anterior, e essa suposição só é segura se todo período for
  -- exatamente um mês civil.
  constraint chk_accounting_periods_dates check (
    start_date = competence
    and end_date = (date_trunc('month', competence) + interval '1 month' - interval '1 day')::date
  )
);
comment on table accounting_periods is 'Estratégia de competência: sempre o primeiro dia do mês. start_date/end_date são travados para o mês civil exato de "competence" (regra A6 da auditoria) — nenhum período "customizado" é permitido nesta versão.';

create trigger trg_accounting_periods_updated_at before update on accounting_periods
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 8 — TABELAS: NÚCLEO DO LIVRO CONTÁBIL
-- =====================================================================================

-- AUDITORIA (A1 / correção obrigatória #2): contador transacional por empresa, usado por
-- next_journal_number() via INSERT ... ON CONFLICT DO UPDATE ... RETURNING — atômico sob
-- concorrência sem precisar de SELECT FOR UPDATE explícito (o próprio upsert serializa
-- na linha da empresa).
create table if not exists company_journal_counters (
  company_id uuid primary key references companies(id) on delete restrict,
  last_number bigint not null default 0,
  updated_at timestamptz not null default now()
);
comment on table company_journal_counters is 'Contador de numeração de lançamentos por empresa. Uma linha por empresa; incrementado atomicamente por next_journal_number().';

create trigger trg_company_journal_counters_updated_at before update on company_journal_counters
  for each row execute function set_updated_at();


create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  establishment_id uuid references establishments(id),
  -- AUDITORIA (A1): number agora é NULLABLE — só é atribuído quando o lançamento
  -- transiciona para POSTED (ver fn_validate_journal_entry). DRAFT/CANCELLED podem não
  -- ter número nunca, evitando buracos na numeração definitiva do livro.
  number bigint,
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
comment on table journal_entries is 'Cabeçalho do lançamento contábil. Não possui deleted_at: lançamento nunca é apagado — sai de circulação via CANCELLED (nunca foi POSTED) ou REVERSED (foi POSTED e revertido). "number" é NULL em DRAFT e definitivo só a partir do POSTED.';
comment on column journal_entries.origin_id is 'Referência polimórfica ao registro que originou o lançamento. Sem FK física por ser polimórfica.';
comment on column journal_entries.number is 'Numeração sequencial por empresa, atribuída atomicamente por next_journal_number() somente na transição para POSTED (nunca em DRAFT). NULL para lançamentos que nunca saíram de DRAFT/foram CANCELLED — evita buracos na numeração definitiva do livro.';

create trigger trg_journal_entries_updated_at before update on journal_entries
  for each row execute function set_updated_at();

-- AUDITORIA (M2): índice de "um único OPENING" agora só conta status ativos (DRAFT/POSTED)
-- — um OPENING revertido (REVERSED) libera a criação de um novo, corrigido.
create unique index if not exists uq_journal_entries_one_opening on journal_entries (company_id)
  where origin = 'OPENING' and status in ('DRAFT', 'POSTED');


create table if not exists journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
  constraint chk_journal_entry_lines_amount_positive check (amount > 0)
);
comment on table journal_entry_lines is 'Item do lançamento. Cascade mantido a partir de journal_entries: uma linha nunca existe sem seu lançamento, e o lançamento em si nunca é apagado fisicamente (só CANCELLED/REVERSED) — então este cascade nunca dispara em uso normal, só protege contra um hipotético DELETE administrativo do cabeçalho.';

create trigger trg_journal_entry_lines_updated_at before update on journal_entry_lines
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 9 — TABELAS: BANCOS & CONCILIAÇÃO
-- =====================================================================================

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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


create table if not exists bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  bank_account_id uuid not null references bank_accounts(id) on delete restrict,
  file_name text,
  status import_status not null default 'PROCESSING',
  message text,
  records_created int not null default 0,
  records_ignored int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table bank_statement_imports is 'Lote de importação de extrato (CSV/OFX/texto colado).';


create table if not exists bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  bank_account_id uuid not null references bank_accounts(id) on delete restrict,
  bank_statement_import_id uuid references bank_statement_imports(id),
  entry_date date not null,
  description text not null,
  amount numeric(18,2) not null,
  hash text not null,
  reconciled boolean not null default false,
  journal_entry_line_id uuid references journal_entry_lines(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_account_id, hash)
);
comment on table bank_statement_lines is 'Item de extrato bancário. "hash" = empresa+conta+data+valor+descrição normalizada, calculado pela aplicação antes do INSERT.';

create trigger trg_bank_statement_lines_updated_at before update on bank_statement_lines
  for each row execute function set_updated_at();


create table if not exists bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  bank_account_id uuid not null references bank_accounts(id) on delete restrict,
  bank_statement_line_id uuid not null references bank_statement_lines(id) on delete cascade,
  journal_entry_line_id uuid not null references journal_entry_lines(id) on delete cascade,
  reconciled_at timestamptz not null default now(),
  reconciled_by uuid references auth.users(id),
  unreconciled_at timestamptz,
  unreconciled_by uuid references auth.users(id)
);
comment on table bank_reconciliations is 'Histórico de eventos de conciliação/desconciliação — trilha própria, complementar aos campos denormalizados em journal_entry_lines e bank_statement_lines.';


-- =====================================================================================
-- BLOCO 10 — TABELAS: FISCAL
-- =====================================================================================

create table if not exists fiscal_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  -- AUDITORIA (M5): vínculo opcional com o log geral de importações, para rastreabilidade
  -- cruzada entre o registro específico do fiscal e o log cross-módulo.
  import_log_id uuid,
  file_name text,
  hash text not null,
  status import_status not null default 'PROCESSING',
  message text,
  records_created int not null default 0,
  records_ignored int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (company_id, hash)
);
comment on table fiscal_imports is 'Lote de importação de XML fiscal (NF-e/CT-e/NFS-e). import_log_id (adicionado via FK cruzada no bloco 17) liga este registro ao log geral em import_logs, quando aplicável.';


create table if not exists fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
comment on table fiscal_documents is 'Documento fiscal de entrada/saída. "access_key" é a chave primária de deduplicação; "import_hash" é a rede de segurança quando a chave não pôde ser extraída — agora com índice único de verdade (ver bloco de índices, achado A8).';
comment on column fiscal_documents.offset_account_id is 'Conta de contrapartida (receita/custo/despesa) definida na classificação do documento.';

create trigger trg_fiscal_documents_updated_at before update on fiscal_documents
  for each row execute function set_updated_at();

create unique index if not exists uq_fiscal_documents_access_key on fiscal_documents (company_id, access_key)
  where access_key is not null;

-- AUDITORIA (A8): índice único que faltava para import_hash, documentado na v1 mas nunca
-- efetivamente criado.
create unique index if not exists uq_fiscal_documents_import_hash on fiscal_documents (company_id, import_hash)
  where import_hash is not null;


create table if not exists fiscal_document_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  fiscal_document_id uuid not null references fiscal_documents(id) on delete cascade,
  description text,
  cfop text,
  ncm text,
  quantity numeric(18,4),
  unit_amount numeric(18,4),
  total_amount numeric(18,2),
  created_at timestamptz not null default now()
);
comment on table fiscal_document_items is 'Linha de item/produto dentro de um documento fiscal. Cascade mantido: item não existe sem o documento.';


create table if not exists tax_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
  unique (company_id, competence, tax_type),
  -- AUDITORIA (A5): constraint que faltava na v1 — presente em todas as outras 5 tabelas
  -- com competência, mas omitida aqui por descuido.
  constraint chk_tax_assessments_competence_first_day check (competence = date_trunc('month', competence)::date)
);
comment on table tax_assessments is 'Apuração mensal de PIS/COFINS/ICMS/ISS. Reaproveita obligation_type. "calculation_memory" guarda a memória de cálculo completa e imprimível.';

create trigger trg_tax_assessments_updated_at before update on tax_assessments
  for each row execute function set_updated_at();


create table if not exists tax_assessment_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  tax_assessment_id uuid not null references tax_assessments(id) on delete cascade,
  fiscal_document_id uuid references fiscal_documents(id),
  description text,
  base_amount numeric(18,2),
  amount numeric(18,2),
  created_at timestamptz not null default now()
);
comment on table tax_assessment_lines is 'Detalhamento de uma apuração fiscal por documento/lançamento de origem. Cascade mantido: detalhe não existe sem a apuração.';


-- =====================================================================================
-- BLOCO 11 — TABELAS: FOLHA
-- =====================================================================================

create table if not exists payroll_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  competence date not null,
  -- AUDITORIA (A3 / correção obrigatória #4): novo campo, tipifica o resumo.
  payroll_type payroll_type not null default 'MONTHLY',
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
comment on table payroll_summaries is 'Resumo de folha por competência, sem cadastro de funcionário. payroll_type distingue mensal/pró-labore/13º/férias/rescisão/complementar; description permanece só como rótulo (não é mais usada para unicidade — achado A3).';

create trigger trg_payroll_summaries_updated_at before update on payroll_summaries
  for each row execute function set_updated_at();

-- AUDITORIA (A3 / correção obrigatória #5): unicidade não depende mais de texto livre.
-- Um sentinel fixo trata cost_center_id nulo como "sem centro de custo" de forma estável
-- (NULL não colide consigo mesmo em uma UNIQUE comum do Postgres).
create unique index if not exists uq_payroll_summaries_company_competence_type_cc
  on payroll_summaries (company_id, competence, payroll_type, coalesce(cost_center_id, '00000000-0000-0000-0000-000000000000'::uuid));


create table if not exists payroll_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
comment on table payroll_lines is 'Rubrica de um resumo de folha. Cascade mantido a partir de payroll_summaries: rubrica não existe sem o resumo.';

create trigger trg_payroll_lines_updated_at before update on payroll_lines
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 12 — TABELAS: OBRIGAÇÕES
-- =====================================================================================

create table if not exists obligations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
  constraint chk_obligations_competence_first_day check (competence = date_trunc('month', competence)::date),
  -- AUDITORIA (A10 / correção relacionada a pagamento duplicado): status PAID exige o
  -- lançamento de pagamento vinculado.
  constraint chk_obligations_paid_needs_journal check (status <> 'PAID' or payment_journal_entry_id is not null)
);
comment on table obligations is 'Guia/obrigação consolidada (PIS/COFINS/IRPJ/CSLL/FGTS/INSS/ISS/ICMS). "origin_assessment_id" é polimórfico. status=PAID exige payment_journal_entry_id (achado A10); imutabilidade desse vínculo garantida por trigger (ver bloco 18).';

create trigger trg_obligations_updated_at before update on obligations
  for each row execute function set_updated_at();


create table if not exists payroll_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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

create table if not exists asset_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
comment on table asset_categories is 'Categoria patrimonial com valores padrão de vida útil, taxa e contas.';

create trigger trg_asset_categories_updated_at before update on asset_categories
  for each row execute function set_updated_at();


create table if not exists fixed_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
  -- MVP restringe o método de depreciação a STRAIGHT_LINE (linear). Os demais valores do
  -- enum depreciation_method (MANUAL, UNITS_OF_PRODUCTION, ACCELERATED) já existem no
  -- domínio para o pós-MVP, mas ficam BLOQUEADOS por esta constraint até serem
  -- implementados no motor de cálculo de depreciação — remover/relaxar esta constraint
  -- é o gatilho para liberar os métodos avançados (achado confirmado, correção obrigatória #8).
  constraint chk_fixed_assets_mvp_method check (depreciation_method = 'STRAIGHT_LINE')
);
comment on table fixed_assets is 'Bem patrimonial. "asset_principal_id" modela componentes/melhorias vinculados a um bem principal. depreciation_method travado em STRAIGHT_LINE no MVP (ver comentário na constraint chk_fixed_assets_mvp_method).';
comment on column fixed_assets.fiscal_useful_life_months is 'Vida útil fiscal (RFB), quando diverge da vida útil contábil adotada — alimenta a sugestão de ajuste em income_tax_adjustments.';

create trigger trg_fixed_assets_updated_at before update on fixed_assets
  for each row execute function set_updated_at();


create table if not exists asset_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  fixed_asset_id uuid not null references fixed_assets(id) on delete restrict,
  event_type asset_event_type not null,
  event_date date not null,
  amount numeric(18,2),
  journal_entry_id uuid references journal_entries(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table asset_events is 'Histórico de eventos do bem além da depreciação de rotina. RESTRICT: preserva o histórico mesmo que alguém tente remover o bem (deveria usar deleted_at).';


create table if not exists asset_depreciations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  fixed_asset_id uuid not null references fixed_assets(id) on delete restrict,
  competence date not null,
  accounting_amount numeric(18,2) not null,
  fiscal_amount numeric(18,2),
  journal_entry_id uuid references journal_entries(id),
  created_at timestamptz not null default now(),
  unique (fixed_asset_id, competence),
  constraint chk_asset_depreciations_competence_first_day check (competence = date_trunc('month', competence)::date)
);
comment on table asset_depreciations is 'Depreciação mensal de um bem — contábil e fiscal lado a lado. Só pode ser criada para bens com status ACTIVE (achado A9, ver trigger no bloco 18).';


-- =====================================================================================
-- BLOCO 14 — TABELAS: IRPJ / CSLL
-- =====================================================================================

create table if not exists income_tax_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
  unique (company_id, period_start, period_end),
  constraint chk_income_tax_assessments_period check (period_start <= period_end),
  -- AUDITORIA (B4): period_start alinhado a início de mês — cobre mensal/trimestral/anual
  -- sem travar num único formato de período.
  constraint chk_income_tax_assessments_period_start_month check (period_start = date_trunc('month', period_start)::date)
);
comment on table income_tax_assessments is 'Apuração de IRPJ/CSLL do Lucro Real. "irpj_surtax" calculado pela aplicação como R$20.000 × meses do período (regra corrigida na auditoria do protótipo).';

create trigger trg_income_tax_assessments_updated_at before update on income_tax_assessments
  for each row execute function set_updated_at();


create table if not exists income_tax_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  income_tax_assessment_id uuid not null references income_tax_assessments(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('ADDITION', 'EXCLUSION', 'OFFSET')),
  description text not null,
  amount numeric(18,2) not null,
  source_table text check (source_table in ('fixed_assets', 'asset_depreciations', 'manual')),
  source_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table income_tax_adjustments is 'Adições/exclusões/compensações do Lucro Real. Cascade mantido: ajuste não existe sem a apuração.';


-- =====================================================================================
-- BLOCO 15 — TABELAS: AUDITORIA DE PERÍODO, IMPORT LOG, LOGS GERAIS, ANEXOS
-- =====================================================================================

create table if not exists period_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  accounting_period_id uuid references accounting_periods(id),
  period_start date not null,
  period_end date not null,
  executed_at timestamptz not null default now(),
  executed_by uuid references auth.users(id),
  ok boolean not null,
  summary jsonb
);
comment on table period_audits is 'Execução da auditoria consolidada de período (somente leitura, nunca altera dados) — equivalente a auditarPeriodo(de, ate) do protótipo. Distinta de audit_logs: aqui é checagem de CONSISTÊNCIA contábil, não log de atividade do usuário.';


create table if not exists period_audit_findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  period_audit_id uuid not null references period_audits(id) on delete cascade,
  severity audit_severity not null,
  category text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now()
);
comment on table period_audit_findings is 'Um achado individual de uma execução de auditoria. Cascade mantido: achado não existe sem a execução que o gerou.';


create table if not exists import_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
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
comment on table import_logs is 'Log GERAL de importações da Central de Importações (fiscal, eSocial, extrato), cross-módulo — distinto de fiscal_imports (específico do fiscal, com FK direta com fiscal_documents). fiscal_imports.import_log_id liga os dois quando aplicável (achado M5).';


create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
comment on table audit_logs is 'Trilha de atividade genérica ("quem fez o quê, quando") — diferente de period_audits (checagem de consistência). Append-only: sem updated_at/deleted_at.';


create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  storage_path text not null,
  file_name text,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
comment on table attachments is 'Anexo genérico apontando para um caminho no Supabase Storage. Referência polimórfica via entity_type/entity_id.';


-- =====================================================================================
-- BLOCO 16 — TABELA: PERMISSÕES (extensibilidade pós-MVP)
-- =====================================================================================

create table if not exists role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_scope text not null check (role_scope in ('WORKSPACE', 'COMPANY')),
  role_name text not null,
  permission_key text not null,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_scope, role_name, permission_key)
);
comment on table role_permissions is 'Catálogo GLOBAL de permissões por papel — extensibilidade pós-MVP.';

create trigger trg_role_permissions_updated_at before update on role_permissions
  for each row execute function set_updated_at();


-- =====================================================================================
-- BLOCO 17 — FKs CRUZADAS (resolvendo dependências circulares/tardias do schema)
-- =====================================================================================

alter table journal_entry_lines
  add constraint fk_journal_entry_lines_bank_statement_line
  foreign key (bank_statement_line_id) references bank_statement_lines(id);

-- AUDITORIA (M5): vínculo fiscal_imports -> import_logs, criado aqui porque import_logs
-- só existe a partir do bloco 15 (depois de fiscal_imports, no bloco 10).
alter table fiscal_imports
  add constraint fk_fiscal_imports_import_log
  foreign key (import_log_id) references import_logs(id);


-- =====================================================================================
-- BLOCO 18 — FUNÇÕES DE VALIDAÇÃO E TRIGGERS DE INTEGRIDADE CONTÁBIL
-- =====================================================================================
-- AUDITORIA (C1 / correção obrigatória #7): TODA função abaixo tem "set search_path"
-- fixo. AUDITORIA (A4 / correção obrigatória #3): app.allow_ledger_mutation foi REMOVIDO
-- por completo — nenhuma função deste schema precisava dele de fato (a transição
-- POSTED->REVERSED já era permitida explicitamente pelo guard), e um bypass não utilizado
-- é superfície de ataque morta.

create or replace function assert_account_accepts_entries(p_account_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
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


create or replace function assert_period_open(p_company_id uuid, p_date date)
returns void
language plpgsql
set search_path = public, pg_temp
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


create or replace function validate_journal_entry_balance(p_entry_id uuid)
returns boolean
language plpgsql
set search_path = public, pg_temp
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

comment on function validate_journal_entry_balance(uuid) is 'Retorna true se débito = crédito no lançamento.';


-- AUDITORIA (A1 / correção obrigatória #2): contador transacional por empresa. O upsert
-- com ON CONFLICT DO UPDATE ... RETURNING é atômico sob concorrência — duas transações
-- concorrentes tentando incrementar o contador da MESMA empresa serializam naturalmente
-- na linha de company_journal_counters (Postgres bloqueia a linha durante o upsert),
-- sem necessidade de um SELECT ... FOR UPDATE manual separado.
create or replace function next_journal_number(p_company_id uuid)
returns bigint
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_next bigint;
begin
  insert into company_journal_counters (company_id, last_number)
  values (p_company_id, 1)
  on conflict (company_id) do update set last_number = company_journal_counters.last_number + 1, updated_at = now()
  returning last_number into v_next;

  return v_next;
end;
$$;

comment on function next_journal_number(uuid) is 'Próximo número de lançamento da empresa, atribuído atomicamente. Chamada apenas na transição para POSTED (ver fn_validate_journal_entry) — nunca em DRAFT.';


-- AUDITORIA (A2): função genérica reaproveitada pelos triggers de consistência de
-- company_id entre tabelas relacionadas (fiscal_documents, payroll_lines, fixed_assets,
-- bank_accounts — ver mais abaixo).
create or replace function assert_same_company(p_a uuid, p_b uuid, p_context text default '')
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_a is distinct from p_b then
    raise exception 'Inconsistência de empresa detectada (%): % <> %.', p_context, p_a, p_b
      using errcode = '23514';
  end if;
end;
$$;

comment on function assert_same_company(uuid, uuid, text) is 'Lança exceção se dois company_id divergirem. Reaproveitada por triggers de consistência entre tabelas relacionadas (achado A2 da auditoria).';


create or replace function fn_validate_journal_entry_line()
returns trigger
language plpgsql
set search_path = public, pg_temp
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

  perform assert_same_company(new.company_id, v_entry_company_id, 'journal_entry_lines.company_id vs journal_entries');

  select company_id into v_account_company_id from chart_accounts where id = new.account_id;
  perform assert_same_company(new.company_id, v_account_company_id, 'journal_entry_lines.company_id vs chart_accounts');

  -- Regra 7 (obrigatória): não permite alterar linhas de um lançamento já POSTED/REVERSED.
  -- AUDITORIA (A4): sem bypass — nenhum caso de uso legítimo precisa alterar linhas de um
  -- lançamento já postado (a correção correta é sempre estornar e lançar de novo).
  if tg_op = 'UPDATE' and v_entry_status in ('POSTED', 'REVERSED') then
    raise exception 'Não é permitido alterar linhas de um lançamento %.', v_entry_status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger trg_journal_entry_lines_validate
  before insert or update on journal_entry_lines
  for each row execute function fn_validate_journal_entry_line();


create or replace function fn_protect_journal_entry_line_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_entry_status journal_status;
begin
  select status into v_entry_status from journal_entries where id = old.journal_entry_id;
  if v_entry_status in ('POSTED', 'REVERSED') then
    raise exception 'Não é permitido excluir linha de um lançamento %.', v_entry_status
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create trigger trg_journal_entry_lines_protect_delete
  before delete on journal_entry_lines
  for each row execute function fn_protect_journal_entry_line_delete();


create or replace function fn_validate_journal_entry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- AUDITORIA (M3): cancelar um DRAFT nunca precisa checar período — ele nunca afetou
  -- saldo, então não há "reabertura contábil" nenhuma acontecendo, só limpeza de rascunho.
  -- Sem essa exceção, um DRAFT esquecido num período depois fechado ficava travado para sempre.
  if not (tg_op = 'UPDATE' and old.status = 'DRAFT' and new.status = 'CANCELLED') then
    perform assert_period_open(new.company_id, new.entry_date);
  end if;

  -- AUDITORIA (A1): number é atribuído aqui, atomicamente, só na transição para POSTED —
  -- nunca em DRAFT. Isso substitui o antigo padrão MAX(number)+1 calculado na aplicação.
  if new.status = 'POSTED' and new.number is null then
    new.number := next_journal_number(new.company_id);
  end if;

  -- Regra 5: só pode entrar em POSTED se estiver equilibrado (checagem síncrona —
  -- complementada pelas constraint triggers DEFERRED no bloco 19, que pegam qualquer
  -- ordem de inserção dentro da mesma transação — achado C2 da auditoria).
  if new.status = 'POSTED' and (tg_op = 'INSERT' or old.status is distinct from 'POSTED') then
    if not validate_journal_entry_balance(new.id) then
      raise exception 'Lançamento % está desequilibrado — débito e crédito não batem.', new.id
        using errcode = '23514';
    end if;
  end if;

  -- Regra 7: bloqueia alteração de campos de um lançamento já POSTED/REVERSED.
  -- AUDITORIA (A4): sem bypass — a única transição permitida (POSTED -> REVERSED) já é
  -- explicitamente liberada abaixo, sem precisar de nenhuma GUC de escape.
  if tg_op = 'UPDATE' and old.status in ('POSTED', 'REVERSED') then
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


-- AUDITORIA (C2): constraint triggers DEFERRED — revalidam o equilíbrio no COMMIT da
-- transação, cobrindo QUALQUER ordem de operações (cabeçalho POSTED inserido antes das
-- linhas, linhas alteradas depois do cabeçalho já POSTED, etc.). O trigger síncrono em
-- fn_validate_journal_entry continua existindo como fast-fail para o caminho comum
-- (DRAFT -> insere linhas -> UPDATE para POSTED); isto aqui é a rede de segurança que
-- pega todos os outros casos.

create or replace function fn_check_journal_balance_deferred_from_entry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'POSTED' then
    if not validate_journal_entry_balance(new.id) then
      raise exception 'Lançamento % (nº %) está desequilibrado ao final da transação.', new.id, new.number
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create constraint trigger trg_journal_entries_balance_deferred
  after insert or update on journal_entries
  deferrable initially deferred
  for each row execute function fn_check_journal_balance_deferred_from_entry();


create or replace function fn_check_journal_balance_deferred_from_line()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_entry_id uuid;
  v_status journal_status;
begin
  v_entry_id := coalesce(new.journal_entry_id, old.journal_entry_id);
  select status into v_status from journal_entries where id = v_entry_id;

  if v_status = 'POSTED' then
    if not validate_journal_entry_balance(v_entry_id) then
      raise exception 'Lançamento % ficou desequilibrado após alteração de suas linhas.', v_entry_id
        using errcode = '23514';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create constraint trigger trg_journal_entry_lines_balance_deferred
  after insert or update or delete on journal_entry_lines
  deferrable initially deferred
  for each row execute function fn_check_journal_balance_deferred_from_line();


-- AUDITORIA (A7): fechamento em cascata agora também protege a direção INVERSA —
-- reabrir um período é bloqueado se a competência SEGUINTE já estiver fechada.
create or replace function fn_assert_previous_period_closed()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_previous_status period_status;
  v_next_status period_status;
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

  if tg_op = 'UPDATE' and old.status = 'CLOSED' and new.status <> 'CLOSED' then
    select status into v_next_status
    from accounting_periods
    where company_id = new.company_id
      and competence = (new.competence + interval '1 month')::date;

    if found and v_next_status = 'CLOSED' then
      raise exception 'Não é possível reabrir % — a competência seguinte já está fechada.', new.competence
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_accounting_periods_cascade_close
  before insert or update on accounting_periods
  for each row execute function fn_assert_previous_period_closed();


create or replace function fn_validate_chart_account_parent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_parent_company_id uuid;
begin
  if new.parent_id is not null then
    select company_id into v_parent_company_id from chart_accounts where id = new.parent_id;
    perform assert_same_company(new.company_id, v_parent_company_id, 'chart_accounts.parent_id');
  end if;
  return new;
end;
$$;

create trigger trg_chart_accounts_validate_parent
  before insert or update on chart_accounts
  for each row execute function fn_validate_chart_account_parent();


-- AUDITORIA (M4): impede converter retroativamente uma conta com lançamentos já
-- existentes em sintética / não-lançável, o que quebraria a garantia de integridade
-- para o histórico já postado.
create or replace function fn_protect_chart_account_entry_flags()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_has_lines boolean;
begin
  if tg_op = 'UPDATE' and (new.is_synthetic and not old.is_synthetic or (not new.accepts_entries and old.accepts_entries)) then
    select exists(select 1 from journal_entry_lines where account_id = new.id) into v_has_lines;
    if v_has_lines then
      raise exception 'Conta % (%) já possui lançamentos — não pode virar sintética/não-lançável retroativamente.', new.code, new.name
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_chart_accounts_protect_entry_flags
  before update on chart_accounts
  for each row execute function fn_protect_chart_account_entry_flags();


create or replace function fn_validate_asset_child_company()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_asset_company_id uuid;
  v_asset_status asset_status;
begin
  select company_id, status into v_asset_company_id, v_asset_status from fixed_assets where id = new.fixed_asset_id;
  perform assert_same_company(new.company_id, v_asset_company_id, tg_table_name || '.company_id vs fixed_assets');

  -- AUDITORIA (A9): depreciação só pode ser lançada para bem ACTIVE.
  if tg_table_name = 'asset_depreciations' and v_asset_status <> 'ACTIVE' then
    raise exception 'Bem % não está ACTIVE (status atual: %) — não é possível lançar depreciação.', new.fixed_asset_id, v_asset_status
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


-- AUDITORIA (A2): consistência de company_id em fixed_assets contra categoria e as 3
-- contas contábeis obrigatórias (achado de maior risco: uma conta de outra empresa aqui
-- misturaria patrimônio entre tenants).
create or replace function fn_validate_fixed_asset_company()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from asset_categories where id = new.category_id;
  perform assert_same_company(new.company_id, v_company_id, 'fixed_assets.category_id');

  select company_id into v_company_id from chart_accounts where id = new.asset_account_id;
  perform assert_same_company(new.company_id, v_company_id, 'fixed_assets.asset_account_id');

  select company_id into v_company_id from chart_accounts where id = new.depreciation_account_id;
  perform assert_same_company(new.company_id, v_company_id, 'fixed_assets.depreciation_account_id');

  select company_id into v_company_id from chart_accounts where id = new.expense_account_id;
  perform assert_same_company(new.company_id, v_company_id, 'fixed_assets.expense_account_id');

  if new.asset_principal_id is not null then
    select company_id into v_company_id from fixed_assets where id = new.asset_principal_id;
    perform assert_same_company(new.company_id, v_company_id, 'fixed_assets.asset_principal_id');
  end if;

  return new;
end;
$$;

create trigger trg_fixed_assets_validate_company
  before insert or update on fixed_assets
  for each row execute function fn_validate_fixed_asset_company();


-- AUDITORIA (A2): consistência de company_id em fiscal_documents contra as contas de
-- contrapartida (o caso de maior risco real: classificar um documento com a conta errada
-- de outra empresa geraria um lançamento que corrompe os dois tenants).
create or replace function fn_validate_fiscal_document_company()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  if new.financial_account_id is not null then
    select company_id into v_company_id from chart_accounts where id = new.financial_account_id;
    perform assert_same_company(new.company_id, v_company_id, 'fiscal_documents.financial_account_id');
  end if;

  if new.offset_account_id is not null then
    select company_id into v_company_id from chart_accounts where id = new.offset_account_id;
    perform assert_same_company(new.company_id, v_company_id, 'fiscal_documents.offset_account_id');
  end if;

  return new;
end;
$$;

create trigger trg_fiscal_documents_validate_company
  before insert or update on fiscal_documents
  for each row execute function fn_validate_fiscal_document_company();


-- AUDITORIA (A2): idem para as contas de débito/crédito de uma rubrica de folha.
create or replace function fn_validate_payroll_line_company()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from payroll_summaries where id = new.payroll_summary_id;
  perform assert_same_company(new.company_id, v_company_id, 'payroll_lines.payroll_summary_id');

  if new.debit_account_id is not null then
    select company_id into v_company_id from chart_accounts where id = new.debit_account_id;
    perform assert_same_company(new.company_id, v_company_id, 'payroll_lines.debit_account_id');
  end if;

  if new.credit_account_id is not null then
    select company_id into v_company_id from chart_accounts where id = new.credit_account_id;
    perform assert_same_company(new.company_id, v_company_id, 'payroll_lines.credit_account_id');
  end if;

  return new;
end;
$$;

create trigger trg_payroll_lines_validate_company
  before insert or update on payroll_lines
  for each row execute function fn_validate_payroll_line_company();


-- AUDITORIA (A2): idem para a conta contábil vinculada a uma conta bancária.
create or replace function fn_validate_bank_account_company()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from chart_accounts where id = new.chart_account_id;
  perform assert_same_company(new.company_id, v_company_id, 'bank_accounts.chart_account_id');
  return new;
end;
$$;

create trigger trg_bank_accounts_validate_company
  before insert or update on bank_accounts
  for each row execute function fn_validate_bank_account_company();


-- AUDITORIA (A10): imutabilidade do vínculo de pagamento — uma vez definido, não pode
-- ser trocado (previne "reatribuir" o pagamento de uma obrigação já quitada).
create or replace function fn_protect_obligation_payment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.payment_journal_entry_id is not null
     and new.payment_journal_entry_id is distinct from old.payment_journal_entry_id then
    raise exception 'Obrigação % já tem pagamento vinculado (%) — não pode ser reatribuído.', old.id, old.payment_journal_entry_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_obligations_protect_payment
  before update on obligations
  for each row execute function fn_protect_obligation_payment();


create or replace function reverse_journal_entry(p_entry_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original journal_entries%rowtype;
  v_new_id uuid;
begin
  select * into v_original from journal_entries where id = p_entry_id for update;

  if not found then
    raise exception 'Lançamento % não encontrado.', p_entry_id;
  end if;

  if v_original.status <> 'POSTED' then
    raise exception 'Só é possível estornar um lançamento POSTED (status atual: %).', v_original.status;
  end if;

  perform assert_period_open(v_original.company_id, v_original.entry_date);

  v_new_id := gen_random_uuid();

  -- AUDITORIA (A1): "number" não é mais atribuído aqui via MAX() — fica NULL até a
  -- transição para POSTED logo abaixo, quando fn_validate_journal_entry chama
  -- next_journal_number() automaticamente.
  -- AUDITORIA (C2): insere como DRAFT de propósito — ver comentário detalhado na v1;
  -- a razão persiste: inserir já como POSTED validaria contra zero linhas.
  insert into journal_entries (
    id, workspace_id, company_id, establishment_id, entry_date, competence,
    description, document, partner_id, origin, origin_id, status, reversal_of_id, notes
  ) values (
    v_new_id, v_original.workspace_id, v_original.company_id, v_original.establishment_id,
    v_original.entry_date, v_original.competence,
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

  update journal_entries
    set status = 'REVERSED', reversed_by_entry_id = v_new_id
    where id = v_original.id;

  return v_new_id;
end;
$$;

comment on function reverse_journal_entry(uuid, text) is 'Estorna um lançamento POSTED por reversão (nunca apaga o original). SECURITY DEFINER; EXECUTE revogado de PUBLIC (ver bloco 24) — só roles explicitamente autorizadas podem chamar.';


-- =====================================================================================
-- BLOCO 19 — VIEWS
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

comment on view view_posted_journal_lines is 'Linhas de lançamento apenas de lançamentos POSTED, já com os dados da conta — base para relatórios (Razão/Balancete/DRE/BP). Não materializada nesta versão (achado M7) — para volumes grandes, considerar materializar por competência fechada.';


create or replace view account_movements_view as
select
  company_id,
  account_id,
  competence,
  sum(amount) filter (where debit_credit = 'DEBIT') as debit_total,
  sum(amount) filter (where debit_credit = 'CREDIT') as credit_total
from view_posted_journal_lines
group by company_id, account_id, competence;

comment on view account_movements_view is 'Movimento agregado (débito/crédito) por empresa, conta e competência.';


-- =====================================================================================
-- BLOCO 20 — FUNÇÃO DE SALDO (get_account_balance)
-- =====================================================================================

create or replace function get_account_balance(p_company_id uuid, p_account_id uuid, p_as_of_date date)
returns numeric(18,2)
language plpgsql
stable
set search_path = public, pg_temp
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
    and (ca.id = p_account_id or ca.code like v_code || '.%')
  ;

  if v_normal_balance = 'DEBIT' then
    return v_debit - v_credit;
  else
    return v_credit - v_debit;
  end if;
end;
$$;

comment on function get_account_balance(uuid, uuid, date) is 'Saldo de uma conta (sintética ou analítica) até uma data. Depende do índice idx_chart_accounts_code_pattern (achado A12) para escalar bem em planos de contas grandes.';


-- =====================================================================================
-- BLOCO 21 — ÍNDICES
-- =====================================================================================

create index if not exists idx_companies_workspace on companies (workspace_id);
create index if not exists idx_establishments_company on establishments (company_id);
create index if not exists idx_cost_centers_company on cost_centers (company_id);
create index if not exists idx_partners_company on partners (company_id);
create index if not exists idx_chart_accounts_company on chart_accounts (company_id);
create index if not exists idx_accounting_rules_company on accounting_rules (company_id);
create index if not exists idx_accounting_periods_company on accounting_periods (company_id);

create index if not exists idx_accounting_periods_competence on accounting_periods (company_id, competence);
create index if not exists idx_journal_entries_competence on journal_entries (company_id, competence);
create index if not exists idx_journal_entries_entry_date on journal_entries (company_id, entry_date);
create index if not exists idx_fiscal_documents_competence on fiscal_documents (company_id, competence);
create index if not exists idx_tax_assessments_competence on tax_assessments (company_id, competence);
create index if not exists idx_payroll_summaries_competence on payroll_summaries (company_id, competence);
create index if not exists idx_obligations_competence on obligations (company_id, competence);
create index if not exists idx_asset_depreciations_competence on asset_depreciations (company_id, competence);

create index if not exists idx_journal_entry_lines_account on journal_entry_lines (account_id);
create index if not exists idx_journal_entry_lines_entry on journal_entry_lines (journal_entry_id);
create index if not exists idx_journal_entry_lines_company on journal_entry_lines (company_id);

create index if not exists idx_journal_entries_origin on journal_entries (company_id, origin, origin_id);

create index if not exists idx_journal_entries_status on journal_entries (company_id, status);
create index if not exists idx_fiscal_documents_status on fiscal_documents (company_id, status);
create index if not exists idx_payroll_summaries_status on payroll_summaries (company_id, status);
create index if not exists idx_obligations_status on obligations (company_id, status);
create index if not exists idx_fixed_assets_status on fixed_assets (company_id, status);

create index if not exists idx_fiscal_documents_partner on fiscal_documents (partner_id);

create index if not exists idx_bank_statement_lines_account_date on bank_statement_lines (bank_account_id, entry_date);
create index if not exists idx_bank_statement_lines_reconciled on bank_statement_lines (bank_account_id, reconciled);

create index if not exists idx_fixed_assets_category on fixed_assets (company_id, category_id);
create index if not exists idx_fixed_assets_principal on fixed_assets (asset_principal_id);

create index if not exists idx_obligations_due_date on obligations (company_id, due_date, status);

create index if not exists idx_audit_logs_entity on audit_logs (company_id, entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on audit_logs (workspace_id, created_at);
create index if not exists idx_period_audit_findings_audit on period_audit_findings (period_audit_id);
create index if not exists idx_attachments_entity on attachments (company_id, entity_type, entity_id);

-- AUDITORIA (A12): índice otimizado para o padrão "code LIKE 'x.%'" usado em TODO
-- relatório via get_account_balance() — sem isto, cada saldo de conta sintética varre
-- chart_accounts inteira.
create index if not exists idx_chart_accounts_code_pattern on chart_accounts (company_id, code text_pattern_ops);

-- AUDITORIA (A11): índices faltantes em FKs de tabela-detalhe/rastreabilidade.
create index if not exists idx_journal_entries_reversal_of on journal_entries (reversal_of_id) where reversal_of_id is not null;
create index if not exists idx_journal_entries_reversed_by on journal_entries (reversed_by_entry_id) where reversed_by_entry_id is not null;
create index if not exists idx_obligations_origin_assessment on obligations (origin_assessment_id) where origin_assessment_id is not null;
create index if not exists idx_payroll_lines_summary on payroll_lines (payroll_summary_id);
create index if not exists idx_fiscal_document_items_document on fiscal_document_items (fiscal_document_id);
create index if not exists idx_tax_assessment_lines_assessment on tax_assessment_lines (tax_assessment_id);
create index if not exists idx_asset_events_asset on asset_events (fixed_asset_id);
create index if not exists idx_bank_reconciliations_statement_line on bank_reconciliations (bank_statement_line_id);
create index if not exists idx_bank_reconciliations_journal_line on bank_reconciliations (journal_entry_line_id);
create index if not exists idx_fiscal_imports_import_log on fiscal_imports (import_log_id) where import_log_id is not null;


-- =====================================================================================
-- BLOCO 22 — ROW LEVEL SECURITY (habilitação apenas — policies na próxima etapa)
-- =====================================================================================

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
alter table company_journal_counters enable row level security;
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

-- Nenhuma policy é criada nesta migração — todas as tabelas ficam com RLS habilitada e
-- SEM policies, o que bloqueia todo acesso via anon/authenticated (service_role, usado
-- pelo backend, ignora RLS por padrão no Supabase — isso é esperado e não uma falha).


-- =====================================================================================
-- BLOCO 23 — GRANTS (achado CRÍTICO C1 / correção obrigatória #7)
-- =====================================================================================
-- Postgres concede EXECUTE a PUBLIC em toda função nova por padrão. Isso nunca foi
-- revogado na v1 — combinado com reverse_journal_entry ser SECURITY DEFINER, qualquer
-- usuário autenticado (ou até anônimo, a depender da configuração do projeto) podia
-- chamar a função e estornar lançamentos de qualquer empresa, ignorando RLS. Revogamos
-- tudo e liberamos seletivamente só o necessário. Funções de trigger NÃO precisam de
-- GRANT: são invocadas pelo executor internamente, independente do EXECUTE do usuário.

revoke execute on all functions in schema public from public;

grant execute on function assert_account_accepts_entries(uuid) to authenticated, service_role;
grant execute on function assert_period_open(uuid, date) to authenticated, service_role;
grant execute on function assert_same_company(uuid, uuid, text) to authenticated, service_role;
grant execute on function validate_journal_entry_balance(uuid) to authenticated, service_role;
grant execute on function next_journal_number(uuid) to authenticated, service_role;
grant execute on function get_account_balance(uuid, uuid, date) to authenticated, service_role;

-- reverse_journal_entry fica mais restrita: liberada apenas para service_role (chamada
-- pelo backend/Server Action, que aplica a autorização de papel — ex.: só Contador pode
-- estornar — ANTES de invocar a função). Autorização fina por papel é responsabilidade da
-- camada de aplicação + das policies de RLS da próxima etapa, não desta função isolada.
grant execute on function reverse_journal_entry(uuid, text) to service_role;


-- =====================================================================================
-- FIM DO SCHEMA v1.1
-- =====================================================================================
