-- =====================================================================================
-- ERP OPS — DIAGNOSTICO + LIMPEZA DE CONTABILIZACOES FISCAIS DUPLICADAS (BUG DE CORRIDA)
-- =====================================================================================
-- Contexto: accountFiscalDocumentAction fazia um SELECT de fiscal_documents.accounting_status
-- e so bem depois gravava 'ACCOUNTED', sem trava no banco entre a leitura e a escrita. Duas
-- chamadas quase simultaneas (duplo clique, contabilizacao em lote rodando junto com a
-- individual, retry de rede) passavam as duas pela checagem antes que qualquer uma
-- gravasse, gerando mais de um lancamento contabil POSTED (origin='FISCAL_DOCUMENT') e mais
-- de uma linha 'APPLIED' em fiscal_accounting_applications para o mesmo documento fiscal.
--
-- IMPORTANTE (mudou em relacao a versao anterior deste script): o banco tem um trigger
-- (fn_protect_journal_entry_line_delete) que bloqueia apagar linhas de lancamento POSTED —
-- de proposito, para nunca deixar um "buraco" silencioso na numeracao oficial. Como o bug
-- posta o lancamento na hora (nao fica em DRAFT), na pratica toda duplicata real vai estar
-- POSTED. Por isso este script NAO tenta apagar lancamento POSTED — ele so:
--   (a) apaga automaticamente duplicatas que porventura estejam em DRAFT (seguro, sem
--       trigger no caminho);
--   (b) para duplicatas POSTED, apenas relata qual manter e qual estornar — o estorno em
--       si deve ser feito PELO APP (Contabilidade > Lancamentos, botao "Estornar"), porque
--       reverse_journal_entry() numera o lancamento de estorno via next_journal_number(),
--       que depende de auth.uid() — rodando direto no SQL editor (sem sessao autenticada)
--       isso tende a travar, igual ja aconteceu com next_journal_number() no script de
--       apropriacao de folha.
--
-- Depois de estornar pelo app, rode erp_ops_pos_estorno_marcar_duplicata_revertida.sql para
-- registrar o estorno em fiscal_accounting_applications (o estorno generico de Lancamentos
-- nao sabe que a linha em fiscal_accounting_applications existe). So depois disso o indice
-- unico de erp_schema_v2_7_fix_duplicate_fiscal_accounting_race.sql consegue ser criado.
--
-- Uso:
-- 1) Rode como esta primeiro: v_dry_run = true. Mostra o relatorio e o que seria apagado.
-- 2) Para apagar de verdade as duplicatas em DRAFT (se houver), altere v_dry_run para false.
-- 3) Para cada duplicata POSTED reportada, va em Contabilidade > Lancamentos, localize o
--    lancamento pelo numero informado no relatorio como "ESTORNAR" e clique em Estornar.
-- 4) Rode erp_ops_pos_estorno_marcar_duplicata_revertida.sql para cada estorno feito no
--    passo 3.
-- 5) So depois aplique erp_schema_v2_7_fix_duplicate_fiscal_accounting_race.sql.
-- =====================================================================================

do $$
declare
  v_dry_run boolean := true;

  -- Opcional: restrinja a uma empresa. Se null, considera todas as empresas.
  v_company_id uuid := null;

  v_docs_affected int;
  v_draft_applications_to_delete int;
  v_draft_journal_entries_to_delete int;
  v_posted_pending int;
  v_row record;
begin
  drop table if exists pg_temp._dup_documents;
  drop table if exists pg_temp._dup_report;
  drop table if exists pg_temp._dup_remove_draft_applications;
  drop table if exists pg_temp._dup_remove_draft_journal_entries;

  create temp table _dup_documents on commit drop as
  select fiscal_document_id, count(*) as applied_count
  from fiscal_accounting_applications
  where status = 'APPLIED'
    and (v_company_id is null or company_id = v_company_id)
  group by fiscal_document_id
  having count(*) > 1;

  select count(*) into v_docs_affected from _dup_documents;

  if v_docs_affected = 0 then
    raise notice 'Nenhum documento fiscal com contabilizacao duplicada encontrado. Nada a fazer.';
    return;
  end if;

  -- Mantem sempre a aplicacao cujo lancamento e o que fiscal_documents.journal_entry_id ja
  -- aponta (evita ter que tocar em fiscal_documents); as demais sao candidatas a remover
  -- (se DRAFT) ou estornar manualmente (se POSTED).
  create temp table _dup_report on commit drop as
  select
    fd.id as fiscal_document_id,
    fd.number as document_number,
    faa.id as application_id,
    faa.journal_entry_id,
    je.number as journal_entry_number,
    je.status as journal_entry_status,
    case when fd.journal_entry_id = faa.journal_entry_id then 'MANTER' else 'REMOVER' end as recomendacao
  from fiscal_accounting_applications faa
  join fiscal_documents fd on fd.id = faa.fiscal_document_id
  join journal_entries je on je.id = faa.journal_entry_id
  join _dup_documents d on d.fiscal_document_id = faa.fiscal_document_id
  where faa.status = 'APPLIED';

  raise notice '=== Documentos fiscais com contabilizacao duplicada: % ===', v_docs_affected;

  for v_row in select * from _dup_report order by document_number, recomendacao loop
    raise notice 'Documento % (fiscal_document_id=%): lancamento numero % (status=%) — %',
      v_row.document_number, v_row.fiscal_document_id, v_row.journal_entry_number, v_row.journal_entry_status, v_row.recomendacao;
  end loop;

  create temp table _dup_remove_draft_applications on commit drop as
  select application_id, fiscal_document_id, journal_entry_id
  from _dup_report
  where recomendacao = 'REMOVER' and journal_entry_status = 'DRAFT';

  create temp table _dup_remove_draft_journal_entries on commit drop as
  select distinct journal_entry_id as id
  from _dup_remove_draft_applications;

  select count(*) into v_draft_applications_to_delete from _dup_remove_draft_applications;
  select count(*) into v_draft_journal_entries_to_delete from _dup_remove_draft_journal_entries;

  select count(*) into v_posted_pending
  from _dup_report
  where recomendacao = 'REMOVER' and journal_entry_status = 'POSTED';

  raise notice 'Duplicatas em DRAFT (podem ser apagadas por este script): %', v_draft_applications_to_delete;
  raise notice 'Duplicatas em POSTED (precisam ser estornadas pelo app — ver relatorio acima): %', v_posted_pending;

  if v_dry_run then
    raise notice 'DRY RUN ativo: nenhuma alteracao foi feita. Altere v_dry_run para false para apagar as duplicatas em DRAFT (se houver).';
    return;
  end if;

  if v_draft_applications_to_delete = 0 then
    raise notice 'Nao ha duplicatas em DRAFT para apagar automaticamente. Estorne as POSTED listadas acima pelo app e depois rode erp_ops_pos_estorno_marcar_duplicata_revertida.sql.';
    return;
  end if;

  delete from journal_entry_lines jel
  using _dup_remove_draft_journal_entries t
  where jel.journal_entry_id = t.id;

  delete from journal_entries je
  using _dup_remove_draft_journal_entries t
  where je.id = t.id;

  delete from fiscal_accounting_applications faa
  using _dup_remove_draft_applications t
  where faa.id = t.application_id;

  raise notice 'Duplicatas em DRAFT removidas: % aplicacao(oes), % lancamento(s). Duplicatas POSTED ainda pendentes de estorno pelo app: %.',
    v_draft_applications_to_delete, v_draft_journal_entries_to_delete, v_posted_pending;
end $$;
