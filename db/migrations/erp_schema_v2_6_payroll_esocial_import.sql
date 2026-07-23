-- =====================================================================================
-- ERP FOLHA — v2.6 — IMPORTACAO DE XML DO ESOCIAL
-- =====================================================================================
-- Primeiro recorte do modulo Folha: importar XMLs do eSocial, preservar o XML bruto e
-- normalizar eventos/rubricas suficientes para posterior contabilizacao da folha.
-- =====================================================================================

create table if not exists payroll_esocial_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete cascade,

  file_name text,
  import_hash text not null,
  event_id text,
  event_type text,
  import_status text not null default 'IMPORTED' check (import_status in ('IMPORTED', 'DUPLICATE', 'ERROR')),
  xml_raw text not null,
  parsed_payload jsonb,
  parse_errors jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table payroll_esocial_imports is
  'Tentativas de importacao de XML do eSocial. Mantem XML bruto, hash, payload parseado e erros/duplicidades.';

drop trigger if exists trg_payroll_esocial_imports_updated_at on payroll_esocial_imports;
create trigger trg_payroll_esocial_imports_updated_at before update on payroll_esocial_imports
  for each row execute function set_updated_at();

create index if not exists idx_payroll_esocial_imports_company_created
  on payroll_esocial_imports (company_id, created_at desc);

create index if not exists idx_payroll_esocial_imports_company_hash
  on payroll_esocial_imports (company_id, import_hash);

create table if not exists payroll_esocial_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete cascade,
  import_id uuid references payroll_esocial_imports(id) on delete set null,

  event_id text,
  event_type text not null,
  event_name text,
  employer_registration text,
  period_competence date,
  payment_date date,
  worker_cpf text,
  worker_name text,
  worker_registration text,
  worker_category text,

  gross_amount numeric(18,2) not null default 0,
  deductions_amount numeric(18,2) not null default 0,
  net_amount numeric(18,2) not null default 0,
  inss_employee_amount numeric(18,2) not null default 0,
  irrf_amount numeric(18,2) not null default 0,
  fgts_amount numeric(18,2) not null default 0,
  employer_inss_amount numeric(18,2) not null default 0,
  other_amount numeric(18,2) not null default 0,

  accounting_status text not null default 'NOT_ACCOUNTED' check (accounting_status in ('NOT_ACCOUNTED', 'ACCOUNTED', 'ACCOUNTING_ERROR')),
  journal_entry_id uuid references journal_entries(id) on delete set null,

  event_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payroll_esocial_events_company_event_unique unique (company_id, event_id)
);

comment on table payroll_esocial_events is
  'Eventos do eSocial importados para o modulo Folha. Base para conferencia e contabilizacao futura da folha.';

drop trigger if exists trg_payroll_esocial_events_updated_at on payroll_esocial_events;
create trigger trg_payroll_esocial_events_updated_at before update on payroll_esocial_events
  for each row execute function set_updated_at();

create index if not exists idx_payroll_esocial_events_company_competence
  on payroll_esocial_events (company_id, period_competence desc, event_type);

create index if not exists idx_payroll_esocial_events_company_worker
  on payroll_esocial_events (company_id, worker_cpf);

create table if not exists payroll_esocial_event_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete cascade,
  payroll_event_id uuid not null references payroll_esocial_events(id) on delete cascade,

  item_order int not null default 1,
  line_type text not null default 'UNKNOWN' check (line_type in ('EARNING', 'DEDUCTION', 'INFORMATIVE', 'UNKNOWN')),
  rubric_code text,
  rubric_table text,
  rubric_nature text,
  description text,
  reference_value numeric(18,4),
  quantity numeric(18,4),
  factor numeric(18,6),
  amount numeric(18,2) not null default 0,
  raw_payload jsonb,

  created_at timestamptz not null default now()
);

comment on table payroll_esocial_event_items is
  'Rubricas/verbas extraidas de eventos do eSocial. A classificacao contabil definitiva sera configurada em etapa posterior.';

create index if not exists idx_payroll_esocial_event_items_event
  on payroll_esocial_event_items (payroll_event_id, item_order);

alter table payroll_esocial_imports enable row level security;
alter table payroll_esocial_events enable row level security;
alter table payroll_esocial_event_items enable row level security;

drop policy if exists payroll_esocial_imports_select on payroll_esocial_imports;
create policy payroll_esocial_imports_select on payroll_esocial_imports
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists payroll_esocial_imports_insert on payroll_esocial_imports;
create policy payroll_esocial_imports_insert on payroll_esocial_imports
  for insert to authenticated
  with check (can_admin_company(company_id));

drop policy if exists payroll_esocial_imports_update on payroll_esocial_imports;
create policy payroll_esocial_imports_update on payroll_esocial_imports
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

drop policy if exists payroll_esocial_events_select on payroll_esocial_events;
create policy payroll_esocial_events_select on payroll_esocial_events
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists payroll_esocial_events_insert on payroll_esocial_events;
create policy payroll_esocial_events_insert on payroll_esocial_events
  for insert to authenticated
  with check (can_admin_company(company_id));

drop policy if exists payroll_esocial_events_update on payroll_esocial_events;
create policy payroll_esocial_events_update on payroll_esocial_events
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

drop policy if exists payroll_esocial_event_items_select on payroll_esocial_event_items;
create policy payroll_esocial_event_items_select on payroll_esocial_event_items
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists payroll_esocial_event_items_insert on payroll_esocial_event_items;
create policy payroll_esocial_event_items_insert on payroll_esocial_event_items
  for insert to authenticated
  with check (can_admin_company(company_id));

grant select, insert, update on payroll_esocial_imports to authenticated;
grant select, insert, update on payroll_esocial_events to authenticated;
grant select, insert on payroll_esocial_event_items to authenticated;

notify pgrst, 'reload schema';
