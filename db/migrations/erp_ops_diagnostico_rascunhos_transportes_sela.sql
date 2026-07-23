-- =====================================================================================
-- ERP OPS — DIAGNOSTICO: LANCAMENTOS EM RASCUNHO (DRAFT) — TRANSPORTES SELA LTDA
-- =====================================================================================
-- Somente leitura — nao altera nada. Objetivo: encontrar o(s) lancamento(s) DRAFT que
-- estao bloqueando o Encerramento de Resultado (closeIncomeStatementAction bloqueia
-- QUALQUER draft na competencia, de qualquer origem, nao so de encerramento).
--
-- Uso: rode e confira, por competencia, quais lancamentos aparecem. Para cada um, decida:
-- - Se for um lancamento legitimo esquecido em rascunho: va em Contabilidade > Lancamentos
--   e publique-o (ou apague-o, se nao fizer sentido mais).
-- - Se for um cabecalho orfao de uma tentativa de encerramento que falhou (origin =
--   'RESULT_CLOSING', sem linhas ou com linhas incompletas): pode apagar com seguranca,
--   veja a consulta de apoio no final.
-- =====================================================================================

select
  je.id,
  je.number,
  je.status,
  je.origin,
  je.competence,
  je.entry_date,
  je.description,
  je.document,
  (select count(*) from journal_entry_lines jel where jel.journal_entry_id = je.id) as line_count,
  je.created_at
from journal_entries je
join companies c on c.id = je.company_id
where regexp_replace(coalesce(c.cnpj, ''), '[^0-9]', '', 'g') = '08185797000150'
  and je.status = 'DRAFT'
order by je.competence, je.created_at;

-- Consulta de apoio: cabecalhos DRAFT de origin='RESULT_CLOSING' sem nenhuma linha (o
-- padrao exato de um rollback que nao completou apos falha ao salvar as linhas). Esses sao
-- seguros de apagar sozinhos (delete from journal_entries where id = '<id>').
select je.id, je.number, je.competence, je.entry_date, je.description, je.created_at
from journal_entries je
join companies c on c.id = je.company_id
where regexp_replace(coalesce(c.cnpj, ''), '[^0-9]', '', 'g') = '08185797000150'
  and je.status = 'DRAFT'
  and je.origin = 'RESULT_CLOSING'
  and not exists (select 1 from journal_entry_lines jel where jel.journal_entry_id = je.id);
