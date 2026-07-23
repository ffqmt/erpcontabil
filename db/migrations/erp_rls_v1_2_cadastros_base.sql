-- =====================================================================================
-- ERP CONTÁBIL — RLS — v1.2 — CADASTROS BASE COMPARTILHADOS (Etapa 15)
-- Migração incremental sobre erp_rls_v1.sql. Aplicar SOMENTE se erp_rls_v1.sql já foi
-- aplicado neste ambiente (depende das funções can_read_company/can_write_company/
-- can_admin_company e da RLS já habilitada por erp_schema_v1_2_cadastros_base.sql).
-- Opcional para o MVP em modo dev (mesma observação de db/README.md sobre erp_rls_v1.sql):
-- enquanto não aplicada, o Admin Client (service_role) continua acessando normalmente.
-- =====================================================================================


-- ---------------------------------------------------------------------------------
-- 1 — items (tenant-owned: mesmo padrão de partners/cost_centers)
-- ---------------------------------------------------------------------------------
create policy items_select on items
  for select to authenticated
  using (can_read_company(company_id));

create policy items_insert on items
  for insert to authenticated
  with check (can_write_company(company_id));

create policy items_update on items
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- DELETE bloqueado: use active=false.


-- ---------------------------------------------------------------------------------
-- 2 — fiscal_operation_natures (tenant-owned: mesmo padrão de partners/cost_centers)
-- ---------------------------------------------------------------------------------
create policy fiscal_operation_natures_select on fiscal_operation_natures
  for select to authenticated
  using (can_read_company(company_id));

create policy fiscal_operation_natures_insert on fiscal_operation_natures
  for insert to authenticated
  with check (can_write_company(company_id));

create policy fiscal_operation_natures_update on fiscal_operation_natures
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- DELETE bloqueado: use is_active=false.


-- ---------------------------------------------------------------------------------
-- 3 — states / municipalities (catálogo global de referência, sem tenant)
-- ---------------------------------------------------------------------------------
-- Leitura liberada para qualquer usuário autenticado — não há isolamento de empresa
-- para geografia. Sem policy de INSERT/UPDATE: escrita fica restrita a service_role
-- (seed/migração), nenhuma Server Action da aplicação cria estado/município.

create policy states_select on states
  for select to authenticated
  using (true);

create policy municipalities_select on municipalities
  for select to authenticated
  using (true);

comment on table states is 'RLS: apenas SELECT para authenticated (catálogo global). Escrita somente via service_role/migração.';
comment on table municipalities is 'RLS: apenas SELECT para authenticated (catálogo global). Escrita somente via service_role/migração.';
