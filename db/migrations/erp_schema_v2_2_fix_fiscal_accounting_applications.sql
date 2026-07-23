-- =====================================================================================
-- ERP CONTABIL — v2.2 — REPARO DE DRIFT: fiscal_accounting_applications
-- =====================================================================================
-- Contexto: alguns ambientes chegaram nas etapas 34A/34B sem aplicar a migration v1.8
-- (Etapa 32C). O codigo atual usa fiscal_accounting_applications para rastrear como um
-- documento fiscal virou lancamento contabil; sem a tabela, o PostgREST retorna:
-- "Could not find the table 'public.fiscal_accounting_applications' in the schema cache".
--
-- Esta migration e idempotente e repete o bloco estrutural essencial da v1.8, incluindo
-- fiscal_accounting_rules, porque applications referencia rules por FK.
-- =====================================================================================

create table if not exists fiscal_accounting_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,

  name text not null,
  description text,
  active boolean not null default true,
  priority int not null default 100,

  document_type text,
  direction text check (direction is null or direction in ('IN', 'OUT')),
  cfop text,
  cfop_pattern text,
  fiscal_operation_nature_id uuid references fiscal_operation_natures(id) on delete set null,
  item_type text,
  partner_id uuid references partners(id) on delete set null,
  tax_regime text,
  min_amount numeric(18,2),
  max_amount numeric(18,2),

  debit_account_source text not null check (debit_account_source in ('FIXED', 'PARTNER_CUSTOMER', 'PARTNER_SUPPLIER')),
  debit_account_id uuid references chart_accounts(id) on delete restrict,
  credit_account_source text not null check (credit_account_source in ('FIXED', 'PARTNER_CUSTOMER', 'PARTNER_SUPPLIER')),
  credit_account_id uuid references chart_accounts(id) on delete restrict,

  value_base text not null default 'DOCUMENT_AMOUNT' check (value_base in ('DOCUMENT_AMOUNT', 'MERCHANDISE_AMOUNT', 'SERVICES_AMOUNT', 'TOTAL_AMOUNT')),
  description_template text,

  auto_suggest boolean not null default true,
  auto_generate_draft boolean not null default false,
  post_automatically boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fiscal_accounting_rules_debit_fixed_requires_account
    check (debit_account_source <> 'FIXED' or debit_account_id is not null),
  constraint fiscal_accounting_rules_credit_fixed_requires_account
    check (credit_account_source <> 'FIXED' or credit_account_id is not null)
);

comment on table fiscal_accounting_rules is
  'Regras de contabilizacao automatica/sugerida de documentos fiscais (Etapa 32C/v2.2 drift fix).';

drop trigger if exists trg_fiscal_accounting_rules_updated_at on fiscal_accounting_rules;
create trigger trg_fiscal_accounting_rules_updated_at before update on fiscal_accounting_rules
  for each row execute function set_updated_at();

create index if not exists idx_fiscal_accounting_rules_company_active_priority
  on fiscal_accounting_rules (company_id, active, priority);

alter table fiscal_accounting_rules enable row level security;

drop policy if exists fiscal_accounting_rules_select on fiscal_accounting_rules;
create policy fiscal_accounting_rules_select on fiscal_accounting_rules
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists fiscal_accounting_rules_insert on fiscal_accounting_rules;
create policy fiscal_accounting_rules_insert on fiscal_accounting_rules
  for insert to authenticated
  with check (can_admin_company(company_id));

drop policy if exists fiscal_accounting_rules_update on fiscal_accounting_rules;
create policy fiscal_accounting_rules_update on fiscal_accounting_rules
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

drop policy if exists fiscal_accounting_rules_delete on fiscal_accounting_rules;
create policy fiscal_accounting_rules_delete on fiscal_accounting_rules
  for delete to authenticated
  using (can_admin_company(company_id));

grant select, insert, update, delete on fiscal_accounting_rules to authenticated;

create table if not exists fiscal_accounting_applications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,

  fiscal_document_id uuid not null references fiscal_documents(id) on delete restrict,
  journal_entry_id uuid references journal_entries(id) on delete set null,
  rule_id uuid references fiscal_accounting_rules(id) on delete set null,

  mode text not null check (mode in ('MANUAL', 'RULE_SUGGESTED', 'RULE_AUTO_DRAFT')),

  debit_account_id uuid not null references chart_accounts(id) on delete restrict,
  credit_account_id uuid not null references chart_accounts(id) on delete restrict,
  amount numeric(18,2) not null,
  description text,

  status text not null default 'APPLIED' check (status in ('APPLIED', 'REVERSED', 'ERROR')),
  error_message text,

  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_journal_entry_id uuid references journal_entries(id) on delete set null
);

comment on table fiscal_accounting_applications is
  'Rastro imutavel de como cada documento fiscal foi contabilizado (Etapa 32C/v2.2 drift fix).';

create index if not exists idx_fiscal_accounting_applications_document
  on fiscal_accounting_applications (fiscal_document_id, created_at desc);

create index if not exists idx_fiscal_accounting_applications_company
  on fiscal_accounting_applications (company_id);

alter table fiscal_accounting_applications enable row level security;

drop policy if exists fiscal_accounting_applications_select on fiscal_accounting_applications;
create policy fiscal_accounting_applications_select on fiscal_accounting_applications
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists fiscal_accounting_applications_insert on fiscal_accounting_applications;
create policy fiscal_accounting_applications_insert on fiscal_accounting_applications
  for insert to authenticated
  with check (can_write_company(company_id));

drop policy if exists fiscal_accounting_applications_update on fiscal_accounting_applications;
create policy fiscal_accounting_applications_update on fiscal_accounting_applications
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

grant select, insert, update on fiscal_accounting_applications to authenticated;

notify pgrst, 'reload schema';
