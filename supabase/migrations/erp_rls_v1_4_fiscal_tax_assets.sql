-- =====================================================================================
-- ERP CONTÁBIL — RLS — v1.4 — FISCAL/TRIBUTÁRIO, APURAÇÕES, OBRIGAÇÕES E PATRIMÔNIO
-- Etapas 19–22. Migração incremental sobre erp_rls_v1.sql. Aplicar SOMENTE se
-- erp_rls_v1.sql já foi aplicado neste ambiente (depende de can_read_company/
-- can_write_company/can_admin_company). Opcional para o MVP em modo dev, mesma observação
-- de erp_rls_v1.sql/erp_rls_v1_2/erp_rls_v1_3 — enquanto não aplicada, o Admin Client
-- (service_role) continua acessando normalmente.
-- =====================================================================================
--
-- Por que só 1 tabela ganha policy nova: `fiscal_documents`, `fiscal_document_items`,
-- `tax_assessments`, `tax_assessment_lines`, `obligations`, `asset_categories`,
-- `fixed_assets`, `asset_events`, `asset_depreciations` já têm policies completas escritas
-- em erp_rls_v1.sql desde a v1.1 (SELECT via can_read_company, INSERT/UPDATE via
-- can_write_company, DELETE bloqueado ou restrito a status DRAFT). RLS do Postgres se
-- aplica à LINHA inteira, não por coluna — as colunas novas adicionadas em
-- erp_schema_v1_4_fiscal_tax_assets.sql (Blocos 3-11) já ficam automaticamente cobertas
-- pelas policies existentes, e a migração de enum (Bloco 2) não muda nenhuma policy (RLS
-- não referencia o TIPO da coluna, só seu valor via comparação). A única tabela
-- genuinamente NOVA desta etapa é `fiscal_document_retentions` — só ela precisa de
-- policies novas.
-- =====================================================================================

-- ---------------------------------------------------------------------------------
-- fiscal_document_retentions (tenant-owned: mesmo padrão de fiscal_document_items)
-- ---------------------------------------------------------------------------------
create policy fiscal_document_retentions_select on fiscal_document_retentions
  for select to authenticated
  using (can_read_company(company_id));

create policy fiscal_document_retentions_insert on fiscal_document_retentions
  for insert to authenticated
  with check (
    can_write_company(company_id)
    and exists (
      select 1 from fiscal_documents fd
      where fd.id = fiscal_document_retentions.fiscal_document_id
        and fd.status in ('DRAFT', 'IMPORTED', 'VALIDATED')
    )
  );

create policy fiscal_document_retentions_update on fiscal_document_retentions
  for update to authenticated
  using (
    can_write_company(company_id)
    and exists (
      select 1 from fiscal_documents fd
      where fd.id = fiscal_document_retentions.fiscal_document_id
        and fd.status in ('DRAFT', 'IMPORTED', 'VALIDATED')
    )
  )
  with check (can_write_company(company_id));

create policy fiscal_document_retentions_delete on fiscal_document_retentions
  for delete to authenticated
  using (
    can_write_company(company_id)
    and exists (
      select 1 from fiscal_documents fd
      where fd.id = fiscal_document_retentions.fiscal_document_id
        and fd.status in ('DRAFT', 'IMPORTED', 'VALIDATED')
    )
  );

comment on table fiscal_document_retentions is 'RLS: leitura por can_read_company; INSERT/UPDATE/DELETE exigem can_write_company E que o documento fiscal pai ainda esteja DRAFT/IMPORTED/VALIDATED (não BOOKED/CANCELLED) — mesmo padrão de journal_entry_lines em relação a journal_entries.';
