BEGIN;

-- ===================================================================
-- PARTE 1 — Renomeações cosméticas (contas já existentes, mesmo id).
-- Só o nome muda; código, tipo, natureza e hierarquia continuam os mesmos.
-- ===================================================================
UPDATE chart_accounts SET name = 'Bancos Conta Movimento' WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.1.02';  -- era: Banco Conta Movimento (Itau)
UPDATE chart_accounts SET name = '(-) Depreciação Acumulada de Veículos' WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1.02';  -- era: Depreciação Acumulada - Veículos

-- ===================================================================
-- PARTE 2 — Contas novas (códigos livres, sem conflito com nada existente).
-- ===================================================================
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.1.04', 'Aplicações Financeiras de Liquidez Imediata', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.2.03', '(-) Provisão para Créditos de Liquidação Duvidosa', 'ASSET', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.4', 'OUTROS CRÉDITOS', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.4.01', 'Adiantamentos a Fornecedores', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.4.02', 'Adiantamentos a Empregados/Motoristas (Viagem)', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.4.03', 'ICMS a Recuperar', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.4.04', 'PIS a Recuperar', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.4.05', 'COFINS a Recuperar', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.4.06', 'IRRF a Recuperar', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.4.07', 'CSRF a Recuperar (CSLL/PIS/COFINS Retidos na Fonte)', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.5', 'ESTOQUES', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.5.01', 'Estoque de Pneus', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.5'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.5.02', 'Estoque de Peças e Acessórios', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.5'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.5.03', 'Estoque de Lubrificantes e Fluidos', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.5'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.5.04', 'Estoque de Combustíveis', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.5'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.6', 'DESPESAS ANTECIPADAS', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.1.6.01', 'Prêmios de Seguros a Apropriar', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.1.6'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.03', 'Carretas e Reboques', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.04', 'Veículos Leves e Utilitários', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.05', 'Máquinas e Equipamentos', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.06', 'Equipamentos de Rastreamento e Telemetria', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.07', 'Móveis e Utensílios', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.08', 'Equipamentos de Informática', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.09', 'Benfeitorias em Imóveis de Terceiros (Pátio/Garagem)', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.10', '(-) Depreciação Acumulada de Máquinas e Equipamentos', 'ASSET', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.11', '(-) Depreciação Acumulada de Móveis e Utensílios', 'ASSET', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.12', '(-) Depreciação Acumulada de Equipamentos de Informática', 'ASSET', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.13', '(-) Amortização Acumulada de Benfeitorias', 'ASSET', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.2', 'INVESTIMENTOS', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.2.01', 'Quotas de Capital em Cooperativas de Crédito', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.3', 'INTANGÍVEL', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.3.01', 'Softwares e Sistemas de Gestão', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.3'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.3.02', '(-) Amortização Acumulada de Intangível', 'ASSET', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.3'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.4', 'OUTROS CRÉDITOS DE LONGO PRAZO', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.4.01', 'Consórcios em Andamento', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.4.02', 'Depósitos Judiciais', 'ASSET', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '1.2.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.1.04', 'Fornecedores de Combustível e Pedágio', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.05', 'ICMS a Recolher', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.06', 'ISSQN a Recolher', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.07', 'ISSQN Retido a Recolher', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.08', 'IRRF a Recolher', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.09', 'CRF/CSRF a Recolher', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.3', 'EMPRÉSTIMOS E FINANCIAMENTOS', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.3.01', 'Empréstimos Bancários', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.3'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.3.02', 'Financiamentos de Veículos/Caminhões', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.3'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.4', 'OBRIGAÇÕES TRABALHISTAS E PREVIDENCIÁRIAS', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.4.01', 'OBRIGAÇÕES COM O PESSOAL', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.4'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.4.01.01', 'Salários a Pagar', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.4.01'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.4.01.02', 'Pró-labore a Pagar', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.4.01'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.4.01.03', 'Férias a Pagar', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.4.01'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.4.01.04', '13º Salário a Pagar', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.4.01'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.4.02', 'OBRIGAÇÕES PREVIDENCIÁRIAS', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.4'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.4.02.01', 'INSS a Recolher', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.4.02'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.4.02.02', 'FGTS a Recolher', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.4.02'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.5', 'OUTRAS OBRIGAÇÕES', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.5.01', 'Adiantamentos de Clientes', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.5'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.5.02', 'Outras Contas a Pagar', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.1.5'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.2', 'PASSIVO EXIGÍVEL A LONGO PRAZO', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.2.1', 'EMPRÉSTIMOS E FINANCIAMENTOS', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.2'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.2.1.01', 'Empréstimos e Financiamentos de Longo Prazo', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.2.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.2.2', 'FORNECEDORES', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.2'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.2.2.01', 'Fornecedores Nacionais - Longo Prazo', 'LIABILITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '2.2.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '3.1.2', '(-) Capital a Integralizar', 'EQUITY', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '3.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '3.2.2', 'Reserva Legal', 'EQUITY', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '3.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '3.2.3', '(-) Ajustes de Exercícios Anteriores', 'EQUITY', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '3.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.1.2', 'Receita de Fretes - Subcontratação/Agenciamento', 'REVENUE', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '4.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.1.3', 'Receita de Armazenagem e Logística', 'REVENUE', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '4.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.1.4', 'Receita de Aluguel de Veículos e Equipamentos', 'REVENUE', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '4.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.2', 'RECEITAS FINANCEIRAS', 'REVENUE', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '4'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.2.1', 'Rendimentos de Aplicações Financeiras', 'REVENUE', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '4.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.2.2', 'Descontos Obtidos', 'REVENUE', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '4.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.2.3', 'Juros Ativos', 'REVENUE', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '4.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.3', 'OUTRAS RECEITAS', 'REVENUE', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '4'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '4.3.1', 'Ganho na Alienação de Imobilizado', 'REVENUE', 'CREDIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '4.3'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '5.1.4', 'ISSQN sobre Serviços', 'REVENUE_DEDUCTION', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '5.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '5.2', 'DEVOLUÇÕES E ABATIMENTOS', 'REVENUE_DEDUCTION', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '5'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '5.2.1', 'Cancelamentos e Abatimentos de Frete', 'REVENUE_DEDUCTION', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '5.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.4', 'Salários - Motoristas e Ajudantes', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.5', 'Encargos Sociais sobre Folha - Operacional', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.6', 'Benefícios - Motoristas (VR/VA/Assistência)', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.7', 'Diárias e Ajuda de Custo de Viagem', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.8', 'Lubrificantes e Fluidos', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.9', 'Arla 32', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.10', 'Peças e Acessórios', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.11', 'Pneus e Recapagens', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.12', 'Lavagem e Lubrificação', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.13', 'Taxas de Fiscalização e Balança', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.14', 'Seguro de Veículos / RCTR-C', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.15', 'Seguro de Carga (RCTR-C/RC-DC)', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.16', 'Serviços de Rastreamento e Telemetria', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.17', 'Depreciação de Veículos', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.18', 'Depreciação de Máquinas e Equipamentos Operacionais', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.19', 'Fretes Pagos a Transportadores Autônomos/Agregados', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.20', 'Fretes Pagos a Transportadoras Subcontratadas', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.21', 'Licenciamento e IPVA da Frota', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '6.1.22', 'Multas de Trânsito Operacionais', 'COST', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '6.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.4', 'Honorários Advocatícios', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.5', 'Material de Escritório', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.6', 'Depreciação - Móveis, Utensílios e Informática', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.7', 'Despesas com Tecnologia da Informação', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.8', 'Pró-labore', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.9', 'Encargos sobre Pró-labore (INSS Patronal)', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.10', 'Salários e Ordenados - Administrativo', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.11', 'Encargos Sociais - Administrativo', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.1'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.2.3', 'Juros Passivos e Encargos de Financiamentos', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.2.4', 'Descontos Concedidos', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.2.5', 'IOF e Tarifas Bancárias', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.2.6', 'Despesas com Cartório e Protesto', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.2'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.3', 'DESPESAS COMERCIAIS', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.3.1', 'Comissões sobre Fretes', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.3'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.3.2', 'Publicidade e Marketing', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.3'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.4', 'DESPESAS TRIBUTÁRIAS', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.4.1', 'Taxas e Contribuições Diversas', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.4.2', 'IPTU e Taxas Municipais - Sede Administrativa', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.4'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.5', 'OUTRAS DESPESAS OPERACIONAIS', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7'), true, false, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.5.1', 'Despesas Diversas', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.5'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;
INSERT INTO chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active)
VALUES ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.5.2', 'Perda na Alienação de Imobilizado', 'EXPENSE', 'DEBIT', (SELECT id FROM chart_accounts WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code = '7.5'), false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;

-- ===================================================================
-- PARTE 3 — Inativa contas de teste/QA/duplicadas (nunca apaga).
-- ===================================================================
UPDATE chart_accounts SET is_active = false
WHERE company_id = '99999999-9999-9999-9999-999999999999' AND code IN ('1.1.1.03', '1.1.2.02', '1.1.3', '2.1.1.02', '2.1.1.03', '9.8', '9.9', '9.9.01');

COMMIT;