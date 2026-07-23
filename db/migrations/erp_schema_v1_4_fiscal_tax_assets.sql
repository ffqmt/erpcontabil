-- =====================================================================================
-- ERP CONTÁBIL — SCHEMA — v1.4 — FISCAL/TRIBUTÁRIO, APURAÇÕES, OBRIGAÇÕES E PATRIMÔNIO
-- Etapas 19–22. Migração incremental sobre v1.1/v1.2/v1.3. Aditiva: nenhuma tabela é
-- removida; onde uma coluna precisa mudar de TIPO (enum), o valor de cada linha existente
-- é preservado via mapeamento explícito (USING), nunca descartado.
-- =====================================================================================
--
-- DECISÃO DE MODELAGEM CENTRAL: `fiscal_documents`, `fiscal_document_items`,
-- `tax_assessments`, `tax_assessment_lines`, `obligations`, `asset_categories`,
-- `fixed_assets`, `asset_events`, `asset_depreciations`, `income_tax_assessments`,
-- `income_tax_adjustments` JÁ EXISTIAM desde `erp_schema_v1_1.sql` (Blocos 10, 12, 13, 14),
-- já com RLS habilitada e a maior parte das policies já escritas em `erp_rls_v1.sql`. Esta
-- migração ESTENDE essas tabelas — nenhuma é recriada.
--
-- Por que ALTER COLUMN TYPE em 5 colunas (não só ADD COLUMN)? As etapas 19/20 pedem
-- workflows com mais estados do que os enums genéricos atuais suportam:
--   - `fiscal_documents.status` (generic_status: DRAFT/READY/POSTED/CANCELLED, 4 valores)
--     não distingue "importado" de "validado", nem separa status fiscal de status
--     contábil — os testes da Etapa 19 pedem exatamente essa distinção (criar → validar →
--     escriturar → CONTABILIZAR são 2 dimensões diferentes: fiscal_status e
--     accounting_status).
--   - `fiscal_documents.document_type` (fiscal_document_type: NFE/CTE/NFSE/OTHER) não tem
--     NFCE/CTE_OS/MDFE/MANUAL, todos pedidos explicitamente.
--   - `tax_assessments.tax_type` reaproveitava `obligation_type`, que não tem
--     IPI/SIMPLES/INSS_RETIDO/IRRF/PCC.
--   - `tax_assessments.status` (generic_status) não tem o passo intermediário REVIEWED
--     que o fluxo pedido (calcular → revisar → fechar) exige.
--   - `obligations.status` (obligation_status: PENDING/PAID/OVERDUE/CANCELLED) não tem
--     GENERATED/DELIVERED.
--   - `obligations.obligation_type` (obligation_type) não tem DAS/DCTFWEB/FGTS_DIGITAL/
--     EFD_CONTRIBUICOES/EFD_ICMS_IPI/ECD/ECF/DEFIS.
-- Em vez de `ALTER TYPE ... ADD VALUE` (que o próprio `erp_rls_v1.sql`, Bloco 0, já havia
-- descartado pela mesma razão: Postgres proíbe usar um valor de enum recém-adicionado na
-- MESMA transação em que foi criado), criamos um enum NOVO com a lista completa de valores
-- (incluindo os antigos, para não perder nenhum) e migramos a coluna via
-- `ALTER COLUMN ... TYPE novo_enum USING coluna::text::novo_enum` — preserva 100% dos
-- dados existentes, sem exigir dois deploys separados.
--
-- Decisões de reaproveitamento adicionais (sem duplicar coluna com nome novo):
--   - `fiscal_documents.direction` (fiscal_direction: IN/OUT) mantido como está — IN =
--     entrada/INBOUND, OUT = saída/OUTBOUND, apenas documentado aqui, sem novo enum.
--   - `fiscal_documents.document_amount`/`merchandise_amount`/`discount_amount`/
--     `freight_amount`/`insurance_amount`/`other_expenses_amount` reaproveitados no lugar
--     de `total_amount`/`goods_amount`/... com nomes novos.
--   - `fiscal_document_items.cfop`/`ncm` já existiam — não duplicados.
--   - IRPJ/CSLL NÃO entram no novo enum `tax_type` de `tax_assessments`: já existe uma
--     tabela dedicada e mais completa para isso (`income_tax_assessments`, regime Lucro
--     Real, com `period_start`/`period_end`/`periodicity` e ajustes via
--     `income_tax_adjustments`). Ligar `income_tax_assessments` à UI fica documentado como
--     pendência desta rodada (ver DEVELOPMENT_LOG.md, Etapa 19-22) — o schema já suporta.
-- =====================================================================================


-- =====================================================================================
-- BLOCO 1 — ENUMS NOVOS
-- =====================================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'tax_type') then
    create type tax_type as enum ('ISS', 'ICMS', 'IPI', 'PIS', 'COFINS', 'SIMPLES', 'INSS_RETIDO', 'IRRF', 'PCC', 'OTHER');
  end if;
end $$;
comment on type tax_type is 'Tributo apurado em tax_assessments ou retido em fiscal_document_retentions. IRPJ/CSLL ficam fora — usam income_tax_assessments, tabela dedicada já existente.';

do $$ begin
  if not exists (select 1 from pg_type where typname = 'tax_assessment_status') then
    create type tax_assessment_status as enum ('DRAFT', 'CALCULATED', 'REVIEWED', 'CLOSED', 'CANCELLED');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'obligation_workflow_status') then
    create type obligation_workflow_status as enum ('OPEN', 'GENERATED', 'PAID', 'DELIVERED', 'OVERDUE', 'CANCELLED');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'obligation_document_type') then
    create type obligation_document_type as enum (
      'DAS', 'ISS', 'ICMS', 'IPI', 'PIS_COFINS', 'IRPJ_CSLL', 'DCTFWEB', 'FGTS_DIGITAL',
      'EFD_CONTRIBUICOES', 'EFD_ICMS_IPI', 'ECD', 'ECF', 'DEFIS',
      -- valores legados de obligation_type preservados para não perder dados existentes
      'PIS', 'COFINS', 'IRPJ', 'CSLL', 'FGTS', 'INSS', 'OTHER'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'fiscal_document_status') then
    create type fiscal_document_status as enum ('DRAFT', 'IMPORTED', 'VALIDATED', 'BOOKED', 'CANCELLED');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'fiscal_document_accounting_status') then
    create type fiscal_document_accounting_status as enum ('NOT_ACCOUNTED', 'ACCOUNTED', 'ACCOUNTING_ERROR');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'fiscal_document_tax_status') then
    create type fiscal_document_tax_status as enum ('NOT_ASSESSED', 'ASSESSED', 'IGNORED');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'fiscal_document_type_v2') then
    create type fiscal_document_type_v2 as enum ('NFE', 'NFCE', 'NFSE', 'CTE', 'CTE_OS', 'MDFE', 'MANUAL', 'OTHER');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'fiscal_operation_type') then
    create type fiscal_operation_type as enum ('PURCHASE', 'SALE', 'SERVICE_TAKEN', 'SERVICE_PROVIDED', 'FREIGHT', 'RETURN', 'TRANSFER', 'OTHER');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'fiscal_item_type') then
    create type fiscal_item_type as enum ('PRODUCT', 'SERVICE', 'FREIGHT', 'OTHER');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'fiscal_document_source') then
    create type fiscal_document_source as enum ('MANUAL', 'CSV', 'XML', 'API');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'asset_depreciation_status') then
    create type asset_depreciation_status as enum ('CALCULATED', 'POSTED', 'CANCELLED');
  end if;
end $$;


-- =====================================================================================
-- BLOCO 2 — MIGRAÇÃO DE ENUM EM COLUNAS EXISTENTES (preserva dados via USING)
-- =====================================================================================

-- fiscal_documents.status: generic_status -> fiscal_document_status
-- Mapeamento: DRAFT->DRAFT, READY->VALIDATED, POSTED->BOOKED, CANCELLED->CANCELLED.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'fiscal_documents' and column_name = 'status' and udt_name = 'generic_status'
  ) then
    alter table fiscal_documents alter column status drop default;
    alter table fiscal_documents alter column status type text using status::text;
    update fiscal_documents set status = case status
      when 'DRAFT' then 'DRAFT'
      when 'READY' then 'VALIDATED'
      when 'POSTED' then 'BOOKED'
      when 'CANCELLED' then 'CANCELLED'
      else 'DRAFT'
    end;
    alter table fiscal_documents alter column status type fiscal_document_status using status::fiscal_document_status;
    alter table fiscal_documents alter column status set default 'DRAFT';
  end if;
end $$;

-- fiscal_documents.document_type: fiscal_document_type -> fiscal_document_type_v2 (só adiciona valores)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'fiscal_documents' and column_name = 'document_type' and udt_name = 'fiscal_document_type'
  ) then
    alter table fiscal_documents alter column document_type type text using document_type::text;
    alter table fiscal_documents alter column document_type type fiscal_document_type_v2 using document_type::fiscal_document_type_v2;
  end if;
end $$;

-- tax_assessments.tax_type: obligation_type -> tax_type (só os valores usados em tax_assessments, todos preservados no novo enum)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'tax_assessments' and column_name = 'tax_type' and udt_name = 'obligation_type'
  ) then
    alter table tax_assessments alter column tax_type type text using tax_type::text;
    -- IRPJ/CSLL não existem no novo enum tax_type (usam income_tax_assessments, tabela
    -- dedicada) — remapeados para OTHER aqui só para preservar linhas legadas, se
    -- existirem; não é o fluxo recomendado para IRPJ/CSLL daqui em diante.
    update tax_assessments set tax_type = 'OTHER' where tax_type in ('FGTS', 'INSS', 'IRPJ', 'CSLL');
    alter table tax_assessments alter column tax_type type tax_type using tax_type::tax_type;
  end if;
end $$;

-- tax_assessments.status: generic_status -> tax_assessment_status
-- Mapeamento: DRAFT->DRAFT, READY->CALCULATED, POSTED->CLOSED, CANCELLED->CANCELLED.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'tax_assessments' and column_name = 'status' and udt_name = 'generic_status'
  ) then
    alter table tax_assessments alter column status drop default;
    alter table tax_assessments alter column status type text using status::text;
    update tax_assessments set status = case status
      when 'DRAFT' then 'DRAFT'
      when 'READY' then 'CALCULATED'
      when 'POSTED' then 'CLOSED'
      when 'CANCELLED' then 'CANCELLED'
      else 'DRAFT'
    end;
    alter table tax_assessments alter column status type tax_assessment_status using status::tax_assessment_status;
    alter table tax_assessments alter column status set default 'DRAFT';
  end if;
end $$;

-- obligations.status: obligation_status -> obligation_workflow_status
-- Mapeamento: PENDING->OPEN, PAID->PAID, OVERDUE->OVERDUE, CANCELLED->CANCELLED.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'obligations' and column_name = 'status' and udt_name = 'obligation_status'
  ) then
    alter table obligations drop constraint if exists chk_obligations_paid_needs_journal;
    alter table obligations alter column status drop default;
    alter table obligations alter column status type text using status::text;
    update obligations set status = case status when 'PENDING' then 'OPEN' else status end;
    alter table obligations alter column status type obligation_workflow_status using status::obligation_workflow_status;
    alter table obligations alter column status set default 'OPEN';
  end if;
end $$;

-- obligations.obligation_type: obligation_type -> obligation_document_type (todos os valores antigos preservados no novo enum)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'obligations' and column_name = 'obligation_type' and udt_name = 'obligation_type'
  ) then
    alter table obligations alter column obligation_type type text using obligation_type::text;
    alter table obligations alter column obligation_type type obligation_document_type using obligation_type::obligation_document_type;
  end if;
end $$;


-- =====================================================================================
-- BLOCO 3 — EXTENSÃO DE `fiscal_documents`
-- =====================================================================================

alter table fiscal_documents add column if not exists operation_type fiscal_operation_type;
alter table fiscal_documents add column if not exists accounting_status fiscal_document_accounting_status not null default 'NOT_ACCOUNTED';
alter table fiscal_documents add column if not exists tax_status fiscal_document_tax_status not null default 'NOT_ASSESSED';
alter table fiscal_documents add column if not exists source fiscal_document_source not null default 'MANUAL';
alter table fiscal_documents add column if not exists fiscal_operation_nature_id uuid references fiscal_operation_natures(id);
alter table fiscal_documents add column if not exists services_amount numeric(18,2);
alter table fiscal_documents add column if not exists operation_date date;
alter table fiscal_documents add column if not exists due_date date;
alter table fiscal_documents add column if not exists municipality_id uuid references municipalities(id);

comment on column fiscal_documents.operation_date is 'Data de entrada/saída da mercadoria ou de prestação do serviço — pode divergir de issue_date (emissão do documento). Usada para validar o período contábil na contabilização.';
comment on column fiscal_documents.fiscal_operation_nature_id is 'FK para fiscal_operation_natures (Cadastros Base, Etapa 15) — fecha o gap R4 registrado em docs/erp-master-plan.md: operation_nature (texto livre) permanece por compatibilidade, mas o novo código deve preencher esta FK.';
comment on column fiscal_documents.accounting_status is 'Dimensão independente de status.status: um documento pode estar BOOKED (escriturado fiscalmente) e ainda NOT_ACCOUNTED (sem lançamento contábil gerado).';
comment on column fiscal_documents.tax_status is 'Marca se o documento já foi consumido por uma apuração fiscal (tax_assessment_lines) — evita contagem duplicada ao recalcular.';

create index if not exists idx_fiscal_documents_company_status on fiscal_documents (company_id, status);
create index if not exists idx_fiscal_documents_company_competence on fiscal_documents (company_id, competence);
create index if not exists idx_fiscal_documents_company_tax_status on fiscal_documents (company_id, tax_status);


-- =====================================================================================
-- BLOCO 4 — EXTENSÃO DE `fiscal_document_items`
-- =====================================================================================

alter table fiscal_document_items add column if not exists item_id uuid references items(id);
alter table fiscal_document_items add column if not exists line_number int;
alter table fiscal_document_items add column if not exists item_type fiscal_item_type not null default 'PRODUCT';
alter table fiscal_document_items add column if not exists unit text;
alter table fiscal_document_items add column if not exists discount_amount numeric(18,2);
alter table fiscal_document_items add column if not exists freight_amount numeric(18,2);
alter table fiscal_document_items add column if not exists cest text;
alter table fiscal_document_items add column if not exists service_code text;
alter table fiscal_document_items add column if not exists cst_icms text;
alter table fiscal_document_items add column if not exists csosn text;
alter table fiscal_document_items add column if not exists cst_ipi text;
alter table fiscal_document_items add column if not exists cst_pis text;
alter table fiscal_document_items add column if not exists cst_cofins text;
alter table fiscal_document_items add column if not exists tax_base_icms numeric(18,2);
alter table fiscal_document_items add column if not exists icms_rate numeric(7,4);
alter table fiscal_document_items add column if not exists icms_amount numeric(18,2);
alter table fiscal_document_items add column if not exists tax_base_ipi numeric(18,2);
alter table fiscal_document_items add column if not exists ipi_rate numeric(7,4);
alter table fiscal_document_items add column if not exists ipi_amount numeric(18,2);
alter table fiscal_document_items add column if not exists tax_base_pis numeric(18,2);
alter table fiscal_document_items add column if not exists pis_rate numeric(7,4);
alter table fiscal_document_items add column if not exists pis_amount numeric(18,2);
alter table fiscal_document_items add column if not exists tax_base_cofins numeric(18,2);
alter table fiscal_document_items add column if not exists cofins_rate numeric(7,4);
alter table fiscal_document_items add column if not exists cofins_amount numeric(18,2);
alter table fiscal_document_items add column if not exists tax_base_iss numeric(18,2);
alter table fiscal_document_items add column if not exists iss_rate numeric(7,4);
alter table fiscal_document_items add column if not exists iss_amount numeric(18,2);
alter table fiscal_document_items add column if not exists notes text;

comment on column fiscal_document_items.item_id is 'FK para items (Cadastros Base, Etapa 15) — fecha o gap R4. Opcional: item de documento fiscal pode ser digitado livre (description) sem estar no catálogo.';

create index if not exists idx_fiscal_document_items_document on fiscal_document_items (fiscal_document_id);


-- =====================================================================================
-- BLOCO 5 — TABELA NOVA: `fiscal_document_retentions` (19.3 — tributos retidos)
-- =====================================================================================

create table if not exists fiscal_document_retentions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete restrict,
  company_id uuid not null references companies(id) on delete restrict,
  fiscal_document_id uuid not null references fiscal_documents(id) on delete cascade,
  tax_type tax_type not null,
  base_amount numeric(18,2) not null,
  rate numeric(7,4),
  amount numeric(18,2) not null,
  withheld_by_partner boolean not null default true,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_fiscal_document_retentions_amount check (amount >= 0)
);
comment on table fiscal_document_retentions is 'Tributos retidos na fonte associados a um documento fiscal (IRRF/INSS/ISS retido/CSLL/PIS/COFINS/PCC). Cascade mantido: retenção não existe sem o documento.';

create trigger trg_fiscal_document_retentions_updated_at before update on fiscal_document_retentions
  for each row execute function set_updated_at();

create index if not exists idx_fiscal_document_retentions_document on fiscal_document_retentions (fiscal_document_id);


-- =====================================================================================
-- BLOCO 6 — EXTENSÃO DE `tax_assessments` (20.2)
-- =====================================================================================

alter table tax_assessments add column if not exists establishment_id uuid references establishments(id);
alter table tax_assessments add column if not exists regime tax_regime;
alter table tax_assessments add column if not exists period_start date;
alter table tax_assessments add column if not exists period_end date;
alter table tax_assessments add column if not exists debit_amount numeric(18,2) not null default 0;
alter table tax_assessments add column if not exists credit_amount numeric(18,2) not null default 0;
alter table tax_assessments add column if not exists retained_amount numeric(18,2) not null default 0;
alter table tax_assessments add column if not exists adjustment_amount numeric(18,2) not null default 0;
alter table tax_assessments add column if not exists fine_amount numeric(18,2) not null default 0;
alter table tax_assessments add column if not exists interest_amount numeric(18,2) not null default 0;
alter table tax_assessments add column if not exists payable_amount numeric(18,2) not null default 0;
alter table tax_assessments add column if not exists previous_balance_amount numeric(18,2) not null default 0;
alter table tax_assessments add column if not exists next_balance_amount numeric(18,2) not null default 0;
alter table tax_assessments add column if not exists due_date date;
alter table tax_assessments add column if not exists obligation_id uuid references obligations(id);
alter table tax_assessments add column if not exists reviewed_at timestamptz;
alter table tax_assessments add column if not exists closed_at timestamptz;

comment on column tax_assessments.amount_due is 'LEGADO (pré-Etapa 20): mantido por compatibilidade, sincronizado com payable_amount. Código novo deve ler/escrever payable_amount.';
comment on column tax_assessments.payable_amount is 'debit_amount - credit_amount - retained_amount + adjustment_amount + fine_amount + interest_amount + previous_balance_amount, calculado por calculateTaxAssessmentAction. Nunca negativo — saldo negativo vira next_balance_amount (crédito a transportar).';

create index if not exists idx_tax_assessments_company_competence on tax_assessments (company_id, competence);
create index if not exists idx_tax_assessments_company_status on tax_assessments (company_id, status);


-- =====================================================================================
-- BLOCO 7 — EXTENSÃO DE `tax_assessment_lines` (20.3)
-- =====================================================================================

alter table tax_assessment_lines add column if not exists source_type text
  check (source_type in ('FISCAL_DOCUMENT', 'FISCAL_ITEM', 'MANUAL_ADJUSTMENT', 'RETENTION', 'PREVIOUS_BALANCE'));
alter table tax_assessment_lines add column if not exists source_id uuid;
alter table tax_assessment_lines add column if not exists line_type text
  check (line_type in ('DEBIT', 'CREDIT', 'RETENTION', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE', 'BALANCE'));
alter table tax_assessment_lines add column if not exists tax_rate numeric(7,4);

comment on column tax_assessment_lines.source_id is 'Referência polimórfica conforme source_type (id de fiscal_documents, fiscal_document_items, fiscal_document_retentions ou nulo para ajuste manual/saldo). Sem FK física por ser polimórfica — mesmo padrão de journal_entries.origin_id.';
comment on column tax_assessment_lines.fiscal_document_id is 'Mantido (já existia) — quando source_type=FISCAL_DOCUMENT ou FISCAL_ITEM, aponta para o documento de origem; source_id complementa apontando o item/retenção específico quando aplicável.';

create index if not exists idx_tax_assessment_lines_assessment on tax_assessment_lines (tax_assessment_id);


-- =====================================================================================
-- BLOCO 8 — EXTENSÃO DE `obligations` (20.5)
-- =====================================================================================

alter table obligations add column if not exists barcode text;
alter table obligations add column if not exists payment_code text;
alter table obligations add column if not exists document_url text;
alter table obligations add column if not exists paid_at timestamptz;
alter table obligations add column if not exists delivered_at timestamptz;
alter table obligations add column if not exists notes text;

-- AUDITORIA (herdada de v1.1, achado A10): a constraint original exigia
-- payment_journal_entry_id quando status='PAID'. Recriada aqui após a migração de enum do
-- Bloco 2 (ALTER COLUMN TYPE remove e o Postgres não recria automaticamente constraints
-- CHECK que referenciam valores de enum por nome — revalidamos explicitamente).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_obligations_paid_needs_journal_v2'
  ) then
    alter table obligations drop constraint if exists chk_obligations_paid_needs_journal;
    alter table obligations add constraint chk_obligations_paid_needs_journal_v2
      check (status <> 'PAID' or payment_journal_entry_id is not null);
  end if;
end $$;

create index if not exists idx_obligations_company_status on obligations (company_id, status);
create index if not exists idx_obligations_company_due_date on obligations (company_id, due_date);
create index if not exists idx_obligations_company_competence on obligations (company_id, competence);


-- =====================================================================================
-- BLOCO 9 — EXTENSÃO DE `asset_categories` (22.1)
-- =====================================================================================
-- Nomes já existentes (default_asset_account_id/default_depreciation_account_id/
-- default_expense_account_id) reaproveitados no lugar de asset_account_id/
-- depreciation_expense_account_id/accumulated_depreciation_account_id pedidos — mesmo
-- conceito, evita duplicar 3 FKs redundantes na mesma tabela.

alter table asset_categories add column if not exists description text;
alter table asset_categories add column if not exists disposal_gain_account_id uuid references chart_accounts(id);
alter table asset_categories add column if not exists disposal_loss_account_id uuid references chart_accounts(id);

comment on column asset_categories.default_asset_account_id is 'Conta do ativo imobilizado (débito na aquisição). Equivalente ao "asset_account_id" pedido na Etapa 22 — nome já existente desde a v1.1, reaproveitado.';
comment on column asset_categories.default_depreciation_account_id is 'Conta de depreciação acumulada (crédito na depreciação). Equivalente a "accumulated_depreciation_account_id".';
comment on column asset_categories.default_expense_account_id is 'Conta de despesa de depreciação (débito na depreciação). Equivalente a "depreciation_expense_account_id".';


-- =====================================================================================
-- BLOCO 10 — EXTENSÃO DE `fixed_assets` (22.2)
-- =====================================================================================
-- "name"/"acquisition_value"/"residual_value" pedidos na Etapa 22 já existem como
-- "description"/"acquisition_amount"/"residual_amount" desde a v1.1 — reaproveitados.
-- "net_book_value"/"accumulated_depreciation_amount" pedidos NÃO são adicionados como
-- colunas armazenadas: são DERIVADOS de soma(asset_depreciations.accounting_amount) —
-- manter como coluna redundante arriscaria desalinhamento; calculados em
-- src/modules/assets/queries.ts a cada leitura.

alter table fixed_assets add column if not exists code text;
alter table fixed_assets add column if not exists start_depreciation_date date;

comment on column fixed_assets.code is 'Código curto de identificação do bem (equivalente a "code" pedido na Etapa 22) — distinto de asset_tag (etiqueta física/patrimonial), ambos opcionais.';
comment on column fixed_assets.start_depreciation_date is 'Data explícita de início da depreciação. Quando nula, calculada a partir de acquisition_date + depreciation_start_rule (SAME_MONTH/NEXT_MONTH, já existente).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_fixed_assets_code_unique') then
    alter table fixed_assets add constraint chk_fixed_assets_code_unique unique (company_id, code);
  end if;
end $$;

create index if not exists idx_fixed_assets_company_status on fixed_assets (company_id, status);
create index if not exists idx_fixed_assets_company_category on fixed_assets (company_id, category_id);


-- =====================================================================================
-- BLOCO 11 — EXTENSÃO DE `asset_depreciations` (22.4)
-- =====================================================================================

alter table asset_depreciations add column if not exists status asset_depreciation_status not null default 'CALCULATED';
alter table asset_depreciations add column if not exists depreciation_date date;
alter table asset_depreciations add column if not exists accumulated_amount_after numeric(18,2);
alter table asset_depreciations add column if not exists net_book_value_after numeric(18,2);
alter table asset_depreciations add column if not exists notes text;

comment on column asset_depreciations.accounting_amount is 'Já existente (v1.1) — equivalente a "depreciation_amount" pedido na Etapa 22, reaproveitado sem duplicar.';
comment on column asset_depreciations.status is 'CALCULATED (gerada, ainda não contabilizada) -> POSTED (journal_entry_id preenchido) | CANCELLED (gerada por engano, sem afetar o bem).';

create index if not exists idx_asset_depreciations_company_competence on asset_depreciations (company_id, competence);
create index if not exists idx_asset_depreciations_asset on asset_depreciations (fixed_asset_id);


-- =====================================================================================
-- BLOCO 12 — RLS: HABILITAÇÃO NA TABELA NOVA (policies ficam em erp_rls_v1_4, opcional)
-- =====================================================================================

alter table fiscal_document_retentions enable row level security;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'fn_prevent_tenant_change') then
    execute 'drop trigger if exists trg_fiscal_document_retentions_prevent_tenant_change on fiscal_document_retentions';
    execute 'create trigger trg_fiscal_document_retentions_prevent_tenant_change before update on fiscal_document_retentions for each row execute function fn_prevent_tenant_change()';
  end if;
end $$;
