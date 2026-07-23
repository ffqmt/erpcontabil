-- =====================================================================================
-- ERP CONTABIL — v2.9 — ETAPA 35B: ESCRITURACAO FISCAL OPERACIONAL
-- =====================================================================================
-- Escopo fechado em docs/consolidacao-roadmap-fiscal-reforma-35a.md (35A concluida) +
-- pedido explicito da 35B (central de pendencias, tax_status automatico, validacoes
-- leves). Migration aditiva, idempotente, nao quebra dados legados. NAO cria
-- fiscal_document_item_taxes, tax_reform_rates/tax_rate_rules, tabela tax_types, CBS/IBS/
-- Imposto Seletivo, SPED nem folha — isso continua fora de escopo (35C+).
--
-- Bloco unico: fiscal_document_validation_issues — central de pendencias de escrituracao.
--
-- Decisao de projeto (documentada em docs/etapa35b-escrituracao-fiscal-operacional.md):
-- NAO foi criada uma tabela "tax_assessment_document_links". A tabela tax_assessment_lines
-- (ja existente desde erp_schema_v1_1.sql) ja tem tax_assessment_id + fiscal_document_id
-- por linha e ja e populada/limpa a cada calculo de apuracao (calculateTaxAssessmentAction/
-- calculateIncomeTaxAssessmentAction) — e o vinculo documento<->apuracao persistido que a
-- 35B pedia, so faltava o codigo usar essa informacao para sincronizar
-- fiscal_documents.tax_status (feito em src/modules/tax-assessments/actions.ts, sem
-- migration). Criar uma segunda tabela paralela duplicaria o dado e arriscaria os dois
-- ficarem dessincronizados.
-- =====================================================================================

-- ---------------------------------------------------------------------------------
-- BLOCO 1 — fiscal_document_validation_issues (central de pendencias fiscais)
-- ---------------------------------------------------------------------------------
-- Design hibrido (pedido explicito da 35B): a maioria das pendencias listadas em
-- docs/etapa35b-escrituracao-fiscal-operacional.md e DERIVADA dinamicamente a cada leitura
-- da central (CFOP x direcao, NCM ausente, CST/CSOSN ausente, natureza/parceiro/itens
-- ausentes, nao contabilizado, nao apurado, NFS-e sem retencao, CT-e sem PIS/COFINS,
-- estabelecimento ausente) — nao ha necessidade de persistir o que e 100% recalculavel a
-- partir do estado atual do documento. Esta tabela serve para o que PRECISA de memoria:
-- (a) decisao humana de "ignorar" uma pendencia dinamica especifica (permanente, por
--     documento/item/tipo), e
-- (b) pendencias que fazem mais sentido como registro pontual do momento da importacao.
-- fiscal_document_item_review_issues (35A) continua existindo e sendo usada como fonte
-- separada para "item sem produto"/"match fraco" — a central de pendencias LE das duas
-- tabelas e apresenta tudo junto, sem duplicar o schema da 35A.
create table if not exists fiscal_document_validation_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  fiscal_document_id uuid not null references fiscal_documents(id) on delete cascade,
  fiscal_document_item_id uuid references fiscal_document_items(id) on delete cascade,
  issue_type text not null check (issue_type in (
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
    'CTE_PIS_COFINS_NOT_EXTRACTED'
  )),
  severity text not null check (severity in ('CRITICAL', 'WARNING', 'INFO')),
  message text not null,
  source text not null default 'SYSTEM' check (source in ('XML_IMPORT', 'SYSTEM', 'MANUAL')),
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'IGNORED')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
comment on table fiscal_document_validation_issues is 'Etapa 35B: central de pendencias fiscais. A maioria dos tipos de pendencia e recalculada dinamicamente a cada leitura (nao vive so aqui) — esta tabela persiste principalmente decisoes de "ignorar" e pendencias de importacao de XML. Nao substitui nem duplica fiscal_document_item_review_issues (35A), que continua sendo a fonte de "item sem produto"/"match fraco".';

drop trigger if exists trg_fiscal_document_validation_issues_updated_at on fiscal_document_validation_issues;
create trigger trg_fiscal_document_validation_issues_updated_at before update on fiscal_document_validation_issues
  for each row execute function set_updated_at();

create index if not exists idx_fiscal_validation_issues_company_status on fiscal_document_validation_issues (company_id, status);
create index if not exists idx_fiscal_validation_issues_document on fiscal_document_validation_issues (fiscal_document_id);
create index if not exists idx_fiscal_validation_issues_type on fiscal_document_validation_issues (issue_type);

-- Backstop de integridade (nao usado como alvo de upsert onConflict — a aplicacao sempre
-- faz select-then-insert/update explicito, pelo mesmo motivo documentado na 35A: o
-- shorthand de upsert do Supabase nao casa com indice funcional/parcial).
create unique index if not exists uq_fiscal_validation_issues_doc_item_type
  on fiscal_document_validation_issues (fiscal_document_id, coalesce(fiscal_document_item_id::text, ''), issue_type);

alter table fiscal_document_validation_issues enable row level security;

drop policy if exists fiscal_validation_issues_select on fiscal_document_validation_issues;
create policy fiscal_validation_issues_select on fiscal_document_validation_issues
  for select to authenticated
  using (can_read_company(company_id));

drop policy if exists fiscal_validation_issues_insert on fiscal_document_validation_issues;
create policy fiscal_validation_issues_insert on fiscal_document_validation_issues
  for insert to authenticated
  with check (can_write_company(company_id));

drop policy if exists fiscal_validation_issues_update on fiscal_document_validation_issues;
create policy fiscal_validation_issues_update on fiscal_document_validation_issues
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

grant select, insert, update on fiscal_document_validation_issues to authenticated;

notify pgrst, 'reload schema';
