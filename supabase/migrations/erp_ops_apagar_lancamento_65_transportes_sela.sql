-- =====================================================================================
-- ERP OPS — APAGAR (SEM ESTORNO) O LANCAMENTO CONTABIL Nº 65 — TRANSPORTES SELA LTDA
-- =====================================================================================
-- Alvo: journal_entries da empresa TRANSPORTES SELA LTDA (CNPJ 08.185.797/0001-50) com
-- number = 65.
--
-- AVISO IMPORTANTE (mesmo aviso de erp_ops_apagar_lancamentos_fiscais_duplicados.sql):
-- - Bypassa o trigger de protecao (fn_protect_journal_entry_line_delete) que bloqueia
--   apagar linha de lancamento POSTED — desabilita so durante o delete e reabilita logo em
--   seguida, na mesma transacao.
-- - E IRREVERSIVEL e deixa buraco permanente na numeracao oficial do Diario se o
--   lancamento ja estava POSTED.
-- - Se o documento fiscal que gerou este lancamento (origin='FISCAL_DOCUMENT') estiver
--   apontando fiscal_documents.journal_entry_id para o nº 65, o script repõe esse ponteiro
--   para outra aplicacao contabil ATIVA do mesmo documento se existir uma sobrando (caso de
--   duplicata), ou devolve o documento para NOT_ACCOUNTED se nao houver outra — nunca deixa
--   o documento apontando para um lancamento que nao existe mais.
--
-- Uso:
-- 1) Rode como esta primeiro: v_dry_run = true. Mostra os dados completos do lancamento
--    (linhas, contas, documento fiscal vinculado) para voce confirmar que e o certo.
-- 2) Para apagar de verdade, altere v_dry_run para false e, se o relatorio indicar que o
--    lancamento esta POSTED, tambem altere v_allow_posted_deletion para true.
-- =====================================================================================

do $$
declare
  -- Seguranca: comece sempre com true.
  v_dry_run boolean := true;

  -- So tem efeito quando v_dry_run=false. Confirma que voce quer apagar lancamento ja
  -- POSTED, ciente do buraco permanente na numeracao oficial.
  v_allow_posted_deletion boolean := false;

  v_company_cnpj text := '08185797000150';
  v_journal_entry_number bigint := 65;

  v_company_id uuid;
  v_workspace_id uuid;
  v_entry_id uuid;
  v_entry_status text;
  v_entry_origin text;
  v_entry_origin_id uuid;
  v_entry_document text;
  v_entry_description text;
  v_fiscal_document_id uuid;
  v_fiscal_document_number text;
  v_fiscal_document_points_here boolean := false;
  v_replacement_journal_entry_id uuid;
  v_row record;
begin
  select c.id, c.workspace_id
    into v_company_id, v_workspace_id
  from companies c
  where regexp_replace(coalesce(c.cnpj, ''), '[^0-9]', '', 'g') = v_company_cnpj
  order by c.active desc, c.created_at desc
  limit 1;

  if v_company_id is null then
    raise exception 'Empresa com CNPJ % nao encontrada.', v_company_cnpj;
  end if;

  select je.id, je.status::text, je.origin::text, je.origin_id, je.document, je.description
    into v_entry_id, v_entry_status, v_entry_origin, v_entry_origin_id, v_entry_document, v_entry_description
  from journal_entries je
  where je.company_id = v_company_id
    and je.number = v_journal_entry_number;

  if v_entry_id is null then
    raise notice 'Lancamento numero % nao encontrado para esta empresa. Nada a fazer (ja foi apagado antes?).', v_journal_entry_number;
    return;
  end if;

  raise notice '=== Lancamento nº % — id=%, status=%, origin=%, documento="%", descricao="%" ===',
    v_journal_entry_number, v_entry_id, v_entry_status, v_entry_origin, v_entry_document, v_entry_description;

  for v_row in
    select jel.debit_credit::text, jel.amount, jel.memo, ca.code, ca.name
    from journal_entry_lines jel
    join chart_accounts ca on ca.id = jel.account_id
    where jel.journal_entry_id = v_entry_id
    order by jel.debit_credit desc
  loop
    raise notice '  % % — % (%) — %', v_row.debit_credit, v_row.amount, v_row.code, v_row.name, v_row.memo;
  end loop;

  if v_entry_origin = 'FISCAL_DOCUMENT' and v_entry_origin_id is not null then
    select fd.id, fd.number, (fd.journal_entry_id = v_entry_id)
      into v_fiscal_document_id, v_fiscal_document_number, v_fiscal_document_points_here
    from fiscal_documents fd
    where fd.id = v_entry_origin_id;

    if v_fiscal_document_id is not null then
      raise notice 'Documento fiscal vinculado: nº % (id=%). fiscal_documents.journal_entry_id aponta para este lancamento: %',
        v_fiscal_document_number, v_fiscal_document_id, v_fiscal_document_points_here;
    end if;
  end if;

  if v_dry_run then
    raise notice 'DRY RUN ativo: nenhuma alteracao foi feita. Confira os dados acima e altere v_dry_run para false para apagar.';
    return;
  end if;

  if v_entry_status = 'POSTED' and not v_allow_posted_deletion then
    raise exception 'Lancamento nº % esta POSTED. Apagar de vez (sem estorno) deixa buraco permanente na numeracao oficial. Defina v_allow_posted_deletion=true para confirmar.', v_journal_entry_number;
  end if;

  if v_fiscal_document_points_here then
    -- Procura outra aplicacao contabil ATIVA do mesmo documento (caso de duplicata) para
    -- repor o vinculo; se nao houver, o documento volta para NOT_ACCOUNTED.
    select faa.journal_entry_id
      into v_replacement_journal_entry_id
    from fiscal_accounting_applications faa
    where faa.fiscal_document_id = v_fiscal_document_id
      and faa.status = 'APPLIED'
      and faa.journal_entry_id <> v_entry_id
    order by faa.created_at asc
    limit 1;

    if v_replacement_journal_entry_id is not null then
      update fiscal_documents
      set journal_entry_id = v_replacement_journal_entry_id,
          accounting_status = 'ACCOUNTED'
      where id = v_fiscal_document_id;

      raise notice 'Documento fiscal nº % repontado para o lancamento %.', v_fiscal_document_number, v_replacement_journal_entry_id;
    else
      update fiscal_documents
      set journal_entry_id = null,
          accounting_status = 'NOT_ACCOUNTED'
      where id = v_fiscal_document_id;

      raise notice 'Documento fiscal nº % devolvido para NOT_ACCOUNTED (nao havia outro lancamento ativo).', v_fiscal_document_number;
    end if;
  end if;

  delete from fiscal_accounting_applications
  where journal_entry_id = v_entry_id;

  -- Bypassa o trigger de protecao contra delete de lancamento POSTED so para este delete
  -- pontual — reabilita logo em seguida, ainda dentro da mesma transacao.
  alter table journal_entry_lines disable trigger user;
  alter table journal_entries disable trigger user;

  delete from journal_entry_lines where journal_entry_id = v_entry_id;

  update journal_entries set reversal_of_id = null where reversal_of_id = v_entry_id;
  update journal_entries set reversed_by_entry_id = null where reversed_by_entry_id = v_entry_id;

  delete from journal_entries where id = v_entry_id;

  alter table journal_entries enable trigger user;
  alter table journal_entry_lines enable trigger user;

  raise notice 'Lancamento nº % apagado de vez (sem estorno).', v_journal_entry_number;
end $$;
