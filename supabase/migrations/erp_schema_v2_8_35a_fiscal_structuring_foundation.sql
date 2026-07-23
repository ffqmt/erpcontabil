-- =====================================================================================
-- ERP CONTABIL — v2.8 — ETAPA 35A: CADASTROS FISCAIS ESTRUTURANTES
-- =====================================================================================
-- Escopo fechado em docs/consolidacao-roadmap-fiscal-reforma-35a.md — migration aditiva,
-- idempotente, nao quebra dados legados. NAO cria fiscal_document_item_taxes,
-- tax_reform_rates/tax_rate_rules nem tabela tax_types (isso e Etapa 35C) e NAO toca no
-- enum tax_type nem em CBS/IBS/Imposto Seletivo.
--
-- Blocos:
-- 1) pis_cofins_recovery_settings — destrava o hardcode de PIS/COFINS recuperavel na
--    importacao de XML (antes alíquota fixa no codigo, agora configuracao explicita).
-- 2) Extensao de establishments (a tabela JA EXISTE desde erp_schema_v1_1.sql — so
--    adiciona campos fiscais que faltavam; NAO cria fiscal_establishments paralela).
-- 3) Tabelas de codigo fiscal nacional (NCM/CEST/CFOP/situacao tributaria/servico
--    municipal) — referenciais, somente leitura para usuario comum, sem FK obrigatoria
--    sobre os campos de texto livre ja existentes.
-- 4) partner_item_mappings — mapeamento fornecedor+codigo de produto -> item interno,
--    para o matching conservador de item de XML.
-- 5) fiscal_document_item_review_issues — fila minima de pendencia de classificacao de
--    item (escopo restrito nesta etapa; central de pendencias completa e 35B).
-- 6) Extensao de companies (CNAE) e items (CEST/GTIN/natureza fiscal padrao/uso fiscal).
-- =====================================================================================

-- ---------------------------------------------------------------------------------
-- BLOCO 1 — pis_cofins_recovery_settings
-- ---------------------------------------------------------------------------------
create table if not exists pis_cofins_recovery_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  enabled boolean not null default false,
  pis_rate numeric(7,4) not null default 0,
  cofins_rate numeric(7,4) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  check (pis_rate >= 0 and pis_rate <= 1),
  check (cofins_rate >= 0 and cofins_rate <= 1),
  check (not enabled or (pis_rate > 0 and cofins_rate > 0)),
  unique (company_id)
);
comment on table pis_cofins_recovery_settings is 'Etapa 35A: configuracao explicita de credito de PIS/COFINS na entrada de NF-e (substitui alíquota fixa no codigo). So tem efeito se a empresa estiver no regime Lucro Real (checado em codigo, nao aqui) e enabled=true; sem linha ou enabled=false, a importacao de XML nao recalcula PIS/COFINS.';

drop trigger if exists trg_pis_cofins_recovery_settings_updated_at on pis_cofins_recovery_settings;
create trigger trg_pis_cofins_recovery_settings_updated_at before update on pis_cofins_recovery_settings
  for each row execute function set_updated_at();

create index if not exists idx_pis_cofins_recovery_settings_company on pis_cofins_recovery_settings (company_id);

alter table pis_cofins_recovery_settings enable row level security;

drop policy if exists pis_cofins_recovery_settings_select on pis_cofins_recovery_settings;
create policy pis_cofins_recovery_settings_select on pis_cofins_recovery_settings
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists pis_cofins_recovery_settings_insert on pis_cofins_recovery_settings;
create policy pis_cofins_recovery_settings_insert on pis_cofins_recovery_settings
  for insert to authenticated
  with check (can_admin_company(company_id));

drop policy if exists pis_cofins_recovery_settings_update on pis_cofins_recovery_settings;
create policy pis_cofins_recovery_settings_update on pis_cofins_recovery_settings
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

grant select, insert, update on pis_cofins_recovery_settings to authenticated;

-- ---------------------------------------------------------------------------------
-- BLOCO 2 — extensao de establishments (tabela ja existe desde erp_schema_v1_1.sql)
-- ---------------------------------------------------------------------------------
alter table establishments add column if not exists code text;
alter table establishments add column if not exists name text;
alter table establishments add column if not exists municipality_code text;
alter table establishments add column if not exists address_line text;

comment on column establishments.code is 'Etapa 35A: codigo curto opcional do estabelecimento (interno, nao fiscal) — nullable para nao quebrar registros existentes.';
comment on column establishments.name is 'Etapa 35A: nome amigavel do estabelecimento (ex.: "Filial Cuiaba"). Nullable para nao quebrar registros existentes sem nome definido.';
comment on column establishments.municipality_code is 'Etapa 35A: codigo IBGE do municipio, usado para casar com municipal_service_codes.';
comment on column establishments.address_line is 'Etapa 35A: endereco completo em uma linha (logradouro, numero, bairro).';

-- unique(company_id, code) com code nullable: multiplas linhas com code NULL sao aceitas
-- pelo Postgres (NULL nunca colide consigo mesmo) — nao quebra estabelecimentos existentes
-- sem codigo definido, so impede codigo duplicado quando de fato preenchido.
create unique index if not exists uq_establishments_company_code on establishments (company_id, code) where code is not null;

-- ---------------------------------------------------------------------------------
-- BLOCO 3 — tabelas de codigo fiscal nacional (referenciais, somente leitura p/ usuario)
-- ---------------------------------------------------------------------------------
create table if not exists ncm_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text not null,
  valid_from date,
  valid_until date,
  active boolean not null default true,
  source_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);
comment on table ncm_codes is 'Etapa 35A: tabela referencial de NCM. Escrita apenas via service_role/migracao/import versionado — nenhuma Server Action da aplicacao cria/edita NCM.';

create index if not exists idx_ncm_codes_active on ncm_codes (active);

alter table ncm_codes enable row level security;
drop policy if exists ncm_codes_select on ncm_codes;
create policy ncm_codes_select on ncm_codes for select to authenticated using (true);
grant select on ncm_codes to authenticated;

create table if not exists cest_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  ncm_code text,
  segment text,
  description text not null,
  valid_from date,
  valid_until date,
  active boolean not null default true,
  source_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);
comment on table cest_codes is 'Etapa 35A: tabela referencial de CEST. Mesma politica de escrita de ncm_codes.';

create index if not exists idx_cest_codes_ncm on cest_codes (ncm_code);
create index if not exists idx_cest_codes_active on cest_codes (active);

alter table cest_codes enable row level security;
drop policy if exists cest_codes_select on cest_codes;
create policy cest_codes_select on cest_codes for select to authenticated using (true);
grant select on cest_codes to authenticated;

create table if not exists cfop_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text not null,
  direction text check (direction is null or direction in ('IN', 'OUT')),
  operation_scope text,
  valid_from date,
  valid_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);
comment on table cfop_codes is 'Etapa 35A: tabela referencial de CFOP, usada para autocomplete/validacao na UI — nao vira FK obrigatoria em fiscal_document_items.cfop nesta etapa, para nao quebrar documentos/XMLs antigos com codigos inconsistentes.';

create index if not exists idx_cfop_codes_direction on cfop_codes (direction);
create index if not exists idx_cfop_codes_active on cfop_codes (active);

alter table cfop_codes enable row level security;
drop policy if exists cfop_codes_select on cfop_codes;
create policy cfop_codes_select on cfop_codes for select to authenticated using (true);
grant select on cfop_codes to authenticated;

create table if not exists tax_situation_codes (
  id uuid primary key default gen_random_uuid(),
  tax_family text not null check (tax_family in ('ICMS', 'CSOSN', 'IPI', 'PIS', 'COFINS')),
  code text not null,
  description text not null,
  regime text,
  credit_allowed boolean,
  valid_from date,
  valid_until date,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tax_family, code, regime)
);
comment on table tax_situation_codes is 'Etapa 35A: tabela referencial de CST/CSOSN (ICMS, CSOSN do Simples, IPI, PIS, COFINS), discriminada por tax_family. Cobre os codigos legados hoje digitados como texto livre em fiscal_document_items. A unicidade efetiva e reforcada por indice funcional com coalesce(regime, '''') para tambem impedir duplicatas genericas com regime NULL.';

create index if not exists idx_tax_situation_codes_family on tax_situation_codes (tax_family);
create index if not exists idx_tax_situation_codes_active on tax_situation_codes (active);
create unique index if not exists uq_tax_situation_codes_family_code_regime_coalesced
  on tax_situation_codes (tax_family, code, coalesce(regime, ''));

alter table tax_situation_codes enable row level security;
drop policy if exists tax_situation_codes_select on tax_situation_codes;
create policy tax_situation_codes_select on tax_situation_codes for select to authenticated using (true);
grant select on tax_situation_codes to authenticated;

create table if not exists municipal_service_codes (
  id uuid primary key default gen_random_uuid(),
  municipality_code text,
  national_service_code text,
  municipal_service_code text not null,
  description text not null,
  valid_from date,
  valid_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality_code, municipal_service_code)
);
comment on table municipal_service_codes is 'Etapa 35A: tabela referencial de codigo de servico municipal (LC 116/2003 + variacoes municipais). municipality_code nullable cobre codigos nacionais genericos (LC 116) sem vinculo a um municipio especifico.';

create index if not exists idx_municipal_service_codes_municipality on municipal_service_codes (municipality_code);
create index if not exists idx_municipal_service_codes_active on municipal_service_codes (active);
create unique index if not exists uq_municipal_service_codes_municipality_code_coalesced
  on municipal_service_codes (coalesce(municipality_code, ''), municipal_service_code);

alter table municipal_service_codes enable row level security;
drop policy if exists municipal_service_codes_select on municipal_service_codes;
create policy municipal_service_codes_select on municipal_service_codes for select to authenticated using (true);
grant select on municipal_service_codes to authenticated;

-- ---------------------------------------------------------------------------------
-- BLOCO 4 — partner_item_mappings
-- ---------------------------------------------------------------------------------
create table if not exists partner_item_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  partner_id uuid not null references partners(id) on delete restrict,
  item_id uuid not null references items(id) on delete restrict,
  supplier_product_code text,
  supplier_description text,
  supplier_unit text,
  supplier_ncm text,
  supplier_gtin text,
  confidence numeric(5,2),
  source text not null default 'MANUAL' check (source in ('XML', 'MANUAL')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
comment on table partner_item_mappings is 'Etapa 35A: mapeamento fornecedor+codigo de produto do fornecedor -> item interno. Alimentado pela fila de revisao (fiscal_document_item_review_issues) e por vinculo manual; permite que a proxima importacao do mesmo fornecedor case automaticamente (matching conservador, so quando ha chave forte).';

drop trigger if exists trg_partner_item_mappings_updated_at on partner_item_mappings;
create trigger trg_partner_item_mappings_updated_at before update on partner_item_mappings
  for each row execute function set_updated_at();

create index if not exists idx_partner_item_mappings_company_partner on partner_item_mappings (company_id, partner_id);
-- Indice parcial (nao um constraint simples) porque supplier_product_code pode ser NULL em
-- mapeamentos manuais sem codigo capturado. A unicidade e por mapeamento ativo: historico
-- inativo pode existir sem impedir uma nova resolucao valida para o mesmo fornecedor+codigo.
create unique index if not exists uq_partner_item_mappings_code
  on partner_item_mappings (company_id, partner_id, supplier_product_code)
  where supplier_product_code is not null and active;

alter table partner_item_mappings enable row level security;

drop policy if exists partner_item_mappings_select on partner_item_mappings;
create policy partner_item_mappings_select on partner_item_mappings
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists partner_item_mappings_insert on partner_item_mappings;
create policy partner_item_mappings_insert on partner_item_mappings
  for insert to authenticated
  with check (can_write_company(company_id));

drop policy if exists partner_item_mappings_update on partner_item_mappings;
create policy partner_item_mappings_update on partner_item_mappings
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

grant select, insert, update on partner_item_mappings to authenticated;

-- ---------------------------------------------------------------------------------
-- BLOCO 5 — fiscal_document_item_review_issues (fila minima de classificacao de item)
-- ---------------------------------------------------------------------------------
create table if not exists fiscal_document_item_review_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  fiscal_document_id uuid not null references fiscal_documents(id) on delete cascade,
  fiscal_document_item_id uuid not null references fiscal_document_items(id) on delete cascade,
  issue_type text not null check (issue_type in ('ITEM_WITHOUT_PRODUCT', 'LOW_CONFIDENCE_MATCH')),
  severity text not null default 'WARNING' check (severity in ('INFO', 'WARNING', 'BLOCKING')),
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'IGNORED')),
  suggested_item_id uuid references items(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
comment on table fiscal_document_item_review_issues is 'Etapa 35A: fila minima de pendencia de classificacao de item importado — escopo restrito a "item sem produto"/"match fraco" nesta etapa. A central de pendencias fiscais completa (CFOP invalido, NCM invalido, documento nao contabilizado/apurado, etc.) e Etapa 35B.';

drop trigger if exists trg_fiscal_document_item_review_issues_updated_at on fiscal_document_item_review_issues;
create trigger trg_fiscal_document_item_review_issues_updated_at before update on fiscal_document_item_review_issues
  for each row execute function set_updated_at();

create index if not exists idx_fiscal_item_review_issues_company_status on fiscal_document_item_review_issues (company_id, status);
create index if not exists idx_fiscal_item_review_issues_document on fiscal_document_item_review_issues (fiscal_document_id);
create index if not exists idx_fiscal_item_review_issues_item on fiscal_document_item_review_issues (fiscal_document_item_id);
create unique index if not exists uq_fiscal_item_review_issues_open_item_type
  on fiscal_document_item_review_issues (fiscal_document_item_id, issue_type)
  where status = 'OPEN';

alter table fiscal_document_item_review_issues enable row level security;

drop policy if exists fiscal_item_review_issues_select on fiscal_document_item_review_issues;
create policy fiscal_item_review_issues_select on fiscal_document_item_review_issues
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists fiscal_item_review_issues_insert on fiscal_document_item_review_issues;
create policy fiscal_item_review_issues_insert on fiscal_document_item_review_issues
  for insert to authenticated
  with check (can_write_company(company_id));

drop policy if exists fiscal_item_review_issues_update on fiscal_document_item_review_issues;
create policy fiscal_item_review_issues_update on fiscal_document_item_review_issues
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

grant select, insert, update on fiscal_document_item_review_issues to authenticated;

-- ---------------------------------------------------------------------------------
-- BLOCO 6 — extensao de companies (CNAE) e items (CEST/GTIN/natureza/uso fiscal)
-- ---------------------------------------------------------------------------------
alter table companies add column if not exists main_cnae text;
alter table companies add column if not exists secondary_cnaes text[] not null default '{}'::text[];
comment on column companies.main_cnae is 'Etapa 35A: CNAE principal da empresa. Nullable — nao retroage sobre empresas ja cadastradas.';
comment on column companies.secondary_cnaes is 'Etapa 35A: CNAEs secundarios da empresa, se houver.';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'fiscal_item_usage') then
    create type fiscal_item_usage as enum ('RESALE', 'INPUT', 'FIXED_ASSET', 'USE_CONSUMPTION', 'SERVICE', 'OTHER');
  end if;
end;
$$;
comment on type fiscal_item_usage is 'Etapa 35A: classificacao de uso fiscal do item (revenda, insumo, ativo imobilizado, uso/consumo, servico, outro) — informa credito/regra contabil, nao substitui fiscal_item_type (que classifica o item DENTRO do documento fiscal).';

alter table items add column if not exists cest text;
alter table items add column if not exists gtin text;
alter table items add column if not exists default_fiscal_operation_nature_id uuid references fiscal_operation_natures(id) on delete set null;
alter table items add column if not exists fiscal_item_usage fiscal_item_usage;

comment on column items.cest is 'Etapa 35A: CEST do produto (quando aplicavel), texto livre por enquanto — validado/sugerido via cest_codes na UI.';
comment on column items.gtin is 'Etapa 35A: codigo de barras GTIN/EAN do produto, usado como chave forte adicional no matching de item de XML.';
comment on column items.default_fiscal_operation_nature_id is 'Etapa 35A: natureza fiscal padrao sugerida ao lancar/importar documento com este item — nao e regra obrigatoria, so pre-preenchimento.';
comment on column items.fiscal_item_usage is 'Etapa 35A: uso fiscal do item (RESALE/INPUT/FIXED_ASSET/USE_CONSUMPTION/SERVICE/OTHER) — nao ha CFOP padrao universal por item, pois o CFOP depende da operacao, nao so do produto.';

notify pgrst, 'reload schema';
