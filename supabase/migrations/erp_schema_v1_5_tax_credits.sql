-- =====================================================================================
-- ERP CONTÁBIL — SCHEMA — v1.5 — CRÉDITOS TRIBUTÁRIOS, SALDOS E AJUSTES EM APURAÇÕES
-- Etapa 24. Migração incremental sobre v1.4. Trata o achado B1 de
-- docs/audit-fiscal-tax-assets.md: tax_assessments.credit_amount era lido pela fórmula de
-- payable_amount mas não tinha caminho de aplicação para gravá-lo de forma auditável.
-- =====================================================================================
--
-- AUDITORIA DE SCHEMA ANTES DE CRIAR COLUNA NOVA (conforme pedido desta etapa): todas as
-- colunas "essenciais" listadas no pedido já existem desde a v1.4 —
-- tax_assessments.{debit_amount, credit_amount, retained_amount, adjustment_amount,
-- fine_amount, interest_amount, payable_amount, previous_balance_amount,
-- next_balance_amount, status} e tax_assessment_lines.{line_type, source_type, source_id,
-- base_amount, tax_rate, description}. O CHECK de tax_assessment_lines.line_type já inclui
-- 'ADJUSTMENT_POSITIVE'/'ADJUSTMENT_NEGATIVE'/'CREDIT'/'DEBIT'/'RETENTION'/'BALANCE', e o de
-- source_type já inclui 'MANUAL_ADJUSTMENT'/'PREVIOUS_BALANCE' — nenhum enum/CHECK precisa
-- mudar. Não foi criada nenhuma tabela nova (tax_assessment_lines já comporta o modelo,
-- como o pedido desta etapa pedia para preferir).
--
-- ÚNICA coluna nova: tax_assessment_lines.notes — "observação opcional" (distinta da
-- "descrição obrigatória") pedida para linhas manuais. Segue o mesmo precedente já usado em
-- fiscal_document_items.notes (v1.4, Bloco 4): tabelas-filha deste schema já misturam
-- description (obrigatório) + notes (opcional) quando o domínio pede os dois.
--
-- NÃO adicionado (decisão consciente, documentada): "manual_line" flag — redundante, já
-- discriminável via source_type = 'MANUAL_ADJUSTMENT' (nenhum processo automático grava
-- esse valor, então filtrar por ele já identifica linhas manuais sem coluna extra).
-- "created_by"/"updated_at" em tax_assessment_lines — o padrão real deste schema para
-- tabelas *_lines/*_items (journal_entry_lines, fiscal_document_items) é NÃO ter esses
-- campos (só tabelas de cabeçalho como tax_assessments têm); adicionar aqui quebraria essa
-- convenção sem necessidade funcional concreta pedida nesta etapa.
-- =====================================================================================

alter table tax_assessment_lines add column if not exists notes text;

comment on column tax_assessment_lines.notes is 'Observação opcional de linha manual (Etapa 24) — distinta de "description", que é obrigatória. Nulo para linhas automáticas.';

-- =====================================================================================
-- RLS: nenhuma policy nova necessária. tax_assessment_lines já tem RLS completa desde
-- erp_rls_v1.sql (SELECT via can_read_company, INSERT/UPDATE/DELETE via can_write_company,
-- todas através do vínculo com tax_assessments/company_id da própria linha) — adicionar uma
-- coluna a uma tabela existente não exige nova policy, RLS do Postgres se aplica à LINHA
-- inteira, não por coluna (mesmo raciocínio já documentado em erp_rls_v1_4). Por isso não
-- existe um erp_rls_v1_5_tax_credits.sql.
-- =====================================================================================

-- =====================================================================================
-- CORREÇÃO DE FÓRMULA (não é mudança de schema, documentada aqui por estar no mesmo commit
-- lógico): a fórmula de payable_amount usada por calculateTaxAssessmentAction ATÉ a Etapa
-- 22 somava previous_balance_amount ao valor a recolher — o que está ERRADO: um saldo
-- credor do período anterior deve REDUZIR o valor a recolher deste período, não aumentá-lo.
-- A partir desta etapa a fórmula (aplicada só em código TypeScript, sem impacto de schema)
-- passa a ser:
--   gross_balance = debit_amount - credit_amount - retained_amount - previous_balance_amount
--                   + adjustment_amount + fine_amount + interest_amount
--   payable_amount = max(0, gross_balance)
--   next_balance_amount = gross_balance < 0 ? abs(gross_balance) : 0
-- Ver src/modules/tax-assessments/actions.ts (recomputeAssessmentTotals) e
-- docs/tax-assessment-credits.md para o detalhamento completo.
-- =====================================================================================
