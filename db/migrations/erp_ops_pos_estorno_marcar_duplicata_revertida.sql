-- =====================================================================================
-- ERP OPS — REGISTRAR ESTORNO DE DUPLICATA FISCAL EM fiscal_accounting_applications
-- =====================================================================================
-- Contexto: erp_ops_limpar_contabilizacoes_fiscais_duplicadas.sql relatou lancamento(s)
-- duplicado(s) POSTED que precisam ser estornados pelo app (Contabilidade > Lancamentos >
-- Estornar), porque reverse_journal_entry() depende de auth.uid() para numerar o estorno e
-- por isso nao deve ser chamado direto no SQL editor.
--
-- O estorno feito pelo app (reverseJournalEntryAction, fluxo generico de Lancamentos) cria
-- corretamente o lancamento de estorno, mas NAO sabe que aquele lancamento tambem estava
-- registrado em fiscal_accounting_applications (essa tabela so e atualizada pelo fluxo
-- especifico de estorno fiscal, reverseFiscalDocumentAccountingAction, que so opera sobre o
-- lancamento atualmente vinculado a fiscal_documents.journal_entry_id — nao sobre uma
-- duplicata orfa). Este script fecha essa lacuna manualmente, um estorno por vez.
--
-- Uso: preencha v_old_journal_entry_id (o id do lancamento duplicado que voce acabou de
-- estornar pelo app — pegue em Contabilidade > Lancamentos) e
-- v_reversal_journal_entry_number (o numero do lancamento de estorno que o app mostrou na
-- mensagem de sucesso, ex.: "Lancamento estornado com sucesso! Criado lancamento de
-- estorno no XX"). Rode com v_dry_run=true primeiro para conferir, depois false.
-- =====================================================================================

do $$
declare
  v_dry_run boolean := true;

  v_old_journal_entry_id uuid := '00000000-0000-0000-0000-000000000000'; -- <-- preencha
  v_reversal_journal_entry_number bigint := 0; -- <-- preencha (numero mostrado pelo app)

  v_company_id uuid;
  v_reversal_journal_entry_id uuid;
  v_application_id uuid;
begin
  select company_id into v_company_id from journal_entries where id = v_old_journal_entry_id;
  if v_company_id is null then
    raise exception 'Lancamento % nao encontrado (confira v_old_journal_entry_id).', v_old_journal_entry_id;
  end if;

  select id into v_reversal_journal_entry_id
  from journal_entries
  where company_id = v_company_id
    and number = v_reversal_journal_entry_number;

  if v_reversal_journal_entry_id is null then
    raise exception 'Lancamento de estorno numero % nao encontrado nesta empresa (confira v_reversal_journal_entry_number).', v_reversal_journal_entry_number;
  end if;

  select id into v_application_id
  from fiscal_accounting_applications
  where journal_entry_id = v_old_journal_entry_id
    and status = 'APPLIED';

  if v_application_id is null then
    raise exception 'Nenhuma aplicacao contabil ATIVA (status=APPLIED) encontrada para o lancamento %. Ja foi registrada antes?', v_old_journal_entry_id;
  end if;

  raise notice 'Aplicacao % (lancamento %) sera marcada REVERSED, vinculada ao estorno numero % (id %).',
    v_application_id, v_old_journal_entry_id, v_reversal_journal_entry_number, v_reversal_journal_entry_id;

  if v_dry_run then
    raise notice 'DRY RUN ativo: nenhuma alteracao foi feita. Altere v_dry_run para false para gravar.';
    return;
  end if;

  update fiscal_accounting_applications
  set status = 'REVERSED',
      reversed_at = now(),
      reversal_journal_entry_id = v_reversal_journal_entry_id
  where id = v_application_id;

  raise notice 'Registrado. Se este era o ultimo duplicado pendente deste documento, ja pode aplicar erp_schema_v2_7_fix_duplicate_fiscal_accounting_race.sql.';
end $$;
