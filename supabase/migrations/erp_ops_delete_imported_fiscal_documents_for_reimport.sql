-- =====================================================================================
-- ERP OPS — LIMPAR DOCUMENTOS FISCAIS IMPORTADOS VIA XML PARA TESTE DE REIMPORTACAO
-- =====================================================================================
-- Uso:
-- 1) Rode como esta primeiro: v_dry_run = true. O script apenas mostra quantos registros
--    seriam afetados.
-- 2) Confira os filtros no bloco DECLARE.
-- 3) Para executar de verdade, altere v_dry_run para false e rode novamente.
--
-- O que este script faz quando v_dry_run=false:
-- - seleciona fiscal_documents com source = 'XML' conforme filtros;
-- - libera os logs fiscal_xml_imports CONFIRMED/DUPLICATE para permitir reimportar o
--   mesmo XML/chave de acesso;
-- - remove o rastro fiscal-contabil das notas alvo;
-- - remove linhas de apuracao vinculadas a essas notas/itens/retencoes;
-- - desvincula bens patrimoniais que apontem para essas notas;
-- - apaga lancamentos contabeis de origem FISCAL_DOCUMENT vinculados as notas alvo;
-- - apaga fiscal_documents; itens e retencoes caem por cascade.
--
-- IMPORTANTE: script operacional para ambiente de teste/homologacao. Em producao, notas
-- fiscais e lancamentos postados normalmente devem ser estornados/cancelados, nao apagados.
-- =====================================================================================

do $$
declare
  -- Segurança: comece sempre com true.
  v_dry_run boolean := true;

  -- Opcional: restrinja a empresa. Se null, considera todas as empresas acessiveis.
  v_company_id uuid := null;

  -- Opcional: restrinja por competencia do documento fiscal.
  v_competence_from date := null; -- exemplo: '2026-07-01'
  v_competence_to date := null;   -- exemplo: '2026-07-31'

  -- Opcional: restrinja por chave de acesso ou numero. Deixe null para todas.
  v_access_keys text[] := null;
  v_document_numbers text[] := null;

  v_docs_count int;
  v_items_count int;
  v_retentions_count int;
  v_applications_count int;
  v_tax_lines_count int;
  v_xml_logs_count int;
  v_assets_count int;
  v_journal_entries_count int;
  v_journal_lines_count int;
begin
  drop table if exists pg_temp._target_fiscal_documents;
  drop table if exists pg_temp._target_fiscal_document_items;
  drop table if exists pg_temp._target_fiscal_document_retentions;
  drop table if exists pg_temp._target_journal_entries;

  create temp table _target_fiscal_documents on commit drop as
  select
    fd.id,
    fd.company_id,
    fd.access_key,
    fd.import_hash,
    fd.number,
    fd.journal_entry_id
  from fiscal_documents fd
  where fd.source::text = 'XML'
    and (v_company_id is null or fd.company_id = v_company_id)
    and (v_competence_from is null or fd.competence >= date_trunc('month', v_competence_from)::date)
    and (v_competence_to is null or fd.competence <= date_trunc('month', v_competence_to)::date)
    and (v_access_keys is null or fd.access_key = any(v_access_keys))
    and (v_document_numbers is null or fd.number = any(v_document_numbers));

  create temp table _target_fiscal_document_items on commit drop as
  select fdi.id
  from fiscal_document_items fdi
  join _target_fiscal_documents t on t.id = fdi.fiscal_document_id;

  create temp table _target_fiscal_document_retentions on commit drop as
  select fdr.id
  from fiscal_document_retentions fdr
  join _target_fiscal_documents t on t.id = fdr.fiscal_document_id;

  create temp table _target_journal_entries on commit drop as
  with recursive seed as (
    select journal_entry_id as id
    from _target_fiscal_documents
    where journal_entry_id is not null

    union

    select je.id
    from journal_entries je
    join _target_fiscal_documents t on t.id = je.origin_id
    where je.origin::text = 'FISCAL_DOCUMENT'
  ),
  related as (
    select id from seed where id is not null

    union

    select je.id
    from journal_entries je
    join related r
      on je.reversal_of_id = r.id
      or je.reversed_by_entry_id = r.id
      or (je.origin::text = 'REVERSAL' and je.origin_id = r.id)
  )
  select distinct id
  from related
  where id is not null;

  select count(*) into v_docs_count from _target_fiscal_documents;
  select count(*) into v_items_count from _target_fiscal_document_items;
  select count(*) into v_retentions_count from _target_fiscal_document_retentions;

  select count(*) into v_applications_count
  from fiscal_accounting_applications faa
  join _target_fiscal_documents t on t.id = faa.fiscal_document_id;

  select count(*) into v_tax_lines_count
  from tax_assessment_lines tal
  where tal.fiscal_document_id in (select id from _target_fiscal_documents)
     or (tal.source_type = 'FISCAL_DOCUMENT' and tal.source_id in (select id from _target_fiscal_documents))
     or (tal.source_type = 'FISCAL_ITEM' and tal.source_id in (select id from _target_fiscal_document_items))
     or (tal.source_type = 'RETENTION' and tal.source_id in (select id from _target_fiscal_document_retentions));

  select count(*) into v_xml_logs_count
  from fiscal_xml_imports fxi
  where fxi.company_id in (select distinct company_id from _target_fiscal_documents)
    and (
      fxi.fiscal_document_id in (select id from _target_fiscal_documents)
      or (fxi.access_key is not null and fxi.access_key in (select access_key from _target_fiscal_documents where access_key is not null))
      or (fxi.import_hash is not null and fxi.import_hash in (select import_hash from _target_fiscal_documents where import_hash is not null))
    )
    and fxi.import_status in ('CONFIRMED', 'DUPLICATE');

  select count(*) into v_assets_count
  from fixed_assets fa
  where fa.fiscal_document_id in (select id from _target_fiscal_documents)
     or fa.fiscal_document_item_id in (select id from _target_fiscal_document_items);

  select count(*) into v_journal_entries_count from _target_journal_entries;

  select count(*) into v_journal_lines_count
  from journal_entry_lines jel
  join _target_journal_entries t on t.id = jel.journal_entry_id;

  raise notice 'Documentos fiscais XML alvo: %', v_docs_count;
  raise notice 'Itens: %, retencoes: %, aplicacoes contabeis: %, linhas de apuracao: %',
    v_items_count, v_retentions_count, v_applications_count, v_tax_lines_count;
  raise notice 'Logs XML a liberar: %, bens a desvincular: %', v_xml_logs_count, v_assets_count;
  raise notice 'Lancamentos contabeis a apagar: %, linhas de lancamento: %',
    v_journal_entries_count, v_journal_lines_count;

  if v_docs_count = 0 then
    raise notice 'Nenhum documento encontrado pelos filtros. Nada a fazer.';
    return;
  end if;

  if v_dry_run then
    raise notice 'DRY RUN ativo: nenhuma alteracao foi feita. Altere v_dry_run para false para executar.';
    return;
  end if;

  -- Libera reimportacao do mesmo XML/chave, preservando a trilha como rejeitada.
  update fiscal_xml_imports fxi
  set
    fiscal_document_id = null,
    import_status = case
      when fxi.import_status in ('CONFIRMED', 'DUPLICATE') then 'REJECTED'
      else fxi.import_status
    end,
    parse_errors = coalesce(fxi.parse_errors, '{}'::jsonb) || jsonb_build_object(
      'cleanup',
      'Documento fiscal removido por script operacional para teste de reimportacao'
    )
  where fxi.company_id in (select distinct company_id from _target_fiscal_documents)
    and (
      fxi.fiscal_document_id in (select id from _target_fiscal_documents)
      or (fxi.access_key is not null and fxi.access_key in (select access_key from _target_fiscal_documents where access_key is not null))
      or (fxi.import_hash is not null and fxi.import_hash in (select import_hash from _target_fiscal_documents where import_hash is not null))
    )
    and fxi.import_status in ('CONFIRMED', 'DUPLICATE');

  delete from fiscal_accounting_applications faa
  using _target_fiscal_documents t
  where faa.fiscal_document_id = t.id;

  delete from tax_assessment_lines tal
  where tal.fiscal_document_id in (select id from _target_fiscal_documents)
     or (tal.source_type = 'FISCAL_DOCUMENT' and tal.source_id in (select id from _target_fiscal_documents))
     or (tal.source_type = 'FISCAL_ITEM' and tal.source_id in (select id from _target_fiscal_document_items))
     or (tal.source_type = 'RETENTION' and tal.source_id in (select id from _target_fiscal_document_retentions));

  update fixed_assets fa
  set
    fiscal_document_id = case
      when fa.fiscal_document_id in (select id from _target_fiscal_documents) then null
      else fa.fiscal_document_id
    end,
    fiscal_document_item_id = case
      when fa.fiscal_document_item_id in (select id from _target_fiscal_document_items) then null
      else fa.fiscal_document_item_id
    end
  where fa.fiscal_document_id in (select id from _target_fiscal_documents)
     or fa.fiscal_document_item_id in (select id from _target_fiscal_document_items);

  update fiscal_documents fd
  set journal_entry_id = null,
      accounting_status = 'NOT_ACCOUNTED'
  where fd.id in (select id from _target_fiscal_documents);

  update journal_entries je
  set reversal_of_id = null
  where je.reversal_of_id in (select id from _target_journal_entries);

  update journal_entries je
  set reversed_by_entry_id = null
  where je.reversed_by_entry_id in (select id from _target_journal_entries);

  delete from journal_entries je
  using _target_journal_entries t
  where je.id = t.id;

  delete from fiscal_documents fd
  using _target_fiscal_documents t
  where fd.id = t.id;

  raise notice 'Limpeza concluida. Documentos removidos: %. Agora voce pode importar os XMLs novamente.', v_docs_count;
end $$;
