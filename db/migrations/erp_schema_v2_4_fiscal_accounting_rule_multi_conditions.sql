-- =====================================================================================
-- ERP CONTABIL — v2.4 — MULTIPLAS CONDICOES EM REGRAS CONTABEIS FISCAIS
-- =====================================================================================
-- Mantem as colunas legadas de condicao unica em fiscal_accounting_rules e adiciona
-- colunas em array para permitir que uma unica regra case com varios CFOPs, naturezas,
-- parceiros, tipos de documento, direcoes, tipos de item e regimes tributarios.
--
-- Sem valores nas listas = qualquer valor, igual ao comportamento anterior quando a
-- coluna legada estava nula.
-- =====================================================================================

alter table fiscal_accounting_rules
  add column if not exists document_types text[] not null default '{}'::text[],
  add column if not exists directions text[] not null default '{}'::text[],
  add column if not exists cfops text[] not null default '{}'::text[],
  add column if not exists cfop_patterns text[] not null default '{}'::text[],
  add column if not exists fiscal_operation_nature_ids uuid[] not null default '{}'::uuid[],
  add column if not exists item_types text[] not null default '{}'::text[],
  add column if not exists partner_ids uuid[] not null default '{}'::uuid[],
  add column if not exists tax_regimes text[] not null default '{}'::text[];

update fiscal_accounting_rules
set document_types = array[document_type]
where document_type is not null
  and cardinality(document_types) = 0;

update fiscal_accounting_rules
set directions = array[direction]
where direction is not null
  and cardinality(directions) = 0;

update fiscal_accounting_rules
set cfops = array[cfop]
where cfop is not null
  and cardinality(cfops) = 0;

update fiscal_accounting_rules
set cfop_patterns = array[cfop_pattern]
where cfop_pattern is not null
  and cardinality(cfop_patterns) = 0;

update fiscal_accounting_rules
set fiscal_operation_nature_ids = array[fiscal_operation_nature_id]
where fiscal_operation_nature_id is not null
  and cardinality(fiscal_operation_nature_ids) = 0;

update fiscal_accounting_rules
set item_types = array[item_type]
where item_type is not null
  and cardinality(item_types) = 0;

update fiscal_accounting_rules
set partner_ids = array[partner_id]
where partner_id is not null
  and cardinality(partner_ids) = 0;

update fiscal_accounting_rules
set tax_regimes = array[tax_regime]
where tax_regime is not null
  and cardinality(tax_regimes) = 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fiscal_accounting_rules_directions_allowed'
  ) then
    alter table fiscal_accounting_rules
      add constraint fiscal_accounting_rules_directions_allowed
      check (directions <@ array['IN', 'OUT']::text[]);
  end if;
end $$;

create index if not exists idx_fiscal_accounting_rules_cfops_gin
  on fiscal_accounting_rules using gin (cfops);

create index if not exists idx_fiscal_accounting_rules_cfop_patterns_gin
  on fiscal_accounting_rules using gin (cfop_patterns);

create index if not exists idx_fiscal_accounting_rules_multi_conditions_company
  on fiscal_accounting_rules (company_id, active, priority);

comment on column fiscal_accounting_rules.cfops is
  'Lista de CFOPs exatos aceitos pela regra. Vazio significa qualquer CFOP. Coluna cfop permanece como fallback legado.';

comment on column fiscal_accounting_rules.cfop_patterns is
  'Lista de prefixos de CFOP aceitos pela regra. Vazio significa qualquer prefixo. Coluna cfop_pattern permanece como fallback legado.';

comment on column fiscal_accounting_rules.fiscal_operation_nature_ids is
  'Lista de naturezas fiscais aceitas pela regra. Vazio significa qualquer natureza. Coluna fiscal_operation_nature_id permanece como fallback legado.';

comment on column fiscal_accounting_rules.partner_ids is
  'Lista de parceiros aceitos pela regra. Vazio significa qualquer parceiro. Coluna partner_id permanece como fallback legado.';

notify pgrst, 'reload schema';
