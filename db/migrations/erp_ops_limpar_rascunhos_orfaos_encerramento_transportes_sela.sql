-- =====================================================================================
-- ERP OPS — LIMPAR RASCUNHOS ORFAOS DE ENCERRAMENTO DE RESULTADO — TRANSPORTES SELA LTDA
-- =====================================================================================
-- Contexto: closeIncomeStatementAction cria o cabecalho do lancamento de encerramento em
-- DRAFT e SO DEPOIS insere as linhas de zeramento; se o insert das linhas falhar, o codigo
-- tenta apagar o cabecalho (rollback manual) mas nao confere se esse delete deu certo. Isso
-- deixou 2 cabecalhos orfaos (origin='RESULT_CLOSING', R$ 0,00, sem nenhuma linha) nas
-- competencias 04/2025 e 05/2025 — e cada um bloqueia o encerramento daquela competencia
-- especifica (getClosingStatus.hasDrafts e por competencia).
--
-- Uso:
-- 1) Rode como esta primeiro: v_dry_run = true. Mostra quais cabecalhos orfaos seriam
--    apagados.
-- 2) Para apagar de verdade, altere v_dry_run para false e rode novamente.
--
-- Seguro: sao lancamentos DRAFT (nunca postados, sem numero oficial) e sem nenhuma linha —
-- nao ha trigger de protecao envolvido (esse so bloqueia lancamento POSTED) e nao ha
-- nenhuma movimentacao contabil real associada a eles.
-- =====================================================================================

do $$
declare
  v_dry_run boolean := true;
  v_company_cnpj text := '08185797000150';

  v_company_id uuid;
  v_count int;
  v_row record;
begin
  select id into v_company_id
  from companies
  where regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g') = v_company_cnpj
  order by active desc, created_at desc
  limit 1;

  if v_company_id is null then
    raise exception 'Empresa com CNPJ % nao encontrada.', v_company_cnpj;
  end if;

  drop table if exists pg_temp._orphan_closing_drafts;
  create temp table _orphan_closing_drafts on commit drop as
  select je.id, je.competence, je.entry_date, je.description
  from journal_entries je
  where je.company_id = v_company_id
    and je.status = 'DRAFT'
    and je.origin = 'RESULT_CLOSING'
    and not exists (select 1 from journal_entry_lines jel where jel.journal_entry_id = je.id);

  select count(*) into v_count from _orphan_closing_drafts;

  if v_count = 0 then
    raise notice 'Nenhum rascunho orfao de encerramento encontrado. Nada a fazer.';
    return;
  end if;

  raise notice '=== % rascunho(s) orfao(s) de encerramento encontrado(s) ===', v_count;
  for v_row in select * from _orphan_closing_drafts order by competence loop
    raise notice '  id=%, competencia=%, data=%, descricao="%"', v_row.id, v_row.competence, v_row.entry_date, v_row.description;
  end loop;

  if v_dry_run then
    raise notice 'DRY RUN ativo: nenhuma alteracao foi feita. Altere v_dry_run para false para apagar.';
    return;
  end if;

  delete from journal_entries je
  using _orphan_closing_drafts t
  where je.id = t.id;

  raise notice '% rascunho(s) orfao(s) de encerramento apagado(s). Voce ja pode tentar encerrar essas competencias de novo.', v_count;
end $$;
