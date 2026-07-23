-- =====================================================================================
-- ERP CONTABIL — v2.3 — PARTIDAS MULTIPLAS EM REGRAS CONTABEIS FISCAIS
-- =====================================================================================
-- Mantem fiscal_accounting_rules como cabecalho/criterio da regra e adiciona uma tabela
-- filha para as linhas contabeis que a regra deve gerar. As colunas antigas de
-- debito/credito permanecem para compatibilidade e fallback de ambientes com regras ja
-- cadastradas.
-- =====================================================================================

create table if not exists fiscal_accounting_rule_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  rule_id uuid not null references fiscal_accounting_rules(id) on delete cascade,

  line_order int not null default 1,
  debit_credit text not null check (debit_credit in ('DEBIT', 'CREDIT')),
  account_source text not null check (account_source in ('FIXED', 'PARTNER_CUSTOMER', 'PARTNER_SUPPLIER')),
  account_id uuid references chart_accounts(id) on delete restrict,

  value_base text not null default 'DOCUMENT_AMOUNT' check (
    value_base in (
      'DOCUMENT_AMOUNT',
      'MERCHANDISE_AMOUNT',
      'SERVICES_AMOUNT',
      'TOTAL_AMOUNT',
      'FREIGHT_AMOUNT',
      'INSURANCE_AMOUNT',
      'DISCOUNT_AMOUNT',
      'OTHER_EXPENSES_AMOUNT',
      'ICMS_AMOUNT',
      'IPI_AMOUNT',
      'PIS_AMOUNT',
      'COFINS_AMOUNT',
      'ISS_AMOUNT'
    )
  ),
  amount_multiplier numeric(12,6) not null default 1,
  memo_template text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fiscal_accounting_rule_lines_fixed_requires_account
    check (account_source <> 'FIXED' or account_id is not null),
  constraint fiscal_accounting_rule_lines_multiplier_positive
    check (amount_multiplier > 0)
);

comment on table fiscal_accounting_rule_lines is
  'Partidas geradas por uma regra contabil fiscal. Uma regra pode ter N linhas de debito/credito, cada uma com conta/origem e base de valor proprias.';

drop trigger if exists trg_fiscal_accounting_rule_lines_updated_at on fiscal_accounting_rule_lines;
create trigger trg_fiscal_accounting_rule_lines_updated_at before update on fiscal_accounting_rule_lines
  for each row execute function set_updated_at();

create index if not exists idx_fiscal_accounting_rule_lines_rule_order
  on fiscal_accounting_rule_lines (rule_id, line_order, id);

create index if not exists idx_fiscal_accounting_rule_lines_company
  on fiscal_accounting_rule_lines (company_id);

alter table fiscal_accounting_rule_lines enable row level security;

drop policy if exists fiscal_accounting_rule_lines_select on fiscal_accounting_rule_lines;
create policy fiscal_accounting_rule_lines_select on fiscal_accounting_rule_lines
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists fiscal_accounting_rule_lines_insert on fiscal_accounting_rule_lines;
create policy fiscal_accounting_rule_lines_insert on fiscal_accounting_rule_lines
  for insert to authenticated
  with check (can_admin_company(company_id));

drop policy if exists fiscal_accounting_rule_lines_update on fiscal_accounting_rule_lines;
create policy fiscal_accounting_rule_lines_update on fiscal_accounting_rule_lines
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

drop policy if exists fiscal_accounting_rule_lines_delete on fiscal_accounting_rule_lines;
create policy fiscal_accounting_rule_lines_delete on fiscal_accounting_rule_lines
  for delete to authenticated
  using (can_admin_company(company_id));

grant select, insert, update, delete on fiscal_accounting_rule_lines to authenticated;

notify pgrst, 'reload schema';
