-- =====================================================================================
-- ERP CONTÁBIL — SEED DE DESENVOLVIMENTO — FISCAL/TRIBUTÁRIO, APURAÇÕES, OBRIGAÇÕES,
-- PATRIMÔNIO (Etapas 19–22)
-- =====================================================================================
-- Requer, nesta ordem: erp_schema_v1_1.sql, seed_demo_accounting.sql,
-- erp_schema_v1_2_cadastros_base.sql, seed_demo_base_registrations.sql,
-- erp_schema_v1_4_fiscal_tax_assets.sql, erp_schema_v1_5_tax_credits.sql (Etapa 24 —
-- adiciona tax_assessment_lines.notes, usado pela apuração ta...0004 abaixo). Usa a empresa/período/plano de contas/parceiros
-- já semeados — não recria nada disso, só ADICIONA 6 contas contábeis novas necessárias
-- (ISS/ICMS a recolher, ISS sobre receitas, despesa de depreciação, 2 contas de bem
-- patrimonial) porque não existiam no plano de contas demo original.
--
-- Mesma nota de ordem com a RLS de seed_demo_accounting.sql/seed_demo_banking.sql: os
-- lançamentos aqui são efetivados (DRAFT->POSTED) via UPDATE direto — se a RLS já estiver
-- aplicada, isso exige can_write_company()=true (sessão com JWT), então rode este seed
-- ANTES de aplicar erp_rls_v1.sql, ou simule autenticação como nos testes da Etapa 17.
--
-- 100% IDEMPOTENTE via ON CONFLICT DO NOTHING + limpeza determinística no início.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. IDEMPOTÊNCIA: limpa dados desta etapa de execuções anteriores
-- -------------------------------------------------------------------------------------
DELETE FROM asset_depreciations WHERE fixed_asset_id IN (
  'fa000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000003'
);
DELETE FROM asset_events WHERE fixed_asset_id IN (
  'fa000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000003'
);
DELETE FROM fixed_assets WHERE id IN (
  'fa000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000003'
);
DELETE FROM asset_categories WHERE id IN ('ac000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000002');

DELETE FROM obligations WHERE id IN (
  'ob000000-0000-0000-0000-000000000001', 'ob000000-0000-0000-0000-000000000002', 'ob000000-0000-0000-0000-000000000003',
  'ob000000-0000-0000-0000-000000000004', 'ob000000-0000-0000-0000-000000000005'
);
DELETE FROM tax_assessment_lines WHERE tax_assessment_id IN (
  'ta000000-0000-0000-0000-000000000001', 'ta000000-0000-0000-0000-000000000002', 'ta000000-0000-0000-0000-000000000003',
  'ta000000-0000-0000-0000-000000000004'
);
DELETE FROM tax_assessments WHERE id IN (
  'ta000000-0000-0000-0000-000000000001', 'ta000000-0000-0000-0000-000000000002', 'ta000000-0000-0000-0000-000000000003',
  'ta000000-0000-0000-0000-000000000004'
);

DELETE FROM fiscal_document_retentions WHERE fiscal_document_id IN (
  'fd000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000002',
  'fd000000-0000-0000-0000-000000000003', 'fd000000-0000-0000-0000-000000000004'
);
DELETE FROM fiscal_document_items WHERE fiscal_document_id IN (
  'fd000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000002',
  'fd000000-0000-0000-0000-000000000003', 'fd000000-0000-0000-0000-000000000004'
);
DELETE FROM fiscal_documents WHERE id IN (
  'fd000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000002',
  'fd000000-0000-0000-0000-000000000003', 'fd000000-0000-0000-0000-000000000004'
);

DELETE FROM journal_entry_lines WHERE journal_entry_id IN (
  'je000000-0000-0000-0000-000000000001', 'je000000-0000-0000-0000-000000000002', 'je000000-0000-0000-0000-000000000003'
);
DELETE FROM journal_entries WHERE id IN (
  'je000000-0000-0000-0000-000000000001', 'je000000-0000-0000-0000-000000000002', 'je000000-0000-0000-0000-000000000003'
);


-- -------------------------------------------------------------------------------------
-- 1. CONTAS CONTÁBEIS NOVAS (necessárias para Fiscal/Apuração/Patrimônio, ausentes do
--    plano de contas demo original)
-- -------------------------------------------------------------------------------------
INSERT INTO chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, parent_id, is_synthetic, accepts_entries, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '5.1.4', 'ISS sobre Receitas', 'REVENUE_DEDUCTION', 'DEBIT', 'a0000000-0000-0000-0000-000000000055', false, true, true),
  ('c1000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.05', 'ISS a Recolher', 'LIABILITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000222', false, true, true),
  ('c1000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2.1.2.06', 'ICMS a Recolher', 'LIABILITY', 'CREDIT', 'a0000000-0000-0000-0000-000000000222', false, true, true),
  ('c1000000-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '7.1.4', 'Despesa de Depreciação', 'EXPENSE', 'DEBIT', 'a0000000-0000-0000-0000-000000000077', false, true, true),
  ('c1000000-0000-0000-0000-000000000005', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.03', 'Móveis e Utensílios', 'ASSET', 'DEBIT', 'a0000000-0000-0000-0000-000000000121', false, true, true),
  ('c1000000-0000-0000-0000-000000000006', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '1.2.1.04', 'Depreciação Acumulada - Móveis', 'ASSET', 'CREDIT', 'a0000000-0000-0000-0000-000000000121', false, true, true)
ON CONFLICT (company_id, code) DO NOTHING;


-- -------------------------------------------------------------------------------------
-- 2. DOCUMENTOS FISCAIS (Etapa 19) — 1 compra (DRAFT), 1 venda (BOOKED+ACCOUNTED),
--    1 serviço tomado (VALIDATED, com retenção), 1 serviço prestado (CANCELLED)
-- -------------------------------------------------------------------------------------

-- 2.1 Compra de mercadoria (entrada) — DRAFT, ainda em digitação
INSERT INTO fiscal_documents (
  id, workspace_id, company_id, partner_id, fiscal_operation_nature_id, direction, document_type,
  operation_type, document_number, series, issue_date, operation_date, competence,
  document_amount, merchandise_amount, status, accounting_status, tax_status, source, notes
) VALUES (
  'fd000000-0000-0000-0000-000000000001',
  '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'p0000000-0000-0000-0000-000000000002', -- Fornecedor Demo
  '80000000-0000-0000-0000-000000000001', -- Compra para uso/consumo (seed_demo_base_registrations.sql)
  'IN', 'NFE', 'PURCHASE', '10045', '1', '2025-01-14', '2025-01-14', '2025-01-01',
  2500.00, 2500.00, 'DRAFT', 'NOT_ACCOUNTED', 'NOT_ASSESSED', 'MANUAL',
  'Compra de peças de manutenção — documento de demonstração, ainda em digitação.'
);

INSERT INTO fiscal_document_items (
  id, workspace_id, company_id, fiscal_document_id, item_id, line_number, description, item_type,
  quantity, unit, unit_amount, total_amount, ncm, cfop
) VALUES (
  gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'fd000000-0000-0000-0000-000000000001', NULL, 1, 'Peças de manutenção de frota', 'PRODUCT',
  1, 'UN', 2500.00, 2500.00, '87089990', '1556'
);

-- 2.2 Venda de frete (saída) — BOOKED e ACCOUNTED, com lançamento contábil real gerado
INSERT INTO fiscal_documents (
  id, workspace_id, company_id, partner_id, fiscal_operation_nature_id, direction, document_type,
  operation_type, document_number, series, issue_date, operation_date, competence,
  document_amount, merchandise_amount, services_amount, icms_base, icms_rate, icms_amount,
  status, accounting_status, tax_status, source, journal_entry_id, notes
) VALUES (
  'fd000000-0000-0000-0000-000000000002',
  '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'p0000000-0000-0000-0000-000000000001', -- Cliente Demo
  '80000000-0000-0000-0000-000000000002', -- Venda de mercadoria (reaproveitada para o frete de demonstração)
  'OUT', 'CTE', 'FREIGHT', '20031', '1', '2025-01-20', '2025-01-20', '2025-01-01',
  4000.00, 4000.00, 0, 4000.00, 12.00, 480.00,
  'BOOKED', 'ACCOUNTED', 'NOT_ASSESSED', 'MANUAL', 'je000000-0000-0000-0000-000000000001',
  'Frete de demonstração já escriturado e contabilizado (Débito Clientes / Crédito Receita de Fretes).'
);

INSERT INTO fiscal_document_items (
  id, workspace_id, company_id, fiscal_document_id, item_id, line_number, description, item_type,
  quantity, unit, unit_amount, total_amount, cfop, tax_base_icms, icms_rate, icms_amount
) VALUES (
  gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'fd000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 1, 'Serviço de Frete Rota SP-Curitiba', 'FREIGHT',
  1, 'UN', 4000.00, 4000.00, '6353', 4000.00, 12.00, 480.00
);

-- Lançamento contábil da venda de frete (mesmo padrão DRAFT->POSTED usado em toda a base)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, document, partner_id, origin, origin_id, status)
VALUES (
  'je000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  '2025-01-20', '2025-01-01', 'Faturamento de Frete — CT-e 20031', 'CT-e 20031',
  'p0000000-0000-0000-0000-000000000001', 'FISCAL_DOCUMENT', 'fd000000-0000-0000-0000-000000000002', 'DRAFT'
);
INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo) VALUES
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'je000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000112', 'DEBIT', 4000.00, 'Clientes Nacionais - CT-e 20031'),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'je000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000411', 'CREDIT', 4000.00, 'Receita de Frete - CT-e 20031');
UPDATE journal_entries SET status = 'POSTED' WHERE id = 'je000000-0000-0000-0000-000000000001';

-- 2.3 Serviço tomado (NFS-e) — VALIDATED, com retenção de ISS na fonte
INSERT INTO fiscal_documents (
  id, workspace_id, company_id, partner_id, fiscal_operation_nature_id, direction, document_type,
  operation_type, document_number, series, issue_date, operation_date, competence,
  document_amount, services_amount, iss_base, iss_rate, iss_amount,
  status, accounting_status, tax_status, source, notes
) VALUES (
  'fd000000-0000-0000-0000-000000000003',
  '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'p0000000-0000-0000-0000-000000000002', -- Fornecedor Demo (prestador do serviço tomado)
  '80000000-0000-0000-0000-000000000004', -- Serviço tomado (seed_demo_base_registrations.sql)
  'IN', 'NFSE', 'SERVICE_TAKEN', '5521', NULL, '2025-01-22', '2025-01-22', '2025-01-01',
  1200.00, 1200.00, 1200.00, 5.00, 60.00,
  'VALIDATED', 'NOT_ACCOUNTED', 'NOT_ASSESSED', 'MANUAL',
  'Serviço de consultoria tomado — validado, aguardando contabilização.'
);

INSERT INTO fiscal_document_items (
  id, workspace_id, company_id, fiscal_document_id, item_id, line_number, description, item_type,
  quantity, unit, unit_amount, total_amount, service_code, tax_base_iss, iss_rate, iss_amount
) VALUES (
  gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'fd000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 1, 'Consultoria administrativa (Janeiro/2025)', 'SERVICE',
  1, 'UN', 1200.00, 1200.00, '17.01', 1200.00, 5.00, 60.00
);

INSERT INTO fiscal_document_retentions (id, workspace_id, company_id, fiscal_document_id, tax_type, base_amount, rate, amount, withheld_by_partner, notes)
VALUES (
  gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'fd000000-0000-0000-0000-000000000003', 'ISS', 1200.00, 5.00, 60.00, true,
  'ISS retido na fonte pelo tomador (regra do município — demonstração).'
);

-- 2.4 Serviço prestado (NFS-e) — CANCELLED, não entra em apuração
INSERT INTO fiscal_documents (
  id, workspace_id, company_id, partner_id, fiscal_operation_nature_id, direction, document_type,
  operation_type, document_number, series, issue_date, operation_date, competence,
  document_amount, services_amount, status, accounting_status, tax_status, source, notes
) VALUES (
  'fd000000-0000-0000-0000-000000000004',
  '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'p0000000-0000-0000-0000-000000000001', -- Cliente Demo
  '80000000-0000-0000-0000-000000000003', -- Prestação de serviço (seed_demo_base_registrations.sql)
  'OUT', 'NFSE', 'SERVICE_PROVIDED', '5522', NULL, '2025-01-23', '2025-01-23', '2025-01-01',
  800.00, 800.00, 'CANCELLED', 'NOT_ACCOUNTED', 'IGNORED', 'MANUAL',
  'NFS-e cancelada pelo emissor por erro de dados do tomador — demonstração de documento CANCELLED, fora da apuração.'
);

INSERT INTO fiscal_document_items (
  id, workspace_id, company_id, fiscal_document_id, line_number, description, item_type, quantity, unit, unit_amount, total_amount, service_code
) VALUES (
  gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'fd000000-0000-0000-0000-000000000004', 1, 'Serviço de consultoria (cancelado)', 'SERVICE', 1, 'UN', 800.00, 800.00, '17.01'
);


-- -------------------------------------------------------------------------------------
-- 3. APURAÇÕES FISCAIS (Etapa 20) — ISS (CLOSED, com lançamento), ICMS (DRAFT), PIS (CLOSED)
-- -------------------------------------------------------------------------------------

-- 3.1 ISS — CLOSED, com lançamento contábil de provisão gerado
INSERT INTO tax_assessments (
  id, workspace_id, company_id, tax_type, regime, competence, base_amount, rate,
  debit_amount, credit_amount, retained_amount, adjustment_amount, payable_amount,
  amount_due, status, due_date, journal_entry_id, reviewed_at, closed_at
) VALUES (
  'ta000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'ISS', 'LUCRO_REAL', '2025-01-01', 1200.00, 5.00,
  60.00, 0, 60.00, 0, 0.00,
  0.00, 'CLOSED', '2025-02-10', 'je000000-0000-0000-0000-000000000002', now(), now()
);
-- ISS retido na fonte (fd 3) já quita o débito apurado: payable_amount = 0 (nada a
-- recolher, o tomador já reteve e vai recolher em nome da empresa prestadora seria o
-- inverso — aqui, para simplificar a demonstração, tratamos o ISS retido como já
-- liquidado, sem gerar obrigação de pagamento adicional).
INSERT INTO tax_assessment_lines (id, workspace_id, company_id, tax_assessment_id, fiscal_document_id, source_type, source_id, line_type, description, base_amount, tax_rate, amount) VALUES
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'ta000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000003', 'FISCAL_DOCUMENT', 'fd000000-0000-0000-0000-000000000003', 'DEBIT', 'ISS sobre serviço tomado NFS-e 5521', 1200.00, 5.00, 60.00),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'ta000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000003', 'RETENTION', 'fd000000-0000-0000-0000-000000000003', 'RETENTION', 'ISS retido na fonte pelo tomador', 1200.00, 5.00, 60.00);

INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, origin, origin_id, status)
VALUES (
  'je000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  '2025-01-31', '2025-01-01', 'Provisão de ISS apurado (competência 01/2025)', 'FISCAL_ASSESSMENT', 'ta000000-0000-0000-0000-000000000001', 'DRAFT'
);
INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo) VALUES
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'je000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'DEBIT', 60.00, 'ISS sobre receitas - competência 01/2025'),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'je000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'CREDIT', 60.00, 'ISS a Recolher - competência 01/2025');
UPDATE journal_entries SET status = 'POSTED' WHERE id = 'je000000-0000-0000-0000-000000000002';

-- 3.2 ICMS — DRAFT, ainda não calculada de verdade (demonstra estado inicial)
INSERT INTO tax_assessments (id, workspace_id, company_id, tax_type, regime, competence, status)
VALUES ('ta000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'ICMS', 'LUCRO_REAL', '2025-01-01', 'DRAFT');

-- 3.3 PIS — CLOSED, sem lançamento (demonstra apuração fechada mas ainda não contabilizada)
INSERT INTO tax_assessments (
  id, workspace_id, company_id, tax_type, regime, competence, base_amount, rate,
  debit_amount, payable_amount, amount_due, status, due_date, reviewed_at, closed_at
) VALUES (
  'ta000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'PIS', 'LUCRO_REAL', '2025-01-01', 4000.00, 0.65, 26.00, 26.00, 26.00, 'CLOSED', '2025-02-15', now(), now()
);
INSERT INTO tax_assessment_lines (id, workspace_id, company_id, tax_assessment_id, fiscal_document_id, source_type, source_id, line_type, description, base_amount, tax_rate, amount) VALUES
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'ta000000-0000-0000-0000-000000000003', 'fd000000-0000-0000-0000-000000000002', 'FISCAL_DOCUMENT', 'fd000000-0000-0000-0000-000000000002', 'DEBIT', 'PIS sobre faturamento de frete CT-e 20031', 4000.00, 0.65, 26.00);

-- 3.4 COFINS — CLOSED, com SALDO CREDOR a transportar (Etapa 24 — achado B1 da auditoria):
-- demonstra crédito tributário manual, saldo credor anterior e ajuste manual negativo
-- compondo a mesma apuração. debit=200, credit=500, previous_balance=150, adjustment=-30.
-- gross_balance = 200 - 500 - 0 - 150 + (-30) + 0 + 0 = -480 -> payable_amount=0,
-- next_balance_amount=480 (vira crédito do período seguinte). Ver
-- docs/tax-assessment-credits.md para a fórmula completa.
INSERT INTO tax_assessments (
  id, workspace_id, company_id, tax_type, regime, competence, base_amount, rate,
  debit_amount, credit_amount, retained_amount, adjustment_amount, previous_balance_amount,
  payable_amount, next_balance_amount, amount_due, status, due_date, reviewed_at, closed_at
) VALUES (
  'ta000000-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'COFINS', 'LUCRO_REAL', '2025-01-01', NULL, NULL,
  200.00, 500.00, 0, -30.00, 150.00,
  0.00, 480.00, 0.00, 'CLOSED', '2025-02-25', now(), now()
);
INSERT INTO tax_assessment_lines (id, workspace_id, company_id, tax_assessment_id, source_type, source_id, line_type, description, amount, notes) VALUES
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'ta000000-0000-0000-0000-000000000004', 'MANUAL_ADJUSTMENT', NULL, 'DEBIT', 'COFINS sobre faturamento (lançamento manual de demonstração)', 200.00, NULL),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'ta000000-0000-0000-0000-000000000004', 'MANUAL_ADJUSTMENT', NULL, 'CREDIT', 'Crédito de COFINS sobre compras não-cumulativo — lançamento manual de demonstração', 500.00, 'Demonstra o achado B1 da auditoria (docs/audit-fiscal-tax-assets.md): crédito tributário agora lançável e auditável via linha manual.'),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'ta000000-0000-0000-0000-000000000004', 'MANUAL_ADJUSTMENT', NULL, 'ADJUSTMENT_NEGATIVE', 'Ajuste negativo de demonstração (correção de apuração de competência anterior)', 30.00, NULL);


-- -------------------------------------------------------------------------------------
-- 4. OBRIGAÇÕES (Etapa 20) — aberta, vencida, gerada por apuração, paga, entregue
-- -------------------------------------------------------------------------------------

-- 4.1 Aberta (OPEN), competência corrente, vencimento futuro
INSERT INTO obligations (id, workspace_id, company_id, obligation_type, competence, amount, due_date, status, notes)
VALUES ('ob000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'DAS', '2025-01-01', 850.00, '2025-02-20', 'OPEN', 'DAS do Simples Nacional — competência de demonstração.');

-- 4.2 Vencida (OVERDUE)
INSERT INTO obligations (id, workspace_id, company_id, obligation_type, competence, amount, due_date, status, notes)
VALUES ('ob000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'EFD_CONTRIBUICOES', '2024-11-01', 0.00, '2024-12-15', 'OVERDUE', 'Entrega acessória em atraso — demonstração.');

-- 4.3 Gerada a partir da apuração de ISS fechada
INSERT INTO obligations (id, workspace_id, company_id, obligation_type, competence, amount, due_date, status, origin_assessment_id, origin_assessment_table, notes)
VALUES ('ob000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'ISS', '2025-01-01', 60.00, '2025-02-10', 'GENERATED', 'ta000000-0000-0000-0000-000000000001', 'tax_assessments', 'Guia de ISS gerada a partir da apuração ta000000-...-0001.');
UPDATE tax_assessments SET obligation_id = 'ob000000-0000-0000-0000-000000000003' WHERE id = 'ta000000-0000-0000-0000-000000000001';

-- 4.4 Paga (PAID), com lançamento contábil de pagamento vinculado (exigido por constraint)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, origin, status)
VALUES ('je000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2025-01-20', '2025-01-01', 'Pagamento de PIS a Recolher (competência 12/2024)', 'MANUAL', 'DRAFT');
INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo) VALUES
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'je000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000211', 'DEBIT', 195.00, 'Baixa de PIS a Recolher'),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'je000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000102', 'CREDIT', 195.00, 'Pagamento via Sicredi');
UPDATE journal_entries SET status = 'POSTED' WHERE id = 'je000000-0000-0000-0000-000000000003';

INSERT INTO obligations (id, workspace_id, company_id, obligation_type, competence, amount, due_date, status, payment_journal_entry_id, paid_at, notes)
VALUES ('ob000000-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'PIS', '2024-12-01', 195.00, '2025-01-20', 'PAID', 'je000000-0000-0000-0000-000000000003', '2025-01-20T15:00:00Z', 'PIS da competência 12/2024, já pago e conciliado com o lançamento contábil.');

-- 4.5 Entregue (DELIVERED — obrigação acessória sem valor monetário)
INSERT INTO obligations (id, workspace_id, company_id, obligation_type, competence, amount, due_date, status, delivered_at, notes)
VALUES ('ob000000-0000-0000-0000-000000000005', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'DEFIS', '2024-01-01', 0.00, '2025-03-31', 'DELIVERED', '2025-03-15T10:00:00Z', 'Declaração anual do Simples Nacional entregue — demonstração de obrigação acessória sem valor.');


-- -------------------------------------------------------------------------------------
-- 5. PATRIMÔNIO (Etapa 22) — 2 categorias, 3 bens, depreciações
-- -------------------------------------------------------------------------------------

INSERT INTO asset_categories (
  id, workspace_id, company_id, name, description, default_useful_life_months, default_annual_rate,
  default_asset_account_id, default_depreciation_account_id, default_expense_account_id,
  disposal_gain_account_id, disposal_loss_account_id, active
) VALUES
  (
    'ac000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
    'Veículos de Frota', 'Caminhões e veículos utilizados na operação de transporte.', 60, 20.00,
    'c0000000-0000-0000-0000-000000000121', 'c0000000-0000-0000-0000-000000000122', 'c1000000-0000-0000-0000-000000000004',
    (select id from chart_accounts where company_id = '99999999-9999-9999-9999-999999999999' and code = '4.3.1'),
    (select id from chart_accounts where company_id = '99999999-9999-9999-9999-999999999999' and code = '7.5.2'),
    true
  ),
  (
    'ac000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
    'Móveis e Equipamentos', 'Móveis, computadores e equipamentos administrativos.', 120, 10.00,
    'c1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000004',
    (select id from chart_accounts where company_id = '99999999-9999-9999-9999-999999999999' and code = '4.3.1'),
    (select id from chart_accounts where company_id = '99999999-9999-9999-9999-999999999999' and code = '7.5.2'),
    true
  );

-- 5.1 Bem ativo, depreciando (ACTIVE) — vinculado à compra fiscal de demonstração
INSERT INTO fixed_assets (
  id, workspace_id, company_id, category_id, code, description, asset_tag,
  acquisition_date, start_depreciation_date, acquisition_amount, residual_amount, useful_life_months,
  fiscal_document_id, partner_id, asset_account_id, depreciation_account_id, expense_account_id, status
) VALUES (
  'fa000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'ac000000-0000-0000-0000-000000000001', 'VEIC-001', 'Caminhão Volvo FH 540 - Placa DEMO-0001', 'PAT-0001',
  '2024-06-01', '2024-07-01', 360000.00, 36000.00, 60,
  NULL, 'p0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000121', 'c0000000-0000-0000-0000-000000000122', 'c1000000-0000-0000-0000-000000000004', 'ACTIVE'
);

-- Depreciação de Janeiro/2025 deste bem — CALCULADA e CONTABILIZADA (lançamento real)
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, origin, status)
VALUES ('je000000-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', '2025-01-31', '2025-01-01', 'Depreciação mensal - Caminhão VEIC-001 (competência 01/2025)', 'ASSET_DEPRECIATION', 'DRAFT');
INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo) VALUES
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'je000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000004', 'DEBIT', 5400.00, 'Depreciação VEIC-001 - 01/2025'),
  (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'je000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000122', 'CREDIT', 5400.00, 'Depreciação Acumulada VEIC-001 - 01/2025');
UPDATE journal_entries SET status = 'POSTED' WHERE id = 'je000000-0000-0000-0000-000000000004';

INSERT INTO asset_depreciations (id, workspace_id, company_id, fixed_asset_id, competence, accounting_amount, fiscal_amount, status, depreciation_date, accumulated_amount_after, net_book_value_after, journal_entry_id)
VALUES (
  'ad000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'fa000000-0000-0000-0000-000000000001', '2025-01-01', 5400.00, 5400.00, 'POSTED', '2025-01-31', 5400.00, 354600.00, 'je000000-0000-0000-0000-000000000004'
);

INSERT INTO asset_events (id, workspace_id, company_id, fixed_asset_id, event_type, event_date, amount, journal_entry_id, notes)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'fa000000-0000-0000-0000-000000000001', 'ACQUISITION', '2024-06-01', 360000.00, NULL, 'Aquisição registrada como evento histórico (sem lançamento de aquisição na demonstração — bem já constava do saldo de abertura).');

-- 5.2 Bem totalmente depreciado (FULLY_DEPRECIATED)
INSERT INTO fixed_assets (
  id, workspace_id, company_id, category_id, code, description, asset_tag,
  acquisition_date, start_depreciation_date, acquisition_amount, residual_amount, useful_life_months,
  asset_account_id, depreciation_account_id, expense_account_id, status
) VALUES (
  'fa000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'ac000000-0000-0000-0000-000000000002', 'MOV-001', 'Mobiliário de escritório (conjunto) - totalmente depreciado', 'PAT-0002',
  '2015-01-01', '2015-02-01', 12000.00, 0.00, 120,
  'c1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000004', 'FULLY_DEPRECIATED'
);
-- AUDITORIA (Etapa 23): accounting_amount corrigido de 100.00 para 12000.00 — o app
-- calcula depreciação acumulada/valor líquido contábil somando asset_depreciations.
-- accounting_amount (não lendo accumulated_amount_after, que é só um snapshot), então um
-- único lançamento de 100.00 deixava este bem "FULLY_DEPRECIATED" com valor líquido
-- contábil de R$ 11.900,00 na UI — contradizendo o próprio status. Lançamento único de
-- valor cheio representa, para fins de demonstração, o acumulado histórico de 120 meses.
INSERT INTO asset_depreciations (id, workspace_id, company_id, fixed_asset_id, competence, accounting_amount, status, depreciation_date, accumulated_amount_after, net_book_value_after)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'fa000000-0000-0000-0000-000000000002', '2024-12-01', 12000.00, 'CALCULATED', '2024-12-31', 12000.00, 0.00);

-- 5.3 Bem baixado (DISPOSED)
INSERT INTO fixed_assets (
  id, workspace_id, company_id, category_id, code, description, asset_tag,
  acquisition_date, start_depreciation_date, acquisition_amount, residual_amount, useful_life_months,
  asset_account_id, depreciation_account_id, expense_account_id, status,
  disposal_date, disposal_amount, disposal_reason
) VALUES (
  'fa000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
  'ac000000-0000-0000-0000-000000000001', 'VEIC-002', 'Caminhão antigo vendido - Placa DEMO-0002', 'PAT-0003',
  '2018-03-01', '2018-04-01', 180000.00, 18000.00, 60,
  'c0000000-0000-0000-0000-000000000121', 'c0000000-0000-0000-0000-000000000122', 'c1000000-0000-0000-0000-000000000004', 'DISPOSED',
  '2024-10-15', 25000.00, 'Venda do veículo por obsolescência da frota — demonstração.'
);
INSERT INTO asset_events (id, workspace_id, company_id, fixed_asset_id, event_type, event_date, amount, notes)
VALUES (gen_random_uuid(), '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'fa000000-0000-0000-0000-000000000003', 'DISPOSAL', '2024-10-15', 25000.00, 'Baixa por venda — contabilização de baixa não incluída nesta demonstração (documentada como pendência).');

COMMIT;
