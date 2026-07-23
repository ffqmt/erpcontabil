-- =====================================================================================
-- ERP CONTÁBIL — SEED DE DESENVOLVIMENTO — BANCOS E CONCILIAÇÃO (Etapa 18)
-- =====================================================================================
-- Requer, nesta ordem: erp_schema_v1_1.sql, seed_demo_accounting.sql,
-- db/migrations/erp_schema_v1_2_cadastros_base.sql, seed_demo_base_registrations.sql,
-- db/migrations/erp_schema_v1_3_bank_reconciliation_mvp.sql. Usa a conta bancária, o
-- plano de contas e o período de Janeiro/2025 já semeados pelos scripts anteriores — não
-- recria nada disso.
--
-- ORDEM COM A RLS: assim como seed_demo_accounting.sql, este script transiciona um
-- lançamento de DRAFT para POSTED via UPDATE direto, o que aciona next_journal_number().
-- Se erp_rls_v1.sql JÁ tiver sido aplicado no seu ambiente antes deste seed, a versão
-- SECURITY DEFINER de next_journal_number() exige can_write_company(company_id) = true,
-- que depende de auth.uid() resolvido via JWT — uma sessão sem claims (rodando só como
-- postgres/superuser) faz can_write_company retornar false e a transição falha. Siga a
-- ordem documentada em db/README.md (seed ANTES da RLS) para evitar isso — é a mesma
-- característica que o seed contábil original já tem, não uma novidade desta etapa.
--
-- 100% IDEMPOTENTE via ON CONFLICT DO NOTHING + limpeza determinística no início.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. IDEMPOTÊNCIA: limpa o lote de importação e linhas de execuções anteriores deste seed
-- -------------------------------------------------------------------------------------
DELETE FROM bank_reconciliations WHERE bank_statement_line_id IN (
  SELECT id FROM bank_statement_lines WHERE bank_statement_import_id = 'f0000000-0000-0000-0000-000000000001'
);
DELETE FROM bank_statement_lines WHERE bank_statement_import_id = 'f0000000-0000-0000-0000-000000000001';
DELETE FROM journal_entry_lines WHERE journal_entry_id = 'f1000000-0000-0000-0000-000000000001';
DELETE FROM journal_entries WHERE id = 'f1000000-0000-0000-0000-000000000001';
DELETE FROM bank_statement_imports WHERE id = 'f0000000-0000-0000-0000-000000000001';


-- -------------------------------------------------------------------------------------
-- 2. LOTE DE IMPORTAÇÃO DEMO
-- -------------------------------------------------------------------------------------
INSERT INTO bank_statement_imports (
  id, workspace_id, company_id, bank_account_id, file_name, source, status,
  total_lines, valid_lines, invalid_lines, duplicate_lines, message
) VALUES (
  'f0000000-0000-0000-0000-000000000001',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '90000000-0000-0000-0000-000000000001', -- Banco Teste RLS/Sicredi, seed_demo_base_registrations.sql
  'extrato_sicredi_janeiro_2025_demo.csv',
  'CSV',
  'SUCCESS',
  4, 4, 0, 0,
  'Importação de demonstração — 4 linhas processadas (Etapa 18).'
);


-- -------------------------------------------------------------------------------------
-- 3. LINHAS DE EXTRATO — hash calculado com a fórmula canônica (ver
--    src/modules/banking/utils.ts::computeLineHash), replicada aqui em SQL puro:
--    md5(company_id || '|' || bank_account_id || '|' || entry_date || '|' || amount ||
--        '|' || lower(trim(description)) || '|' || coalesce(document_number, ''))
-- -------------------------------------------------------------------------------------

-- Linha 1: PENDING — entrada (PIX de cliente), ainda não classificada.
INSERT INTO bank_statement_lines (
  id, workspace_id, company_id, bank_account_id, bank_statement_import_id,
  entry_date, description, document_number, amount, balance, status, hash
) VALUES (
  'f2000000-0000-0000-0000-000000000001',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '90000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  '2025-01-08',
  'PIX RECEBIDO CLIENTE DEMO LTDA',
  NULL,
  500.00,
  100500.00,
  'PENDING',
  md5('99999999-9999-9999-9999-999999999999|90000000-0000-0000-0000-000000000001|2025-01-08|500.00|pix recebido cliente demo ltda|')
);

-- Linha 2: PENDING — saída (tarifa bancária), ainda não classificada.
INSERT INTO bank_statement_lines (
  id, workspace_id, company_id, bank_account_id, bank_statement_import_id,
  entry_date, description, document_number, amount, balance, status, hash
) VALUES (
  'f2000000-0000-0000-0000-000000000002',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '90000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  '2025-01-10',
  'TARIFA PACOTE DE SERVICOS',
  NULL,
  -45.00,
  100455.00,
  'PENDING',
  md5('99999999-9999-9999-9999-999999999999|90000000-0000-0000-0000-000000000001|2025-01-10|-45.00|tarifa pacote de servicos|')
);

-- Linha 3: IGNORED — lançamento bancário duplicado pelo próprio banco, descartado com justificativa.
INSERT INTO bank_statement_lines (
  id, workspace_id, company_id, bank_account_id, bank_statement_import_id,
  entry_date, description, document_number, amount, balance, status, classification_memo
) VALUES (
  'f2000000-0000-0000-0000-000000000003',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '90000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  '2025-01-12',
  'ESTORNO AUTOMATICO SISTEMA BANCARIO',
  NULL,
  -10.00,
  100445.00,
  'IGNORED',
  'Estorno automático do próprio banco referente a tarifa cobrada em duplicidade — sem efeito contábil real, ignorada na conciliação.'
);

-- Linha 4: RECONCILED — entrada de frete já classificada, com lançamento contábil real
-- gerado e conciliado (demonstra o fluxo completo ponta a ponta).
INSERT INTO bank_statement_lines (
  id, workspace_id, company_id, bank_account_id, bank_statement_import_id,
  entry_date, description, document_number, amount, balance, status,
  counterparty_account_id, classification_memo, reconciled_at, reconciled
) VALUES (
  'f2000000-0000-0000-0000-000000000004',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '90000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  '2025-01-25',
  'PIX RECEBIDO - FRETE ROTA SP-CURITIBA',
  NULL,
  300.00,
  100745.00,
  'RECONCILED',
  'c0000000-0000-0000-0000-000000000411', -- Receita de Fretes (seed_demo_accounting.sql)
  'Recebimento de frete via PIX — classificado e conciliado (seed de demonstração).',
  now(),
  true
);

-- Lançamento contábil correspondente à Linha 4 (mesmo padrão DRAFT->POSTED do seed
-- contábil original: insere cabeçalho + linhas em DRAFT, depois efetiva para POSTED).
INSERT INTO journal_entries (id, workspace_id, company_id, entry_date, competence, description, origin, status)
VALUES (
  'f1000000-0000-0000-0000-000000000001',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '2025-01-25',
  '2025-01-01',
  'Conciliação bancária: PIX recebido - Frete rota SP-Curitiba',
  'BANK_STATEMENT',
  'DRAFT'
);

INSERT INTO journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
VALUES
  (
    'f3000000-0000-0000-0000-000000000001',
    '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
    'f1000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000102', -- Banco Conta Movimento (Sicredi)
    'DEBIT', 300.00, 'Recebimento via PIX — conciliação bancária'
  ),
  (
    gen_random_uuid(),
    '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
    'f1000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000411', -- Receita de Fretes
    'CREDIT', 300.00, 'Recebimento via PIX — conciliação bancária'
  );

UPDATE journal_entries SET status = 'POSTED' WHERE id = 'f1000000-0000-0000-0000-000000000001';

-- Vincula a linha do extrato à perna (linha) do lançamento que representa o banco.
UPDATE bank_statement_lines
SET journal_entry_line_id = 'f3000000-0000-0000-0000-000000000001'
WHERE id = 'f2000000-0000-0000-0000-000000000004';

-- Trilha de auditoria de conciliação (bank_reconciliations já existia desde a v1.1).
INSERT INTO bank_reconciliations (id, workspace_id, company_id, bank_account_id, bank_statement_line_id, journal_entry_line_id, reconciled_at)
VALUES (
  gen_random_uuid(),
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  '90000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000004',
  'f3000000-0000-0000-0000-000000000001',
  now()
);

COMMIT;
