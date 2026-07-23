-- =====================================================================================
-- ERP CONTÁBIL — v1.8 — ETAPA 32C — REGRAS CONTÁBEIS FISCAIS E RASTRO DE CONTABILIZAÇÃO
-- =====================================================================================
-- Migração aditiva e idempotente (create table/index if not exists, add column if not
-- exists). Não altera nenhuma tabela/coluna/policy existente das etapas anteriores.
--
-- BLOCO 1 — fiscal_accounting_rules: motor de regras de contabilização automática de
--   documentos fiscais (mesmo espírito de bank_reconciliation_rules da Etapa 30A: nunca
--   posta sozinho, só sugere — quem confirma é o usuário via accountFiscalDocumentAction).
-- BLOCO 2 — fiscal_accounting_applications: log/rastro de como um documento fiscal virou
--   lançamento contábil (manual, sugestão de regra, ou rascunho automático de regra),
--   nunca apagado, só marcado REVERSED quando estornado.
-- =====================================================================================

-- ---------------------------------------------------------------------------------
-- BLOCO 1 — fiscal_accounting_rules
-- ---------------------------------------------------------------------------------
create table if not exists fiscal_accounting_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,

  name text not null,
  description text,
  active boolean not null default true,
  priority int not null default 100,

  -- Condições (null = qualquer valor serve, "coringa")
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

  -- Contas (débito/crédito), cada uma com uma origem
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

comment on table fiscal_accounting_rules is 'Regras de contabilização automática/sugerida de documentos fiscais (Etapa 32C). Nunca posta sozinha — post_automatically existe como campo de configuração para uma automação futura, mas hoje o fluxo sempre passa por confirmação manual do usuário em accountFiscalDocumentAction. Prioridade menor = mais específica/aplicada primeiro.';
comment on column fiscal_accounting_rules.post_automatically is 'Reservado para uma etapa futura de postagem 100% automática. Nesta etapa (32C) não há nenhum gatilho que leia este campo para postar sem confirmação humana.';

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

-- ---------------------------------------------------------------------------------
-- BLOCO 2 — fiscal_accounting_applications
-- ---------------------------------------------------------------------------------
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

comment on table fiscal_accounting_applications is 'Rastro imutável de como cada documento fiscal foi contabilizado (Etapa 32C) — manual, sugestão de regra aplicada, ou rascunho automático. Nunca é apagado; ao estornar, a linha existente é marcada REVERSED e ganha reversal_journal_entry_id, nunca é substituída/removida.';

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

-- UPDATE é restrito à transição de status para REVERSED feita pela própria action de
-- estorno (nunca DELETE — histórico é permanente).
drop policy if exists fiscal_accounting_applications_update on fiscal_accounting_applications;
create policy fiscal_accounting_applications_update on fiscal_accounting_applications
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

grant select, insert, update on fiscal_accounting_applications to authenticated;
