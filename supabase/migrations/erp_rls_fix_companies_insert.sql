-- =====================================================================================
-- ERP CONTÁBIL — CORREÇÃO RLS/GRANT DA TABELA COMPANIES — v1.1
-- =====================================================================================
--
-- CONTEXTO: Correção de erro 42501 (RLS violation) ao tentar criar novas empresas.
-- A RLS aplicada de fato no banco remoto diferia do arquivo-fonte erp_rls_v1.sql.
-- Este script restabelece de forma segura, explícita e idempotente as políticas de
-- RLS da tabela `companies` e assegura os grants mínimos de escrita e leitura
-- necessários para o papel `authenticated` do Supabase.
--
-- SEGURANÇA:
--   - Não-destrutivo: apenas recria políticas de RLS e define grants de acesso.
--   - Idempotente: pode ser executado repetidamente sem impacto nos dados.
-- =====================================================================================

BEGIN;

-- 1. Assegurar habilitação da RLS na tabela
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 2. Recriar políticas de Row Level Security para companies
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies
  FOR SELECT TO authenticated
  USING (can_read_company(id));

DROP POLICY IF EXISTS companies_insert ON companies;
CREATE POLICY companies_insert ON companies
  FOR INSERT TO authenticated
  WITH CHECK (can_admin_workspace(workspace_id));

DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update ON companies
  FOR UPDATE TO authenticated
  USING (can_admin_workspace(workspace_id) or has_company_role(id, array['ACCOUNTANT']::company_role[]))
  WITH CHECK (can_admin_workspace(workspace_id) or has_company_role(id, array['ACCOUNTANT']::company_role[]));

-- 3. Assegurar privilégios mínimos (grants) para a role authenticated do Supabase
GRANT USAGE ON SCHEMA public TO authenticated;

-- Tabela principal
GRANT SELECT, INSERT, UPDATE ON companies TO authenticated;

-- Tabelas de suporte/vínculo necessárias para a validação das funções RLS
GRANT SELECT ON workspace_users TO authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON company_users TO authenticated;

COMMIT;
