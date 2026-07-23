-- =====================================================================================
-- ERP CONTÁBIL — SEED DE DESENVOLVIMENTO (CONTABILIDADE BÁSICA - FASE 1)
-- =====================================================================================
-- Esse script popula o banco com dados mínimos para teste das Fases 0 e 1 do ERP Contábil.
-- 
-- SEGURANÇA & SUPABASE CLOUD:
-- 1. No Supabase Cloud (produção/remoto), inserts diretos na tabela auth.users são permitidos
--    apenas com privilégios de superusuário (postgres/service_role). 
--    Se estiver rodando com um usuário sem essas permissões, desative o bloco "1. AUTH & PROFILES"
--    e associe seu DEV_PROFILE_ID e DEV_AUTH_USER_ID diretamente com um usuário criado via console do Supabase Auth.
-- 2. Este script é 100% IDEMPOTENTE: os inserts usam ON CONFLICT DO NOTHING e os lançamentos 
--    do diário são limpos e recriados a cada execução para evitar duplicidade de itens (journal_entry_lines).
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. AUTH & PROFILES
-- -------------------------------------------------------------------------------------
-- Garante usuário dummy na tabela de autenticação gerenciada pelo Supabase Auth (auth.users)
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role, email_confirmed_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'dev@contabil.model.com',
  '{"provider":"email","providers":["email"]}',
  '{}',
  'authenticated',
  'authenticated',
  now()
) ON CONFLICT (id) DO NOTHING;

-- Espelho do perfil de usuário na tabela profiles da aplicação
INSERT INTO profiles (id, auth_user_id, name, email)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'Desenvolvedor Demo',
  'dev@contabil.model.com'
) ON CONFLICT (id) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 2. WORKSPACE (Escritório de Contabilidade)
-- -------------------------------------------------------------------------------------
INSERT INTO workspaces (id, name, cnpj, plan, status)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  'Escritório Demo',
  '98765432000198',
  'enterprise',
  'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- Vincula o perfil ao workspace como OWNER
INSERT INTO workspace_users (id, workspace_id, profile_id, role)
VALUES (
  gen_random_uuid(),
  '88888888-8888-8888-8888-888888888888',
  '11111111-1111-1111-1111-111111111111',
  'OWNER'
) ON CONFLICT (workspace_id, profile_id) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 3. COMPANY (Empresa / Cliente do Escritório)
-- -------------------------------------------------------------------------------------
INSERT INTO companies (id, workspace_id, legal_name, trade_name, cnpj, tax_regime, company_profile, active)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '88888888-8888-8888-8888-888888888888',
  'Transportadora Modelo Ltda',
  'Transportadora Modelo',
  '12345678000195',
  'LUCRO_REAL',
  'TRANSPORTATION',
  true
) ON CONFLICT (id) DO NOTHING;

-- Vincula o perfil à empresa como ACCOUNTANT (Contador operacional)
INSERT INTO company_users (id, company_id, profile_id, role)
VALUES (
  gen_random_uuid(),
  '99999999-9999-9999-9999-999999999999',
  '11111111-1111-1111-1111-111111111111',
  'ACCOUNTANT'
) ON CONFLICT (company_id, profile_id) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 4. ESTABLISHMENT (Estabelecimento Matriz)
-- -------------------------------------------------------------------------------------
INSERT INTO establishments (id, workspace_id, company_id, type, cnpj, city, state, active)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  'HEADQUARTERS',
  '12345678000195',
  'São Paulo',
  'SP',
  true
) ON CONFLICT (id) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 5. COST CENTERS (Centros de Custo)
-- -------------------------------------------------------------------------------------
INSERT INTO cost_centers (id, workspace_id, company_id, code, name, active)
VALUES 
  ('10000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'OPERACIONAL', 'Centro Operacional de Frota', true),
  ('20000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'ADMINISTRATIVO', 'Administração Geral', true)
ON CONFLICT (company_id, code) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 6. ACCOUNTING PERIODS (Competências)
-- -------------------------------------------------------------------------------------
-- Período de Dezembro/2024 (Abertura contábil)
INSERT INTO accounting_periods (id, workspace_id, company_id, competence, start_date, end_date, status)
VALUES (
  'd0000024-0000-0000-0000-000000000000',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2024-12-01',
  '2024-12-01',
  '2024-12-31',
  'OPEN'
) ON CONFLICT (company_id, competence) DO NOTHING;

-- Período de Janeiro/2025 (Janeiro operacional)
INSERT INTO accounting_periods (id, workspace_id, company_id, competence, start_date, end_date, status)
VALUES (
  'd0000025-0000-0000-0000-000000000001',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2025-01-01',
  '2025-01-01',
  '2025-01-31',
  'OPEN'
) ON CONFLICT (company_id, competence) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 7. CHART OF ACCOUNTS (Plano de Contas)
-- -------------------------------------------------------------------------------------

-- CONTAS SINTÉTICAS (Não aceitam lançamentos directos, accepts_entries = false)
-- ATIVO (Nível 1)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1', 'ATIVO', 'ASSET', 'DEBIT', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- ATIVO CIRCULANTE (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000011', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1', 'ATIVO CIRCULANTE', 'ASSET', 'DEBIT', 'a0000000-0000-0000-0000-000000000001', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- CAIXA E EQUIVALENTES DE CAIXA (Nível 3)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000111', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.1', 'CAIXA E EQUIVALENTES DE CAIXA', 'ASSET', 'DEBIT', 'a0000000-0000-0000-0000-000000000011', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- CLIENTES (Nível 3)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000112', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.2', 'CLIENTES', 'ASSET', 'DEBIT', 'a0000000-0000-0000-0000-000000000011', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- ATIVO NÃO CIRCULANTE (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000012', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2', 'ATIVO NÃO CIRCULANTE', 'ASSET', 'DEBIT', 'a0000000-0000-0000-0000-000000000001', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- IMOBILIZADO (Nível 3)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000121', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1', 'IMOBILIZADO', 'ASSET', 'DEBIT', 'a0000000-0000-0000-0000-000000000012', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- PASSIVO (Nível 1)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2', 'PASSIVO', 'LIABILITY', 'CREDIT', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- PASSIVO CIRCULANTE (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000022', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1', 'PASSIVO CIRCULANTE', 'LIABILITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000002', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- FORNECEDORES (Nível 3)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000221', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.1', 'FORNECEDORES', 'LIABILITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000022', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- OBRIGAÇÕES TRIBUTÁRIAS (Nível 3)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000222', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2', 'OBRIGAÇÕES TRIBUTÁRIAS A RECOLHER', 'LIABILITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000022', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- PATRIMÔNIO LÍQUIDO (Nível 1)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '3', 'PATRIMÔNIO LÍQUIDO', 'EQUITY', 'CREDIT', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- CAPITAL SOCIAL (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000033', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '3.1', 'CAPITAL SOCIAL', 'EQUITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000003', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- LUCROS OU PREJUÍZOS ACUMULADOS (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000034', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '3.2', 'RESERVAS E RESULTADOS ACUMULADOS', 'EQUITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000003', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- RECEITAS (Nível 1)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4', 'RECEITAS', 'REVENUE', 'CREDIT', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- RECEITA DE PRESTAÇÃO DE SERVIÇOS (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000044', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.1', 'RECEITA OPERACIONAL DE SERVIÇOS', 'REVENUE', 'CREDIT', 'a0000000-0000-0000-0000-000000000004', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- DEDUÇÕES (Nível 1)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000005', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '5', 'DEDUÇÕES DE RECEITAS', 'REVENUE_DEDUCTION', 'DEBIT', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- TRIBUTOS S/ FATURAMENTO (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000055', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '5.1', 'TRIBUTOS INCIDENTES SOBRE FATURAMENTO', 'REVENUE_DEDUCTION', 'DEBIT', 'a0000000-0000-0000-0000-000000000005', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- CUSTOS (Nível 1)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000006', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6', 'CUSTOS', 'COST', 'DEBIT', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- CUSTO DE PRESTAÇÃO DE SERVIÇOS (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000066', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1', 'CUSTOS OPERACIONAIS DE TRANSPORTE', 'COST', 'DEBIT', 'a0000000-0000-0000-0000-000000000006', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- DESPESAS (Nível 1)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000007', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7', 'DESPESAS', 'EXPENSE', 'DEBIT', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- DESPESAS ADMINISTRATIVAS (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000077', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1', 'DESPESAS ADMINISTRATIVAS', 'EXPENSE', 'DEBIT', 'a0000000-0000-0000-0000-000000000007', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- DESPESAS E RECEITAS FINANCEIRAS (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000078', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.2', 'RESULTADO FINANCEIRO', 'EXPENSE', 'DEBIT', 'a0000000-0000-0000-0000-000000000007', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- TRIBUTOS S/ LUCRO (Nível 1)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000008', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '8', 'PROVISÃO PARA TRIBUTOS SOBRE O LUCRO', 'EXPENSE', 'DEBIT', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;

-- PROVISÃO IRPJ / CSLL (Nível 2)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('a0000000-0000-0000-0000-000000000088', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '8.1', 'IRPJ E CSLL CORRENTES', 'EXPENSE', 'DEBIT', 'a0000000-0000-0000-0000-000000000008', true, false, true) ON CONFLICT (company_id, code) DO NOTHING;


-- CONTAS ANALÍTICAS (Aceitam lançamentos directos, accepts_entries = true, is_synthetic = false)
-- 1.1.1.01 - Caixa Geral
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000101', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.1.01', 'Caixa Geral', 'ASSET', 'DEBIT', 'a0000000-0000-0000-0000-000000000111', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 1.1.1.02 - Banco Conta Movimento (Sicredi)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000102', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.1.02', 'Banco Conta Movimento (Sicredi)', 'ASSET', 'DEBIT', 'a0000000-0000-0000-0000-000000000111', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 1.1.2.01 - Clientes Nacionais
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000112', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.2.01', 'Clientes Nacionais', 'ASSET', 'DEBIT', 'a0000000-0000-0000-0000-000000000112', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 1.2.1.01 - Veículos de Frota (Imobilizado)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000121', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.01', 'Veículos de Frota (Caminhões)', 'ASSET', 'DEBIT', 'a0000000-0000-0000-0000-000000000121', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 1.2.1.02 - Depreciação Acumulada - Veículos (Redutora do Ativo, Natureza Credora)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000122', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.02', 'Depreciação Acumulada - Veículos', 'ASSET', 'CREDIT', 'a0000000-0000-0000-0000-000000000121', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 2.1.1.01 - Fornecedores Nacionais
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000201', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.1.01', 'Fornecedores Nacionais', 'LIABILITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000221', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 2.1.2.01 - PIS a Recolher
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000211', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.01', 'PIS a Recolher', 'LIABILITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000222', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 2.1.2.02 - COFINS a Recolher
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000212', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.02', 'COFINS a Recolher', 'LIABILITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000222', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 2.1.2.03 - IRPJ a Recolher
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000213', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.03', 'IRPJ a Recolher', 'LIABILITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000222', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 2.1.2.04 - CSLL a Recolher
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000214', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.04', 'CSLL a Recolher', 'LIABILITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000222', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 3.1.1 - Capital Social Integralizado
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000311', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '3.1.1', 'Capital Social Integralizado', 'EQUITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000033', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 3.2.1 - Lucros ou Prejuízos Acumulados
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000321', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '3.2.1', 'Lucros ou Prejuízos Acumulados', 'EQUITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000034', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 4.1.1 - Receita de Fretes (Serviços de Transporte)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000411', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.1.1', 'Receita de Fretes (Serviço de Transporte)', 'REVENUE', 'CREDIT', 'a0000000-0000-0000-0000-000000000044', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 5.1.1 - PIS sobre Receitas de Transporte
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000511', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '5.1.1', 'PIS sobre Receitas', 'REVENUE_DEDUCTION', 'DEBIT', 'a0000000-0000-0000-0000-000000000055', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 5.1.2 - COFINS sobre Receitas de Transporte
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000512', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '5.1.2', 'COFINS sobre Receitas', 'REVENUE_DEDUCTION', 'DEBIT', 'a0000000-0000-0000-0000-000000000055', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 5.1.3 - ICMS sobre Serviços de Transporte
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000513', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '5.1.3', 'ICMS sobre Serviços de Transporte', 'REVENUE_DEDUCTION', 'DEBIT', 'a0000000-0000-0000-0000-000000000055', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 6.1.1 - Combustível (Óleo Diesel)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000611', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.1', 'Combustível (Óleo Diesel)', 'COST', 'DEBIT', 'a0000000-0000-0000-0000-000000000066', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 6.1.2 - Pedágio
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000612', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.2', 'Pedágios das Rotas', 'COST', 'DEBIT', 'a0000000-0000-0000-0000-000000000066', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 6.1.3 - Manutenção de Caminhões (Oficina)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000613', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.3', 'Manutenção de Caminhões', 'COST', 'DEBIT', 'a0000000-0000-0000-0000-000000000066', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 7.1.1 - Aluguel Administrativo
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000711', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.1', 'Aluguel do Escritório', 'EXPENSE', 'DEBIT', 'a0000000-0000-0000-0000-000000000077', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 7.1.2 - Energia, Internet e Telefone
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000712', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.2', 'Energia, Internet e Telefone', 'EXPENSE', 'DEBIT', 'a0000000-0000-0000-0000-000000000077', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 7.1.3 - Honorários e Serviços Contábeis
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000713', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.3', 'Honorários Contábeis', 'EXPENSE', 'DEBIT', 'a0000000-0000-0000-0000-000000000077', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 7.2.1 - Despesas Tarifárias Bancárias
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000721', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.2.1', 'Despesas Tarifárias Bancárias', 'EXPENSE', 'DEBIT', 'a0000000-0000-0000-0000-000000000078', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 7.2.2 - Receitas Financeiras (Rendimentos)
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000722', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.2.2', 'Receitas Financeiras (Rendimentos)', 'EXPENSE', 'CREDIT', 'a0000000-0000-0000-0000-000000000078', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 8.1.1 - IRPJ Corrente
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000811', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '8.1.1', 'IRPJ Corrente', 'EXPENSE', 'DEBIT', 'a0000000-0000-0000-0000-000000000088', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;

-- 8.1.2 - CSLL Corrente
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('c0000000-0000-0000-0000-000000000812', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '8.1.2', 'CSLL Corrente', 'EXPENSE', 'DEBIT', 'a0000000-0000-0000-0000-000000000088', false, true, true) ON CONFLICT (company_id, code) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 8. PARTNERS (Parceiros Comerciais)
-- -------------------------------------------------------------------------------------
INSERT INTO partners (id, workspace_id, company_id, name, document, partner_type, active)
VALUES 
  ('p0000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'Cliente Demo Ltda', '11111111000111', 'CUSTOMER', true),
  ('p0000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'Fornecedor Demo Ltda', '22222222000122', 'SUPPLIER', true)
ON CONFLICT (id) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 9. IDEMPOTÊNCIA: LIMPEZA DOS LANÇAMENTOS E ITENS DO SEED ANTERIOR
-- -------------------------------------------------------------------------------------
DELETE FROM journal_entries WHERE id IN (
  'e0000000-0000-0000-0000-000000000000',
  'e0000000-0000-0000-0000-00000000000a',
  'e0000000-0000-0000-0000-00000000000b',
  'e0000000-0000-0000-0000-00000000000c',
  'e0000000-0000-0000-0000-00000000000d',
  'e0000000-0000-0000-0000-00000000000e',
  'e0000000-0000-0000-0000-00000000000f',
  'e0000000-0000-0000-0000-000000000010'
);


-- -------------------------------------------------------------------------------------
-- 10. JOURNAL ENTRIES & LINES (Lançamentos Contábeis)
-- -------------------------------------------------------------------------------------
-- NOTA: Inserimos primeiro os cabeçalhos como 'DRAFT', depois inserimos as linhas e finalmente
-- fazemos o UPDATE para 'POSTED' a fim de acionar a validação do balanço de forma síncrona.

-- Lançamento 1: Abertura Contábil (2024-12-31)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, document, origin, status)
VALUES (
  'e0000000-0000-0000-0000-000000000000',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2024-12-31',
  '2024-12-01', -- Competência de Dezembro/2024
  'Lançamento de Abertura Contábil - Saldos Iniciais',
  'ATA ABERTURA 2024',
  'OPENING',
  'DRAFT'
);

-- Linhas do Lançamento de Abertura
-- Débitos:
INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000102', 'DEBIT', 100000.00, 'Saldo Banco Sicredi');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000112', 'DEBIT', 20000.00, 'Clientes Nacionais a receber');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000121', 'DEBIT', 300000.00, 'Frota de caminhões');

-- Créditos:
INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000201', 'CREDIT', 50000.00, 'Fornecedores Nacionais a pagar');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000311', 'CREDIT', 370000.00, 'Capital Social Integralizado');

-- Ativa o Lançamento para POSTED (isso vai acionar os triggers de balanço e numerar o lançamento)
UPDATE journal_entries SET status = 'POSTED' WHERE id = 'e0000000-0000-0000-0000-000000000000';


-- Lançamento A: Receita de frete a prazo (2025-01-05)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, document, partner_id, origin, status)
VALUES (
  'e0000000-0000-0000-0000-00000000000a',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2025-01-05',
  '2025-01-01',
  'Faturamento de Fretes do período - Cliente Demo',
  'NF 10020',
  'p0000000-0000-0000-0000-000000000001',
  'MANUAL',
  'DRAFT'
);

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000112', 'DEBIT', 30000.00, 'Clientes Nacionais - direitos');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000411', 'CREDIT', 30000.00, 'Faturamento de Frete Operacional');

UPDATE journal_entries SET status = 'POSTED' WHERE id = 'e0000000-0000-0000-0000-00000000000a';


-- Lançamento B: Recebimento de cliente (2025-01-10)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, document, partner_id, origin, status)
VALUES (
  'e0000000-0000-0000-0000-00000000000b',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2025-01-10',
  '2025-01-01',
  'Recebimento parcial duplicata Cliente Demo',
  'REC 44921',
  'p0000000-0000-0000-0000-000000000001',
  'MANUAL',
  'DRAFT'
);

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-000000000102', 'DEBIT', 20000.00, 'Entrada em conta movimento');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-000000000112', 'CREDIT', 20000.00, 'Baixa conta clientes');

UPDATE journal_entries SET status = 'POSTED' WHERE id = 'e0000000-0000-0000-0000-00000000000b';


-- Lançamento C: Compra de combustível a prazo (2025-01-12)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, document, partner_id, origin, status)
VALUES (
  'e0000000-0000-0000-0000-00000000000c',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2025-01-12',
  '2025-01-01',
  'Compra de óleo diesel frota - Fornecedor Demo',
  'NF 88390',
  'p0000000-0000-0000-0000-000000000002',
  'MANUAL',
  'DRAFT'
);

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo, cost_center_id)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000611', 'DEBIT', 8000.00, 'Combustível de Frota', '10000000-0000-0000-0000-000000000001');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000201', 'CREDIT', 8000.00, 'Fornecedores Nacionais');

UPDATE journal_entries SET status = 'POSTED' WHERE id = 'e0000000-0000-0000-0000-00000000000c';


-- Lançamento D: Pagamento fornecedor (2025-01-18)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, document, partner_id, origin, status)
VALUES (
  'e0000000-0000-0000-0000-00000000000d',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2025-01-18',
  '2025-01-01',
  'Pagamento duplicata Fornecedor Demo',
  'TEF 901',
  'p0000000-0000-0000-0000-000000000002',
  'MANUAL',
  'DRAFT'
);

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000d', 'c0000000-0000-0000-0000-000000000201', 'DEBIT', 10000.00, 'Débito em Fornecedores');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000d', 'c0000000-0000-0000-0000-000000000102', 'CREDIT', 10000.00, 'Saída Sicredi');

UPDATE journal_entries SET status = 'POSTED' WHERE id = 'e0000000-0000-0000-0000-00000000000d';


-- Lançamento E: Despesa administrativa paga (2025-01-20)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, document, origin, status)
VALUES (
  'e0000000-0000-0000-0000-00000000000e',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2025-01-20',
  '2025-01-01',
  'Pagamento Aluguel Escritório Adm',
  'PIX ADM 400',
  'MANUAL',
  'DRAFT'
);

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo, cost_center_id)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000e', 'c0000000-0000-0000-0000-000000000711', 'DEBIT', 3000.00, 'Aluguel do mês', '20000000-0000-0000-0000-000000000002');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000e', 'c0000000-0000-0000-0000-000000000102', 'CREDIT', 3000.00, 'Saída conta Sicredi');

UPDATE journal_entries SET status = 'POSTED' WHERE id = 'e0000000-0000-0000-0000-00000000000e';


-- Lançamento F: Despesa bancária (2025-01-22)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, document, origin, status)
VALUES (
  'e0000000-0000-0000-0000-00000000000f',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2025-01-22',
  '2025-01-01',
  'Tarifa de Manutenção de Conta Sicredi',
  'EXTRATO JAN 25',
  'MANUAL',
  'DRAFT'
);

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo, cost_center_id)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000f', 'c0000000-0000-0000-0000-000000000721', 'DEBIT', 150.00, 'Tarifas Sicredi', '20000000-0000-0000-0000-000000000002');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-00000000000f', 'c0000000-0000-0000-0000-000000000102', 'CREDIT', 150.00, 'Tarifa Sicredi');

UPDATE journal_entries SET status = 'POSTED' WHERE id = 'e0000000-0000-0000-0000-00000000000f';


-- Lançamento G: Tributos sobre receita (2025-01-31)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, document, origin, status)
VALUES (
  'e0000000-0000-0000-0000-000000000010',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2025-01-31',
  '2025-01-01',
  'Provisão de PIS e COFINS s/ Fretes Faturados no mês',
  'APUR PIS/COFINS',
  'MANUAL',
  'DRAFT'
);

-- Débitos:
INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo, cost_center_id)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000511', 'DEBIT', 195.00, 'PIS sobre Frete', '10000000-0000-0000-0000-000000000001');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo, cost_center_id)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000512', 'DEBIT', 900.00, 'COFINS sobre Frete', '10000000-0000-0000-0000-000000000001');

-- Créditos:
INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000211', 'CREDIT', 195.00, 'Provisão PIS');

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000212', 'CREDIT', 900.00, 'Provisão COFINS');

UPDATE journal_entries SET status = 'POSTED' WHERE id = 'e0000000-0000-0000-0000-000000000010';

COMMIT;
