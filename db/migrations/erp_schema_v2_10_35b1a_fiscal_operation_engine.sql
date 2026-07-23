-- =====================================================================================
-- ERP CONTABIL — v2.10 — ETAPA 35B.1-A: MOTOR OPERACIONAL FISCAL (NATUREZA + REGRAS DE
-- IMPORTAÇÃO)
-- =====================================================================================
-- Escopo fechado em docs/especificacao-fluxo-fiscal-operacional-35b1.md, subetapa 35B.1-A
-- (fundação técnica). Migration aditiva, idempotente, não quebra dados legados. NÃO
-- implementa Painel Fiscal único, redesenho de sidebar, Reforma Tributária/CBS/IBS/IS,
-- SPED nem folha — isso é 35B.1-B ou posterior.
--
-- Blocos:
-- 1) fiscal_operation_natures — campos de comportamento (a natureza deixa de ser só rótulo).
-- 2) fiscal_document_items.xml_cfop — separa CFOP de origem (XML) do CFOP de escrituração.
-- 3) fiscal_import_classification_rules — regras de classificação na importação de XML.
-- 4) fiscal_document_validation_issues — novo tipo de pendência BOOKKEEPING_CFOP_MISSING.
-- 5) Seed mínimo operacional: CFOPs comuns (cfop_codes) e CST/CSOSN/PIS/COFINS comuns
--    (tax_situation_codes). Naturezas Fiscais padrão NÃO são inseridas aqui (a tabela é
--    por empresa — ver seedDefaultFiscalNaturesAction em
--    src/modules/registrations/fiscal-natures/actions.ts, executada sob demanda pelo
--    usuário para a empresa ativa).
-- =====================================================================================

-- ---------------------------------------------------------------------------------
-- BLOCO 1 — fiscal_operation_natures: campos de comportamento
-- ---------------------------------------------------------------------------------
alter table fiscal_operation_natures add column if not exists operation_kind text;
alter table fiscal_operation_natures add column if not exists applicable_document_types text[] not null default '{}'::text[];
alter table fiscal_operation_natures add column if not exists fiscal_purpose fiscal_item_usage;
alter table fiscal_operation_natures add column if not exists default_bookkeeping_cfop text;
alter table fiscal_operation_natures add column if not exists default_tax_situation text;
alter table fiscal_operation_natures add column if not exists icms_treatment text;
alter table fiscal_operation_natures add column if not exists icms_st_treatment text;
alter table fiscal_operation_natures add column if not exists difal_applicable boolean not null default false;
alter table fiscal_operation_natures add column if not exists ipi_treatment text;
alter table fiscal_operation_natures add column if not exists pis_cofins_treatment text;
alter table fiscal_operation_natures add column if not exists iss_treatment text;
alter table fiscal_operation_natures add column if not exists expected_retentions text[] not null default '{}'::text[];
alter table fiscal_operation_natures add column if not exists generates_credit boolean not null default false;
alter table fiscal_operation_natures add column if not exists enters_tax_assessment boolean not null default true;
alter table fiscal_operation_natures add column if not exists triggers_accounting boolean not null default true;
alter table fiscal_operation_natures add column if not exists suggested_accounting_rule_id uuid references fiscal_accounting_rules(id) on delete set null;
alter table fiscal_operation_natures add column if not exists requires_product boolean not null default false;
alter table fiscal_operation_natures add column if not exists requires_ncm boolean not null default false;
alter table fiscal_operation_natures add column if not exists item_nature_default fiscal_item_type;

-- Checks simples, sempre com valor livre permitido via NULL (nenhum campo se torna
-- obrigatório para naturezas já cadastradas) — só restringe o VALOR quando preenchido.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_fiscal_operation_natures_operation_kind') then
    alter table fiscal_operation_natures add constraint chk_fiscal_operation_natures_operation_kind
      check (operation_kind is null or operation_kind in (
        'PURCHASE_MERCHANDISE', 'PURCHASE_INPUT', 'PURCHASE_FIXED_ASSET', 'PURCHASE_USE_CONSUMPTION',
        'SALE_MERCHANDISE', 'SERVICE_PROVIDED', 'SERVICE_TAKEN', 'RETURN_PURCHASE', 'RETURN_SALE',
        'TRANSFER', 'OTHER'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_fiscal_operation_natures_icms_treatment') then
    alter table fiscal_operation_natures add constraint chk_fiscal_operation_natures_icms_treatment
      check (icms_treatment is null or icms_treatment in ('TAXED', 'TAXED_REDUCED_BASE', 'EXEMPT', 'NOT_TAXED', 'SUSPENDED', 'DEFERRED'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_fiscal_operation_natures_icms_st_treatment') then
    alter table fiscal_operation_natures add constraint chk_fiscal_operation_natures_icms_st_treatment
      check (icms_st_treatment is null or icms_st_treatment in ('NONE', 'RETAINED_BY_ISSUER', 'COMPANY_CALCULATES'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_fiscal_operation_natures_ipi_treatment') then
    alter table fiscal_operation_natures add constraint chk_fiscal_operation_natures_ipi_treatment
      check (ipi_treatment is null or ipi_treatment in ('TAXED', 'EXEMPT', 'NOT_TAXED', 'SUSPENDED'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_fiscal_operation_natures_pis_cofins_treatment') then
    alter table fiscal_operation_natures add constraint chk_fiscal_operation_natures_pis_cofins_treatment
      check (pis_cofins_treatment is null or pis_cofins_treatment in ('TAXED', 'TAXED_WITH_CREDIT', 'MONOPHASE', 'SUBSTITUTION', 'EXEMPT'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_fiscal_operation_natures_iss_treatment') then
    alter table fiscal_operation_natures add constraint chk_fiscal_operation_natures_iss_treatment
      check (iss_treatment is null or iss_treatment in ('TAXED_AT_PROVIDER_CITY', 'TAXED_AT_TAKER_CITY', 'EXEMPT', 'IMMUNE', 'WITH_RETENTION'));
  end if;
end;
$$;

comment on column fiscal_operation_natures.operation_kind is 'Etapa 35B.1-A: tipo de operação (compra/venda/serviço/devolução/transferência) — motor operacional da natureza fiscal.';
comment on column fiscal_operation_natures.applicable_document_types is 'Etapa 35B.1-A: tipos de documento (NFE/NFCE/NFSE/CTE/CTE_OS/MANUAL/OTHER) para os quais esta natureza faz sentido — vazio = qualquer tipo.';
comment on column fiscal_operation_natures.fiscal_purpose is 'Etapa 35B.1-A: finalidade fiscal da operação — reaproveita o enum fiscal_item_usage (35A) no nível do documento/operação, não só do produto.';
comment on column fiscal_operation_natures.default_bookkeeping_cfop is 'Etapa 35B.1-A: CFOP de escrituração sugerido para documentos desta natureza. Texto livre — não é FK sobre cfop_codes, mesmo padrão de fiscal_document_items.cfop.';
comment on column fiscal_operation_natures.default_tax_situation is 'Etapa 35B.1-A: CST/CSOSN de ICMS sugerido — texto livre, mesmo padrão de fiscal_document_items.cst_icms/csosn.';
comment on column fiscal_operation_natures.expected_retentions is 'Etapa 35B.1-A: tipos de retenção esperados nesta operação (ISS/INSS_RETIDO/IRRF/PIS/COFINS/PCC) — vira checklist na revisão, nunca lançamento automático de valor.';
comment on column fiscal_operation_natures.enters_tax_assessment is 'Etapa 35B.1-A: se documentos desta natureza contam na apuração tributária automática. Default true preserva o comportamento anterior a esta etapa para naturezas já cadastradas.';
comment on column fiscal_operation_natures.suggested_accounting_rule_id is 'Etapa 35B.1-A: atalho opcional para pré-selecionar uma regra contábil fiscal preferida — não substitui a resolução normal de regras (fiscal_accounting_rules já suporta filtrar por fiscal_operation_nature_id).';
comment on column fiscal_operation_natures.item_nature_default is 'Etapa 35B.1-A: tipo de item padrão (PRODUCT/SERVICE/FREIGHT/ASSET/OTHER) sugerido para documentos desta natureza.';

-- ---------------------------------------------------------------------------------
-- BLOCO 2 — fiscal_document_items.xml_cfop: separa origem (XML) de escrituração
-- ---------------------------------------------------------------------------------
alter table fiscal_document_items add column if not exists xml_cfop text;
comment on column fiscal_document_items.xml_cfop is 'Etapa 35B.1-A: CFOP exatamente como veio no XML de origem — preenchido só na importação, nunca editado depois (registro de auditoria). O CFOP de ESCRITURAÇÃO da empresa continua sendo a coluna "cfop" (já existente). Documentos manuais não preenchem xml_cfop.';

-- ---------------------------------------------------------------------------------
-- BLOCO 3 — fiscal_import_classification_rules
-- ---------------------------------------------------------------------------------
create table if not exists fiscal_import_classification_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,

  name text not null,
  description text,
  priority int not null default 100,
  active boolean not null default true,

  -- Condições (null = coringa, casa com qualquer valor)
  partner_id uuid references partners(id) on delete set null,
  issuer_cnpj text,
  xml_cfop_pattern text,
  ncm_pattern text,
  cest text,
  item_id uuid references items(id) on delete set null,
  supplier_product_code text,
  supplier_description_pattern text,
  document_type text,
  direction text check (direction is null or direction in ('IN', 'OUT')),
  origin_state char(2),
  destination_state char(2),
  municipality_code text,
  min_amount numeric(18,2),
  max_amount numeric(18,2),

  -- Ações
  fiscal_operation_nature_id uuid references fiscal_operation_natures(id) on delete set null,
  bookkeeping_cfop text,
  tax_situation_code text,
  item_fiscal_usage fiscal_item_usage,
  item_kind fiscal_item_type,
  generates_credit boolean,
  expected_retentions text[],
  create_partner_item_mapping boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
comment on table fiscal_import_classification_rules is 'Etapa 35B.1-A: regras de classificação fiscal na importação de XML. Mesmo padrão de fiscal_accounting_rules (Etapa 32C): condições coringa-quando-nulas, priority numérica, regra de menor priority que casar primeiro é aplicada — mas aqui com condições de valor único (não arrays), conforme escopo fechado da especificação.';

drop trigger if exists trg_fiscal_import_classification_rules_updated_at on fiscal_import_classification_rules;
create trigger trg_fiscal_import_classification_rules_updated_at before update on fiscal_import_classification_rules
  for each row execute function set_updated_at();

create index if not exists idx_fiscal_import_rules_company on fiscal_import_classification_rules (company_id);
create index if not exists idx_fiscal_import_rules_active on fiscal_import_classification_rules (active);
create index if not exists idx_fiscal_import_rules_priority on fiscal_import_classification_rules (priority);
create index if not exists idx_fiscal_import_rules_partner on fiscal_import_classification_rules (partner_id);
create index if not exists idx_fiscal_import_rules_issuer_cnpj on fiscal_import_classification_rules (issuer_cnpj);
create index if not exists idx_fiscal_import_rules_document_type on fiscal_import_classification_rules (document_type);
create index if not exists idx_fiscal_import_rules_direction on fiscal_import_classification_rules (direction);
create index if not exists idx_fiscal_import_rules_xml_cfop_pattern on fiscal_import_classification_rules (xml_cfop_pattern);
create index if not exists idx_fiscal_import_rules_ncm_pattern on fiscal_import_classification_rules (ncm_pattern);

alter table fiscal_import_classification_rules enable row level security;

drop policy if exists fiscal_import_classification_rules_select on fiscal_import_classification_rules;
create policy fiscal_import_classification_rules_select on fiscal_import_classification_rules
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists fiscal_import_classification_rules_insert on fiscal_import_classification_rules;
create policy fiscal_import_classification_rules_insert on fiscal_import_classification_rules
  for insert to authenticated
  with check (can_write_company(company_id));

drop policy if exists fiscal_import_classification_rules_update on fiscal_import_classification_rules;
create policy fiscal_import_classification_rules_update on fiscal_import_classification_rules
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

drop policy if exists fiscal_import_classification_rules_delete on fiscal_import_classification_rules;
create policy fiscal_import_classification_rules_delete on fiscal_import_classification_rules
  for delete to authenticated
  using (can_write_company(company_id));

grant select, insert, update, delete on fiscal_import_classification_rules to authenticated;

-- ---------------------------------------------------------------------------------
-- BLOCO 4 — fiscal_document_validation_issues: novo tipo BOOKKEEPING_CFOP_MISSING
-- ---------------------------------------------------------------------------------
-- A 35B criou o check inline (nome default do Postgres para check de coluna:
-- {tabela}_{coluna}_check) restrito à lista fechada de tipos daquela etapa. Alarga aqui de
-- forma idempotente para incluir o novo tipo desta subetapa, sem remover nenhum valor
-- existente.
alter table fiscal_document_validation_issues drop constraint if exists fiscal_document_validation_issues_issue_type_check;
alter table fiscal_document_validation_issues add constraint fiscal_document_validation_issues_issue_type_check
  check (issue_type in (
    'CFOP_MISSING',
    'CFOP_DIRECTION_MISMATCH',
    'NCM_MISSING',
    'TAX_SITUATION_CODE_MISSING',
    'FISCAL_NATURE_MISSING',
    'PARTNER_MISSING',
    'NO_ITEMS',
    'NOT_ACCOUNTED',
    'NOT_ASSESSED',
    'ESTABLISHMENT_MISSING',
    'NFSE_RETENTION_REVIEW',
    'CTE_PIS_COFINS_NOT_EXTRACTED',
    'BOOKKEEPING_CFOP_MISSING'
  ));

-- ---------------------------------------------------------------------------------
-- BLOCO 5 — Seed mínimo operacional (só código/rótulo — nenhuma alíquota)
-- ---------------------------------------------------------------------------------
insert into cfop_codes (code, description, direction, operation_scope, active) values
  ('1102', 'Compra para comercialização', 'IN', 'INTERNAL', true),
  ('1152', 'Transferência para comercialização', 'IN', 'INTERNAL', true),
  ('1556', 'Compra de material para uso ou consumo', 'IN', 'INTERNAL', true),
  ('1901', 'Entrada para industrialização por encomenda', 'IN', 'INTERNAL', true),
  ('2102', 'Compra para comercialização', 'IN', 'INTERSTATE', true),
  ('2401', 'Compra para comercialização em operação com mercadoria sujeita a ICMS-ST', 'IN', 'INTERSTATE', true),
  ('5102', 'Venda de mercadoria adquirida ou recebida de terceiros', 'OUT', 'INTERNAL', true),
  ('5152', 'Transferência de mercadoria adquirida ou recebida de terceiros', 'OUT', 'INTERNAL', true),
  ('5401', 'Venda de produção do estabelecimento em operação com mercadoria sujeita a ICMS-ST', 'OUT', 'INTERNAL', true),
  ('5405', 'Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita a ICMS-ST', 'OUT', 'INTERNAL', true),
  ('5933', 'Prestação de serviço tributado pelo ISSQN', 'OUT', 'INTERNAL', true),
  ('6108', 'Venda de mercadoria adquirida ou recebida de terceiros, destinada a não contribuinte', 'OUT', 'INTERSTATE', true)
on conflict (code) do nothing;
comment on table cfop_codes is 'Etapa 35A: tabela referencial de CFOP, usada para autocomplete/validacao na UI — nao vira FK obrigatoria em fiscal_document_items.cfop nesta etapa. Etapa 35B.1-A: seed mínimo com os 12 CFOPs mais comuns de compra/venda — descrições padrão da Tabela CFOP nacional, sem alíquota. Revisar contra a fonte oficial antes de depender em produção fiscal crítica.';

insert into tax_situation_codes (tax_family, code, description, active) values
  ('ICMS', '00', 'Tributada integralmente', true),
  ('ICMS', '10', 'Tributada e com cobrança do ICMS por substituição tributária', true),
  ('ICMS', '20', 'Com redução de base de cálculo', true),
  ('ICMS', '40', 'Isenta', true),
  ('ICMS', '41', 'Não tributada', true),
  ('ICMS', '50', 'Suspensão', true),
  ('ICMS', '51', 'Diferimento', true),
  ('ICMS', '60', 'ICMS cobrado anteriormente por substituição tributária', true),
  ('ICMS', '90', 'Outras', true),
  ('CSOSN', '101', 'Tributada pelo Simples Nacional com permissão de crédito', true),
  ('CSOSN', '102', 'Tributada pelo Simples Nacional sem permissão de crédito', true),
  ('CSOSN', '103', 'Isenção do ICMS no Simples Nacional para faixa de receita bruta', true),
  ('CSOSN', '201', 'Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por substituição tributária', true),
  ('CSOSN', '202', 'Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por substituição tributária', true),
  ('CSOSN', '203', 'Isenção do ICMS no Simples Nacional para faixa de receita bruta e com cobrança do ICMS por substituição tributária', true),
  ('CSOSN', '300', 'Imune', true),
  ('CSOSN', '400', 'Não tributada pelo Simples Nacional', true),
  ('CSOSN', '500', 'ICMS cobrado anteriormente por substituição tributária ou por antecipação', true),
  ('CSOSN', '900', 'Outros', true),
  ('PIS', '01', 'Operação tributável com alíquota básica', true),
  ('PIS', '02', 'Operação tributável com alíquota diferenciada', true),
  ('PIS', '04', 'Operação tributável monofásica — revenda a alíquota zero', true),
  ('PIS', '06', 'Operação tributável a alíquota zero', true),
  ('PIS', '07', 'Operação isenta da contribuição', true),
  ('PIS', '08', 'Operação sem incidência da contribuição', true),
  ('PIS', '09', 'Operação com suspensão da contribuição', true),
  ('PIS', '49', 'Outras operações de saída', true),
  ('PIS', '50', 'Operação com direito a crédito — vinculada exclusivamente a receita tributada no mercado interno', true),
  ('PIS', '70', 'Operação de aquisição sem direito a crédito', true),
  ('PIS', '98', 'Outras operações de entrada', true),
  ('PIS', '99', 'Outras operações', true),
  ('COFINS', '01', 'Operação tributável com alíquota básica', true),
  ('COFINS', '02', 'Operação tributável com alíquota diferenciada', true),
  ('COFINS', '04', 'Operação tributável monofásica — revenda a alíquota zero', true),
  ('COFINS', '06', 'Operação tributável a alíquota zero', true),
  ('COFINS', '07', 'Operação isenta da contribuição', true),
  ('COFINS', '08', 'Operação sem incidência da contribuição', true),
  ('COFINS', '09', 'Operação com suspensão da contribuição', true),
  ('COFINS', '49', 'Outras operações de saída', true),
  ('COFINS', '50', 'Operação com direito a crédito — vinculada exclusivamente a receita tributada no mercado interno', true),
  ('COFINS', '70', 'Operação de aquisição sem direito a crédito', true),
  ('COFINS', '98', 'Outras operações de entrada', true),
  ('COFINS', '99', 'Outras operações', true)
on conflict on constraint uq_tax_situation_codes_family_code_regime_coalesced do nothing;
comment on table tax_situation_codes is 'Etapa 35A: tabela referencial de CST/CSOSN (ICMS, CSOSN do Simples, IPI, PIS, COFINS). Etapa 35B.1-A: seed mínimo com os códigos de CST ICMS/CSOSN/CST PIS/CST COFINS mais comuns — sem alíquota nenhuma (alíquota depende de regime/produto/UF e não é assumida aqui).';

notify pgrst, 'reload schema';
