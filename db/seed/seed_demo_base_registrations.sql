-- =====================================================================================
-- ERP CONTÁBIL — SEED DE DESENVOLVIMENTO — CADASTROS BASE (Etapa 15)
-- =====================================================================================
-- Complementa seed_demo_accounting.sql com dados de Parceiros (papéis novos), Produtos/
-- Serviços, Naturezas Fiscais, Conta Bancária cadastral e Municípios/UF de referência.
-- Requer que erp_schema_v1_2_cadastros_base.sql já tenha sido aplicado e que
-- seed_demo_accounting.sql já tenha rodado antes (usa o workspace/company/chart_accounts
-- do seed contábil). 100% IDEMPOTENTE via ON CONFLICT DO NOTHING / UPDATE determinístico.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. ESTADOS & MUNICÍPIOS (catálogo global de referência — sem workspace/company)
-- -------------------------------------------------------------------------------------
INSERT INTO states (id, uf, name, ibge_code) VALUES
  ('50000000-0000-0000-0000-000000000001', 'SP', 'São Paulo', '35'),
  ('50000000-0000-0000-0000-000000000002', 'RJ', 'Rio de Janeiro', '33'),
  ('50000000-0000-0000-0000-000000000003', 'MG', 'Minas Gerais', '31'),
  ('50000000-0000-0000-0000-000000000004', 'PR', 'Paraná', '41'),
  ('50000000-0000-0000-0000-000000000005', 'RS', 'Rio Grande do Sul', '43'),
  ('50000000-0000-0000-0000-000000000006', 'DF', 'Distrito Federal', '53'),
  ('50000000-0000-0000-0000-000000000007', 'BA', 'Bahia', '29'),
  ('50000000-0000-0000-0000-000000000008', 'PE', 'Pernambuco', '26'),
  ('50000000-0000-0000-0000-000000000009', 'CE', 'Ceará', '23'),
  ('50000000-0000-0000-0000-00000000000a', 'GO', 'Goiás', '52')
ON CONFLICT (uf) DO NOTHING;

INSERT INTO municipalities (id, state_id, uf, name, ibge_code) VALUES
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'SP', 'São Paulo', '3550308'),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'RJ', 'Rio de Janeiro', '3304557'),
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 'MG', 'Belo Horizonte', '3106200'),
  ('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000004', 'PR', 'Curitiba', '4106902'),
  ('60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000005', 'RS', 'Porto Alegre', '4314902'),
  ('60000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000006', 'DF', 'Brasília', '5300108'),
  ('60000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000007', 'BA', 'Salvador', '2927408'),
  ('60000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000008', 'PE', 'Recife', '2611606'),
  ('60000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000009', 'CE', 'Fortaleza', '2304400'),
  ('60000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-00000000000a', 'GO', 'Goiânia', '5208707')
ON CONFLICT (uf, name) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 2. PARCEIROS: atualiza papéis dos 2 parceiros já existentes no seed contábil
-- -------------------------------------------------------------------------------------
UPDATE partners SET
  legal_name = 'Cliente Demo Ltda',
  trade_name = 'Cliente Demo',
  document_type = 'CNPJ',
  email = 'contato@clientedemo.com.br',
  phone = '(11) 4002-8922',
  city = 'São Paulo',
  state = 'SP',
  is_customer = true
WHERE id = 'p0000000-0000-0000-0000-000000000001';

UPDATE partners SET
  legal_name = 'Fornecedor Demo Ltda',
  trade_name = 'Fornecedor Demo',
  document_type = 'CNPJ',
  email = 'contato@fornecedordemo.com.br',
  phone = '(11) 4002-8933',
  city = 'São Paulo',
  state = 'SP',
  is_supplier = true
WHERE id = 'p0000000-0000-0000-0000-000000000002';

-- Novos parceiros: transportadora (pessoa jurídica) e pessoa física simples
INSERT INTO partners (
  id, workspace_id, company_id, name, legal_name, trade_name, document, document_type,
  partner_type, email, phone, city, state, is_carrier, active
) VALUES (
  'p0000000-0000-0000-0000-000000000003',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  'Transportadora Demo Ltda',
  'Transportadora Demo Ltda',
  'Transportadora Demo',
  '33333333000144',
  'CNPJ',
  'OTHER',
  'contato@transportadorademo.com.br',
  '(11) 4002-8944',
  'Curitiba',
  'PR',
  true,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO partners (
  id, workspace_id, company_id, name, document, document_type,
  partner_type, email, phone, city, state, is_employee, active
) VALUES (
  'p0000000-0000-0000-0000-000000000004',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  'João da Silva',
  '11122233396',
  'CPF',
  'EMPLOYEE',
  'joao.silva@exemplo.com.br',
  '(11) 98888-7777',
  'São Paulo',
  'SP',
  true,
  true
) ON CONFLICT (id) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 3. PRODUTOS/SERVIÇOS
-- -------------------------------------------------------------------------------------
INSERT INTO items (id, workspace_id, company_id, code, name, description, item_type, unit, service_code, active) VALUES
  (
    '70000000-0000-0000-0000-000000000001',
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999',
    'SERV-FRETE',
    'Serviço de Frete',
    'Transporte rodoviário de cargas entre municípios.',
    'SERVICE',
    'UN',
    '16.01',
    true
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999',
    'SERV-CONSULT',
    'Serviço de Consultoria',
    'Consultoria administrativa e operacional avulsa.',
    'SERVICE',
    'H',
    '17.01',
    true
  ),
  (
    '70000000-0000-0000-0000-000000000003',
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999',
    'PROD-EX01',
    'Produto Exemplo',
    'Item de exemplo para testes de cadastro de produto.',
    'PRODUCT',
    'UN',
    NULL,
    true
  )
ON CONFLICT (company_id, code) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 4. NATUREZAS FISCAIS BÁSICAS
-- -------------------------------------------------------------------------------------
INSERT INTO fiscal_operation_natures (id, workspace_id, company_id, code, name, direction, description, is_active) VALUES
  (
    '80000000-0000-0000-0000-000000000001',
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999',
    'COMPRA-USO-CONSUMO',
    'Compra para uso/consumo',
    'INBOUND',
    'Entrada de mercadoria ou serviço destinado ao uso/consumo próprio da empresa, sem revenda.',
    true
  ),
  (
    '80000000-0000-0000-0000-000000000002',
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999',
    'VENDA-MERCADORIA',
    'Venda de mercadoria',
    'OUTBOUND',
    'Saída de mercadoria em operação de venda.',
    true
  ),
  (
    '80000000-0000-0000-0000-000000000003',
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999',
    'PREST-SERVICO',
    'Prestação de serviço',
    'OUTBOUND',
    'Saída referente à prestação de serviço para terceiros.',
    true
  ),
  (
    '80000000-0000-0000-0000-000000000004',
    '88888888-8888-8888-8888-888888888888',
    '99999999-9999-9999-9999-999999999999',
    'SERVICO-TOMADO',
    'Serviço tomado',
    'INBOUND',
    'Entrada referente à contratação de serviço de terceiros.',
    true
  )
ON CONFLICT (company_id, code) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 5. CONTA BANCÁRIA (vinculada à conta do plano de contas já existente do seed contábil)
-- -------------------------------------------------------------------------------------
INSERT INTO bank_accounts (
  id, workspace_id, company_id, chart_account_id, bank_name, bank_code, agency,
  account_number, account_digit, account_type, holder_name, holder_document,
  opening_balance, active
) VALUES (
  '90000000-0000-0000-0000-000000000001',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  'c0000000-0000-0000-0000-000000000102', -- Banco Conta Movimento (Sicredi), já seedado
  'Sicredi',
  '748',
  '0101',
  '12345',
  '6',
  'CHECKING',
  'Transportadora Modelo Ltda',
  '12345678000195',
  100000.00,
  true
) ON CONFLICT (id) DO NOTHING;

COMMIT;
