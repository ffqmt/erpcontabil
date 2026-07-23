-- =====================================================================================
-- ERP CONTÁBIL — v1.9 — ETAPA 33A — ATIVO IMOBILIZADO VIA XML/DOCUMENTO FISCAL
-- =====================================================================================
-- Migração aditiva e idempotente.
--
-- BLOCO 1 — adiciona 'ASSET' ao enum fiscal_item_type (permite classificar um item de
--   documento fiscal como ativo imobilizado, em vez de produto/serviço/frete/outro).
-- BLOCO 2 — fixed_assets.fiscal_document_item_id: vínculo com o item específico que
--   originou o bem (fiscal_documents_id já existia desde a v1.4) + índice único parcial
--   para nunca permitir criar dois bens a partir do mesmo item.
-- =====================================================================================

-- ---------------------------------------------------------------------------------
-- BLOCO 1 — fiscal_item_type: adiciona ASSET
-- ---------------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'fiscal_item_type' and e.enumlabel = 'ASSET'
  ) then
    alter type fiscal_item_type add value 'ASSET';
  end if;
end $$;

-- ---------------------------------------------------------------------------------
-- BLOCO 2 — fixed_assets.fiscal_document_item_id
-- ---------------------------------------------------------------------------------
alter table fixed_assets add column if not exists fiscal_document_item_id uuid references fiscal_document_items(id) on delete set null;

comment on column fixed_assets.fiscal_document_item_id is 'Item específico do documento fiscal que originou este bem (Etapa 33A) — distinto de fiscal_document_id (o documento inteiro), que já existia. Um item só pode gerar 1 bem (índice único parcial abaixo).';

create unique index if not exists uq_fixed_assets_fiscal_document_item
  on fixed_assets (fiscal_document_item_id)
  where fiscal_document_item_id is not null;
