-- OPCIONAL — só rode isto se quiser remover de vez as contas de teste/QA
-- listadas acima (em vez de deixá-las apenas inativas). Cada DELETE só
-- executa se não houver nenhum journal_entry_lines apontando pra conta —
-- caso exista lançamento vinculado, a conta é preservada (fica inativa).
BEGIN;
DELETE FROM chart_accounts a
WHERE a.company_id = '99999999-9999-9999-9999-999999999999' AND a.code = '1.1.1.03'
  AND NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM chart_accounts c2 WHERE c2.parent_id = a.id);  -- Banco teste
DELETE FROM chart_accounts a
WHERE a.company_id = '99999999-9999-9999-9999-999999999999' AND a.code = '1.1.2.02'
  AND NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM chart_accounts c2 WHERE c2.parent_id = a.id);  -- Cliente - QA Cliente AutoConta 30A
DELETE FROM chart_accounts a
WHERE a.company_id = '99999999-9999-9999-9999-999999999999' AND a.code = '1.1.3'
  AND NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM chart_accounts c2 WHERE c2.parent_id = a.id);  -- Bancos com movimento (sintética vazia, redundante com 1.1.1)
DELETE FROM chart_accounts a
WHERE a.company_id = '99999999-9999-9999-9999-999999999999' AND a.code = '2.1.1.02'
  AND NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM chart_accounts c2 WHERE c2.parent_id = a.id);  -- Fornecedor - Fornecedor Exemplo Industria e Comercio Ltda (1ª ocorrência)
DELETE FROM chart_accounts a
WHERE a.company_id = '99999999-9999-9999-9999-999999999999' AND a.code = '2.1.1.03'
  AND NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM chart_accounts c2 WHERE c2.parent_id = a.id);  -- Fornecedor - Fornecedor Exemplo Industria e Comercio Ltda (2ª ocorrência, duplicada)
DELETE FROM chart_accounts a
WHERE a.company_id = '99999999-9999-9999-9999-999999999999' AND a.code = '9.8'
  AND NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM chart_accounts c2 WHERE c2.parent_id = a.id);  -- QA Sintetica 29B
DELETE FROM chart_accounts a
WHERE a.company_id = '99999999-9999-9999-9999-999999999999' AND a.code = '9.9'
  AND NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM chart_accounts c2 WHERE c2.parent_id = a.id);  -- QA Sintetica Smoke
DELETE FROM chart_accounts a
WHERE a.company_id = '99999999-9999-9999-9999-999999999999' AND a.code = '9.9.01'
  AND NOT EXISTS (SELECT 1 FROM journal_entry_lines l WHERE l.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM chart_accounts c2 WHERE c2.parent_id = a.id);  -- QA Analitica Smoke EDITADA
COMMIT;