-- =====================================================================================
-- ERP OPS — EXCLUIR CT-E DE SAÍDA Nº 1 — TRANSPORTES SELA LTDA
-- =====================================================================================
-- Uso:
-- 1) Rode como esta primeiro: v_dry_run = true. O script apenas mostra o que seria feito.
-- 2) Confira no NOTICE que exatamente 1 documento foi encontrado e que os totais batem
--    com o que voce espera apagar.
-- 3) Para executar de verdade, altere v_dry_run para false e rode novamente.
--
-- Alvo: fiscal_documents da empresa TRANSPORTES SELA LTDA (CNPJ 08.185.797/0001-50),
-- document_type = 'CTE', direction = 'OUT' (saida), number = '1'.
--
-- O que este script faz quando v_dry_run=false:
-- - localiza o CT-e alvo pela empresa + tipo + direcao + numero;
-- - libera o log fiscal_xml_imports (se o CT-e tiver sido importado via XML), marcando
--   como REJECTED para permitir reimportacao futura da mesma chave/hash;
-- - remove o rastro fiscal-contabil (fiscal_accounting_applications);
-- - remove linhas de apuracao tributaria vinculadas ao documento/itens/retencoes;
-- - desvincula bens patrimoniais (fixed_assets) que apontem para este documento/item;
-- - apaga o(s) lancamento(s) contabil(is) de origem FISCAL_DOCUMENT vinculados a este
--   documento, incluindo eventuais estornos na cadeia (reversal_of_id/reversed_by_entry_id);
-- - apaga o fiscal_documents; itens e retencoes caem por cascade.
--
-- SEGURANCA EXTRA (alem do padrao dry-run): se algum lancamento contabil vinculado
-- estiver POSTED, o script aborta por padrao mesmo com v_dry_run=false — apagar
-- lancamento postado quebra a numeracao oficial e o rastro de auditoria. So prossiga
-- com v_allow_posted_deletion=true se tiver certeza de que estornar (em vez de apagar)
-- nao e o caminho adequado neste caso.
--
-- IMPORTANTE: esta e uma exclusao definitiva de um documento fiscal real deste ERP. Se o
-- CT-e ja foi transmitido/autorizado na SEFAZ, o cancelamento fiscal (evento de
-- cancelamento) e feito fora deste sistema; este script so remove o registro
-- contabil/interno do ERP.
-- =====================================================================================

do $$
declare
  -- Seguranca: comece sempre com true.
  v_dry_run boolean := true;

  -- So tem efeito quando v_dry_run=false. Mantenha false a menos que tenha certeza.
  v_allow_posted_deletion boolean := false;

  v_company_cnpj text := '08185797000150';
  v_document_type text := 'CTE';
  v_direction text := 'OUT';
  v_document_number text := '1';

  v_company_id uuid;
  v_workspace_id uuid;

  v_docs_count int;
  v_items_count int;
  v_retentions_count int;
  v_applications_count int;
  v_tax_lines_count int;
  v_xml_logs_count int;
  v_assets_count int;
  v_journal_entries_count int;
  v_journal_lines_count int;
  v_posted_count int;
begin
  select c.id, c.workspace_id
    into v_company_id, v_workspace_id
  from companies c
  where regexp_replace(coalesce(c.cnpj, ''), '[^0-9]', '', 'g') = v_company_cnpj
  order by c.active desc, c.created_at desc
  limit 1;

  if v_company_id is null then
    raise exception 'Empresa TRANSPORTES SELA LTDA (CNPJ %) nao encontrada.', v_company_cnpj;
  end if;

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
    fd.document_type,
    fd.direction,
    fd.accounting_status,
    fd.journal_entry_id
  from fiscal_documents fd
  where fd.company_id = v_company_id
    and fd.document_type::text = v_document_type
    and fd.direction::text = v_direction
    and fd.number = v_document_number;

  select count(*) into v_docs_count from _target_fiscal_documents;

  if v_docs_count = 0 then
    raise notice 'Nenhum CT-e de saida numero % encontrado para esta empresa. Nada a fazer.', v_document_number;
    return;
  end if;

  if v_docs_count > 1 then
    raise exception 'Encontrados % documentos com o mesmo numero/tipo/direcao — abortando. Refine o filtro (ex.: access_key) antes de excluir.', v_docs_count;
  end if;

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
  where fxi.company_id = v_company_id
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

  select count(*) into v_posted_count
  from journal_entries je
  join _target_journal_entries t on t.id = je.id
  where je.status = 'POSTED';

  raise notice 'Empresa: % (workspace %). CT-e OUT numero % localizado (1 documento).', v_company_id, v_workspace_id, v_document_number;
  raise notice 'Itens: %, retencoes: %, aplicacoes contabeis: %, linhas de apuracao: %',
    v_items_count, v_retentions_count, v_applications_count, v_tax_lines_count;
  raise notice 'Logs XML a liberar: %, bens a desvincular: %', v_xml_logs_count, v_assets_count;
  raise notice 'Lancamentos contabeis a apagar: % (dos quais % POSTED), linhas de lancamento: %',
    v_journal_entries_count, v_posted_count, v_journal_lines_count;

  if v_dry_run then
    raise notice 'DRY RUN ativo: nenhuma alteracao foi feita. Altere v_dry_run para false para executar.';
    return;
  end if;

  if v_posted_count > 0 and not v_allow_posted_deletion then
    raise exception 'Ha % lancamento(s) POSTED vinculado(s) a este CT-e. Por seguranca, o script nao apaga lancamento postado por padrao (isso quebra a numeracao oficial). Se tiver certeza de que estornar nao e o caminho adequado aqui, defina v_allow_posted_deletion=true e rode novamente.', v_posted_count;
  end if;

  -- Libera reimportacao do mesmo XML/chave, caso o CT-e tenha vindo de importacao.
  update fiscal_xml_imports fxi
  set
    fiscal_document_id = null,
    import_status = case
      when fxi.import_status in ('CONFIRMED', 'DUPLICATE') then 'REJECTED'
      else fxi.import_status
    end,
    parse_errors = coalesce(fxi.parse_errors, '{}'::jsonb) || jsonb_build_object(
      'cleanup',
      'CT-e de saida excluido manualmente por script operacional (numero ' || v_document_number || ')'
    )
  where fxi.company_id = v_company_id
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

  raise notice 'CT-e de saida numero % excluido com sucesso.', v_document_number;
end $$;
