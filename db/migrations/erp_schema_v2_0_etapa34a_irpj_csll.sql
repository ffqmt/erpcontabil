-- =====================================================================================
-- ERP CONTÁBIL — v2.0 — ETAPA 34A — IRPJ/CSLL NO MOTOR DE APURAÇÃO TRIBUTÁRIA
-- =====================================================================================
-- Migração aditiva e idempotente. Decisão de arquitetura (documentada em
-- docs/diagnostico-arquitetura-fiscal-contabil-etapa32a.md, seção 3): reaproveitar
-- tax_assessments/tax_assessment_lines (adicionando IRPJ/CSLL ao enum tax_type) em vez da
-- tabela income_tax_assessments (que já existia desde a v1.1, mas cuja UI/actions nunca
-- foram construídas) — a máquina de estado, trilha de auditoria (calculation_memory),
-- saldo anterior/seguinte e vínculo com journal_entry_id já existem e são genéricos o
-- bastante.
--
-- BLOCO 1 — adiciona IRPJ/CSLL ao enum tax_type.
-- BLOCO 2 — tax_regime_rates: configuração de alíquotas/percentuais de presunção por
--   regime tributário, nunca hardcoded no código.
-- BLOCO 3 — tax_assessment_adjustments: ajustes manuais de Lucro Real (adições/exclusões/
--   compensações) — não tenta automatizar LALUR/LACS completo.
-- =====================================================================================

-- ---------------------------------------------------------------------------------
-- BLOCO 1 — tax_type: adiciona IRPJ, CSLL
-- ---------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'tax_type' and e.enumlabel = 'IRPJ') then
    alter type tax_type add value 'IRPJ';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'tax_type' and e.enumlabel = 'CSLL') then
    alter type tax_type add value 'CSLL';
  end if;
end $$;

-- ---------------------------------------------------------------------------------
-- BLOCO 2 — tax_regime_rates
-- ---------------------------------------------------------------------------------
create table if not exists tax_regime_rates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,

  tax_regime text not null check (tax_regime in ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL')),
  tax_type text not null check (tax_type in ('IRPJ', 'CSLL', 'SIMPLES')),
  fiscal_operation_nature_id uuid references fiscal_operation_natures(id) on delete set null,

  presumption_rate numeric(6,4),
  tax_rate numeric(6,4) not null,
  additional_rate numeric(6,4),
  additional_threshold_monthly numeric(18,2),

  valid_from date not null,
  valid_until date,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_regime_rates_valid_period check (valid_until is null or valid_until >= valid_from)
);

comment on table tax_regime_rates is 'Configuração de alíquotas e percentuais de presunção de IRPJ/CSLL/Simples por regime tributário (Etapa 34A) — nunca hardcoded no código de cálculo. valid_from/valid_until permitem reprocessar apurações antigas com a alíquota vigente na época.';
comment on column tax_regime_rates.fiscal_operation_nature_id is 'Null = regra genérica da empresa/regime; preenchido = sobrescreve a regra genérica só para essa natureza fiscal (percentual de presunção varia por atividade).';

create trigger trg_tax_regime_rates_updated_at before update on tax_regime_rates
  for each row execute function set_updated_at();

create index if not exists idx_tax_regime_rates_company_lookup
  on tax_regime_rates (company_id, tax_regime, tax_type, active);

alter table tax_regime_rates enable row level security;

drop policy if exists tax_regime_rates_select on tax_regime_rates;
create policy tax_regime_rates_select on tax_regime_rates
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists tax_regime_rates_insert on tax_regime_rates;
create policy tax_regime_rates_insert on tax_regime_rates
  for insert to authenticated
  with check (can_admin_company(company_id));

drop policy if exists tax_regime_rates_update on tax_regime_rates;
create policy tax_regime_rates_update on tax_regime_rates
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

drop policy if exists tax_regime_rates_delete on tax_regime_rates;
create policy tax_regime_rates_delete on tax_regime_rates
  for delete to authenticated
  using (can_admin_company(company_id));

grant select, insert, update, delete on tax_regime_rates to authenticated;

-- ---------------------------------------------------------------------------------
-- BLOCO 3 — tax_assessment_adjustments (Lucro Real assistido)
-- ---------------------------------------------------------------------------------
create table if not exists tax_assessment_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  assessment_id uuid not null references tax_assessments(id) on delete cascade,

  tax_type text not null check (tax_type in ('IRPJ', 'CSLL')),
  adjustment_type text not null check (adjustment_type in ('ADDITION', 'EXCLUSION', 'COMPENSATION')),
  description text not null,
  amount numeric(18,2) not null check (amount >= 0),

  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);

comment on table tax_assessment_adjustments is 'Ajustes manuais de Lucro Real (Etapa 34A) — adições/exclusões ao resultado contábil e compensação de prejuízo fiscal/base negativa. Deliberadamente simples (não tenta automatizar um LALUR/LACS completo): o contador informa tipo/descrição/valor por competência.';

create index if not exists idx_tax_assessment_adjustments_assessment
  on tax_assessment_adjustments (assessment_id);

alter table tax_assessment_adjustments enable row level security;

drop policy if exists tax_assessment_adjustments_select on tax_assessment_adjustments;
create policy tax_assessment_adjustments_select on tax_assessment_adjustments
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists tax_assessment_adjustments_insert on tax_assessment_adjustments;
create policy tax_assessment_adjustments_insert on tax_assessment_adjustments
  for insert to authenticated
  with check (
    can_write_company(company_id)
    and exists (select 1 from tax_assessments a where a.id = tax_assessment_adjustments.assessment_id and a.status in ('DRAFT', 'CALCULATED'))
  );

drop policy if exists tax_assessment_adjustments_delete on tax_assessment_adjustments;
create policy tax_assessment_adjustments_delete on tax_assessment_adjustments
  for delete to authenticated
  using (
    can_write_company(company_id)
    and exists (select 1 from tax_assessments a where a.id = tax_assessment_adjustments.assessment_id and a.status in ('DRAFT', 'CALCULATED'))
  );

grant select, insert, delete on tax_assessment_adjustments to authenticated;
