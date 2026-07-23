-- =====================================================================================
-- ERP OPS — APAGAR (SEM ESTORNO) LANCAMENTOS CONTABEIS DUPLICADOS DE DOCUMENTOS FISCAIS
-- =====================================================================================
-- Contexto: bug de corrida em accountFiscalDocumentAction (ja corrigido no codigo, ver
-- erp_schema_v2_7_fix_duplicate_fiscal_accounting_race.sql) gerou mais de um lancamento
-- contabil POSTED (origin='FISCAL_DOCUMENT') para o mesmo documento fiscal.
--
-- DIFERENCA em relacao a erp_ops_limpar_contabilizacoes_fiscais_duplicadas.sql /
-- erp_ops_pos_estorno_marcar_duplicata_revertida.sql: aqueles dois scripts pedem para
-- estornar pelo app (preserva numeracao oficial e rastro). ESTE SCRIPT APAGA DE VERDADE,
-- sem gerar lancamento de estorno — foi um pedido explicito, entao ele existe, mas leia o
-- aviso abaixo antes de rodar.
--
-- AVISO IMPORTANTE:
-- - O banco tem um trigger de protecao (fn_protect_journal_entry_line_delete) que bloqueia
--   apagar linha de lancamento POSTED — de proposito, para nunca deixar a numeracao oficial
--   do Diario com buraco silencioso. Este script desabilita esse trigger (e qualquer outro
--   trigger de usuario nas tabelas journal_entries/journal_entry_lines) so durante o delete
--   e reabilita logo em seguida, ainda dentro da mesma transacao.
-- - Apagar um lancamento POSTED e IRREVERSIVEL e deixa um "buraco" permanente na numeracao
--   oficial (ex.: nº 41 e 42 existiam, 42 era a duplicata; depois de apagar, so sobra 41 —
--   o proximo lancamento novo continua a partir de onde o contador estava, nao reaproveita
--   o 42). Se este Diario ja foi impresso/enviado para contador ou SPED, isso pode gerar
--   divergencia — nesse caso prefira os scripts de estorno em vez deste.
-- - Nao ha como desfazer depois de rodar com v_dry_run=false. Confira o relatorio do dry
--   run com atencao antes de mudar a flag.
--
-- Uso:
-- 1) Rode como esta primeiro: v_dry_run = true. Mostra quantos documentos/lancamentos
--    duplicados seriam apagados, e quantos ja estao POSTED.
-- 2) Para executar de verdade, altere v_dry_run para false.
-- 3) Se houver duplicata POSTED (o caso normal, ja que o bug postava direto), tambem
--    altere v_allow_posted_deletion para true — e a confirmacao explicita de que voce quer
--    apagar mesmo, ciente do buraco na numeracao.
--
-- O que este script faz quando v_dry_run=false, para cada documento fiscal com mais de uma
-- aplicacao contabil ATIVA (status='APPLIED') em fiscal_accounting_applications:
-- - mantem a aplicacao ATIVA mais antiga (created_at) e o lancamento contabil dela;
-- - aponta fiscal_documents.journal_entry_id para esse lancamento mantido e garante
--   accounting_status='ACCOUNTED';
-- - apaga de vez as demais aplicacoes 'APPLIED' (as duplicatas) e seus lancamentos
--   contabeis (linhas + cabecalho) — sem gerar nenhum lancamento de estorno.
-- =====================================================================================

do $$
declare
  -- Seguranca: comece sempre com true.
  v_dry_run boolean := true;

  -- So tem efeito quando v_dry_run=false. Confirma que voce quer apagar lancamento(s) ja
  -- POSTED, ciente do buraco permanente na numeracao oficial.
  v_allow_posted_deletion boolean := false;

  -- Opcional: restrinja a uma empresa. Se null, considera todas as empresas.
  v_company_id uuid := null;

  v_docs_affected int;
  v_applications_to_delete int;
  v_journal_entries_to_delete int;
  v_journal_lines_to_delete int;
  v_posted_to_delete int;
begin
  drop table if exists pg_temp._dup_documents;
  drop table if exists pg_temp._dup_keep_application;
  drop table if exists pg_temp._dup_remove_applications;
  drop table if exists pg_temp._dup_remove_journal_entries;

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

  -- Mantem a aplicacao ATIVA mais antiga de cada documento duplicado.
  create temp table _dup_keep_application on commit drop as
  select distinct on (faa.fiscal_document_id)
    faa.id as application_id,
    faa.fiscal_document_id,
    faa.journal_entry_id
  from fiscal_accounting_applications faa
  join _dup_documents d on d.fiscal_document_id = faa.fiscal_document_id
  where faa.status = 'APPLIED'
  order by faa.fiscal_document_id, faa.created_at asc, faa.id asc;

  create temp table _dup_remove_applications on commit drop as
  select faa.id as application_id, faa.fiscal_document_id, faa.journal_entry_id
  from fiscal_accounting_applications faa
  join _dup_documents d on d.fiscal_document_id = faa.fiscal_document_id
  where faa.status = 'APPLIED'
    and faa.id not in (select application_id from _dup_keep_application);

  create temp table _dup_remove_journal_entries on commit drop as
  select distinct journal_entry_id as id
  from _dup_remove_applications
  where journal_entry_id is not null;

  select count(*) into v_applications_to_delete from _dup_remove_applications;
  select count(*) into v_journal_entries_to_delete from _dup_remove_journal_entries;

  select count(*) into v_journal_lines_to_delete
  from journal_entry_lines jel
  join _dup_remove_journal_entries t on t.id = jel.journal_entry_id;

  select count(*) into v_posted_to_delete
  from journal_entries je
  join _dup_remove_journal_entries t on t.id = je.id
  where je.status = 'POSTED';

  raise notice 'Documentos fiscais com contabilizacao duplicada: %', v_docs_affected;
  raise notice 'Aplicacoes contabeis a apagar: %, lancamentos a apagar: % (dos quais % POSTED), linhas de lancamento: %',
    v_applications_to_delete, v_journal_entries_to_delete, v_posted_to_delete, v_journal_lines_to_delete;

  if v_dry_run then
    raise notice 'DRY RUN ativo: nenhuma alteracao foi feita. Confira os numeros acima e altere v_dry_run para false para executar.';
    return;
  end if;

  if v_posted_to_delete > 0 and not v_allow_posted_deletion then
    raise exception 'Ha % lancamento(s) duplicado(s) ja POSTED. Isso vai apagar de vez (sem estorno), deixando um buraco permanente na numeracao oficial. Defina v_allow_posted_deletion=true para confirmar.', v_posted_to_delete;
  end if;

  -- Aponta o documento para o lancamento que vai sobreviver antes de apagar os demais.
  update fiscal_documents fd
  set journal_entry_id = k.journal_entry_id,
      accounting_status = 'ACCOUNTED'
  from _dup_keep_application k
  where fd.id = k.fiscal_document_id;

  -- Bypassa o trigger de protecao contra delete de lancamento POSTED so para este delete
  -- pontual (fn_protect_journal_entry_line_delete e qualquer outro trigger de usuario
  -- nestas duas tabelas) — reabilita logo em seguida, ainda dentro da mesma transacao. Se
  -- algo falhar entre o disable e o enable, a transacao inteira roda de volta (rollback),
  -- entao o trigger nunca fica desabilitado fora deste bloco.
  alter table journal_entry_lines disable trigger user;
  alter table journal_entries disable trigger user;

  delete from journal_entry_lines jel
  using _dup_remove_journal_entries t
  where jel.journal_entry_id = t.id;

  update journal_entries je
  set reversal_of_id = null
  where je.reversal_of_id in (select id from _dup_remove_journal_entries);

  update journal_entries je
  set reversed_by_entry_id = null
  where je.reversed_by_entry_id in (select id from _dup_remove_journal_entries);

  delete from journal_entries je
  using _dup_remove_journal_entries t
  where je.id = t.id;

  alter table journal_entries enable trigger user;
  alter table journal_entry_lines enable trigger user;

  delete from fiscal_accounting_applications faa
  using _dup_remove_applications t
  where faa.id = t.application_id;

  raise notice 'Apagado de vez (sem estorno). % documento(s) normalizado(s) para 1 lancamento cada. % aplicacao(oes) e % lancamento(s) duplicados removidos permanentemente.',
    v_docs_affected, v_applications_to_delete, v_journal_entries_to_delete;
end $$;
