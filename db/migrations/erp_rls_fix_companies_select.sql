-- =====================================================================================
-- ERP CONTÁBIL — OTIMIZAÇÃO E CORREÇÃO DE POLÍTICAS DE COMPANIES — v1.2
-- =====================================================================================
--
-- CONTEXTO: Correção de erro 42501 (RLS violation) no INSERT com select/returning.
-- O SELECT subsequente avaliava a policy `companies_select` que chamava a função
-- `can_read_company(id)` -> `company_workspace_id(id)`. Isso realizava uma subquery
-- recursiva `select workspace_id from companies where id = id` sobre a própria linha
-- que estava sendo inserida e ainda não commitada, falhando no isolamento.
--
-- SOLUÇÃO: Otimizar as políticas da tabela `companies` para ler a coluna `workspace_id`
-- diretamente da própria linha que está sendo avaliada, eliminando a subquery circular.
--
-- IDEMPOTENTE E SEGURO.
-- =====================================================================================

BEGIN;

-- 1. Recriar política de SELECT otimizada (lendo workspace_id direto da linha)
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies
  FOR SELECT TO authenticated
  USING (
    has_workspace_role(workspace_id, ARRAY['OWNER', 'ADMIN']::workspace_role[])
    OR is_company_member(id)
  );

-- 2. Recriar política de UPDATE otimizada (lendo workspace_id direto da linha)
DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update ON companies
  FOR UPDATE TO authenticated
  USING (
    has_workspace_role(workspace_id, ARRAY['OWNER', 'ADMIN']::workspace_role[])
    OR has_company_role(id, ARRAY['ACCOUNTANT']::company_role[])
  )
  WITH CHECK (
    has_workspace_role(workspace_id, ARRAY['OWNER', 'ADMIN']::workspace_role[])
    OR has_company_role(id, ARRAY['ACCOUNTANT']::company_role[])
  );

COMMIT;
