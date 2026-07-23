-- =====================================================================================
-- ERP FISCAL — v2.5 — CONFIGURACAO DE TRIBUTOS APURAVEIS POR EMPRESA
-- =====================================================================================
-- Corrige ambientes que nao aplicaram a migracao v2.0 completa, garantindo IRPJ/CSLL no
-- enum tax_type, e adiciona uma configuracao por empresa para definir quais tributos
-- entram no motor de apuracao fiscal.
--
-- PIS/COFINS ficam fora desta configuracao porque, neste modelo, sao contabilizados no
-- lancamento do documento fiscal por regra contabil propria.
-- =====================================================================================

do $$
begin
  if exists (select 1 from pg_type where typname = 'tax_type') then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'tax_type'
        and e.enumlabel = 'IRPJ'
    ) then
      alter type tax_type add value 'IRPJ';
    end if;

    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'tax_type'
        and e.enumlabel = 'CSLL'
    ) then
      alter type tax_type add value 'CSLL';
    end if;
  end if;
end $$;

create table if not exists company_tax_assessment_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete cascade,

  tax_type text not null check (
    tax_type in (
      'ISS',
      'ICMS',
      'IPI',
      'SIMPLES',
      'INSS_RETIDO',
      'IRRF',
      'PCC',
      'IRPJ',
      'CSLL',
      'OTHER'
    )
  ),
  enabled boolean not null default true,
  account_assessment boolean not null default true,
  calculation_mode text not null default 'AUTO' check (calculation_mode in ('AUTO', 'MANUAL')),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_tax_assessment_settings_unique unique (company_id, tax_type)
);

comment on table company_tax_assessment_settings is
  'Configuracao por empresa dos tributos que entram no motor de apuracao fiscal. PIS/COFINS sao tratados diretamente na contabilizacao do documento fiscal.';

comment on column company_tax_assessment_settings.calculation_mode is
  'AUTO usa documentos fiscais escriturados/aliquotas configuradas quando houver motor automatico. MANUAL permite apuracao por linhas manuais/retenções.';

drop trigger if exists trg_company_tax_assessment_settings_updated_at on company_tax_assessment_settings;
create trigger trg_company_tax_assessment_settings_updated_at before update on company_tax_assessment_settings
  for each row execute function set_updated_at();

create index if not exists idx_company_tax_assessment_settings_company
  on company_tax_assessment_settings (company_id, enabled);

alter table company_tax_assessment_settings enable row level security;

drop policy if exists company_tax_assessment_settings_select on company_tax_assessment_settings;
create policy company_tax_assessment_settings_select on company_tax_assessment_settings
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists company_tax_assessment_settings_insert on company_tax_assessment_settings;
create policy company_tax_assessment_settings_insert on company_tax_assessment_settings
  for insert to authenticated
  with check (can_admin_company(company_id));

drop policy if exists company_tax_assessment_settings_update on company_tax_assessment_settings;
create policy company_tax_assessment_settings_update on company_tax_assessment_settings
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

drop policy if exists company_tax_assessment_settings_delete on company_tax_assessment_settings;
create policy company_tax_assessment_settings_delete on company_tax_assessment_settings
  for delete to authenticated
  using (can_admin_company(company_id));

grant select, insert, update, delete on company_tax_assessment_settings to authenticated;

insert into company_tax_assessment_settings (
  workspace_id,
  company_id,
  tax_type,
  enabled,
  account_assessment,
  calculation_mode,
  notes
)
select
  c.workspace_id,
  c.id,
  t.tax_type,
  case
    when c.tax_regime = 'SIMPLES_NACIONAL' then t.tax_type = 'SIMPLES'
    when c.tax_regime in ('LUCRO_PRESUMIDO', 'LUCRO_REAL') then t.tax_type in ('ISS', 'ICMS', 'IPI', 'IRPJ', 'CSLL')
    else t.tax_type in ('ISS', 'ICMS', 'IPI')
  end as enabled,
  t.tax_type <> 'OTHER' as account_assessment,
  case
    when t.tax_type in ('INSS_RETIDO', 'IRRF', 'PCC', 'OTHER') then 'MANUAL'
    else 'AUTO'
  end as calculation_mode,
  case
    when t.tax_type in ('INSS_RETIDO', 'IRRF', 'PCC') then 'Predefinido como opcional: apuracao baseada em retencoes e/ou ajustes manuais.'
    when t.tax_type = 'OTHER' then 'Predefinido como opcional: use para apuracoes manuais fora dos tributos padrao.'
    else null
  end as notes
from companies c
cross join (
  values
    ('ISS'),
    ('ICMS'),
    ('IPI'),
    ('SIMPLES'),
    ('INSS_RETIDO'),
    ('IRRF'),
    ('PCC'),
    ('IRPJ'),
    ('CSLL'),
    ('OTHER')
) as t(tax_type)
on conflict (company_id, tax_type) do nothing;

notify pgrst, 'reload schema';
