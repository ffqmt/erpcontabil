-- =====================================================================================
-- ERP CONTABIL — v2.1 — REPARO DE DRIFT: fixed_assets.fiscal_document_item_id
-- =====================================================================================
-- Contexto: alguns ambientes chegaram nas etapas 34A/34B sem aplicar a migration v1.9
-- (Etapa 33A). O codigo atual usa fixed_assets.fiscal_document_item_id para vincular um
-- bem ao item fiscal que o originou; sem a coluna, o PostgREST retorna:
-- "column fixed_assets.fiscal_document_item_id does not exist".
--
-- Esta migration e intencionalmente idempotente e repete o bloco estrutural da v1.9 para
-- reparar bancos ja parcialmente migrados.
-- =====================================================================================

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'fiscal_item_type'
      and e.enumlabel = 'ASSET'
  ) then
    alter type fiscal_item_type add value 'ASSET';
  end if;
end $$;

alter table fixed_assets
  add column if not exists fiscal_document_item_id uuid references fiscal_document_items(id) on delete set null;

comment on column fixed_assets.fiscal_document_item_id is
  'Item especifico do documento fiscal que originou este bem (Etapa 33A/v2.1 drift fix). Um item so pode gerar 1 bem.';

create unique index if not exists uq_fixed_assets_fiscal_document_item
  on fixed_assets (fiscal_document_item_id)
  where fiscal_document_item_id is not null;
