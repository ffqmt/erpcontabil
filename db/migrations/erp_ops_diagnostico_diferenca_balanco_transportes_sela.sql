-- =====================================================================================
-- ERP OPS — DIAGNOSTICO: DIFERENCA NO BALANCO PATRIMONIAL — TRANSPORTES SELA LTDA
-- =====================================================================================
-- Somente leitura — nao altera nada. Uma UNICA consulta (sem DO/RAISE NOTICE) para o
-- resultado aparecer garantido na grade normal de resultados do SQL Editor.
--
-- Cada linha do resultado tem uma coluna "bloco" dizendo de qual checagem ela veio:
-- 1-GLOBAL        : debito x credito de TODOS os lancamentos POSTED da empresa.
-- 2-DESBALANCEADO : lancamento POSTED individual com debito != credito (nao deveria existir).
-- 3-ORFA          : linha de lancamento POSTED cujo account_id nao existe em chart_accounts
--                    (o relatorio de Balanco ignora essa linha silenciosamente).
-- 4-ENCERRAMENTO  : cada lancamento de encerramento (RESULT_CLOSING) e seu proprio balanco.
-- 5-ESTORNO       : cada lancamento de estorno e o numero do lancamento original.
--
-- Se so aparecer a linha "1-GLOBAL" com diferenca 0.00 e nenhuma linha "2-DESBALANCEADO"/
-- "3-ORFA", o livro esta internamente correto — a causa da diferenca do Balanco esta no
-- calculo/classificacao do relatorio, nao em dado corrompido (me manda o resultado que eu
-- reviso o calculo).
-- =====================================================================================

with alvo as (
  select id as company_id
  from companies
  where regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g') = '08185797000150'
  order by active desc, created_at desc
  limit 1
),

bloco1 as (
  select
    '1-GLOBAL' as bloco,
    'Debito vs Credito de todos os lancamentos POSTED' as info,
    coalesce(sum(case when jel.debit_credit = 'DEBIT' then jel.amount else 0 end), 0) as valor1_debito,
    coalesce(sum(case when jel.debit_credit = 'CREDIT' then jel.amount else 0 end), 0) as valor2_credito,
    coalesce(sum(case when jel.debit_credit = 'DEBIT' then jel.amount else -jel.amount end), 0) as valor3_diferenca
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join alvo a on a.company_id = je.company_id
  where je.status = 'POSTED'
),

bloco2 as (
  select
    '2-DESBALANCEADO' as bloco,
    'nº ' || je.number || ' (' || je.entry_date || ', ' || je.origin || ') "' || coalesce(je.description, '') || '"' as info,
    sum(case when jel.debit_credit = 'DEBIT' then jel.amount else 0 end) as valor1_debito,
    sum(case when jel.debit_credit = 'CREDIT' then jel.amount else 0 end) as valor2_credito,
    sum(case when jel.debit_credit = 'DEBIT' then jel.amount else -jel.amount end) as valor3_diferenca
  from journal_entries je
  join journal_entry_lines jel on jel.journal_entry_id = je.id
  join alvo a on a.company_id = je.company_id
  where je.status = 'POSTED'
  group by je.id, je.number, je.entry_date, je.origin, je.description
  having abs(sum(case when jel.debit_credit = 'DEBIT' then jel.amount else -jel.amount end)) > 0.009
),

bloco3 as (
  select
    '3-ORFA' as bloco,
    'lancamento nº ' || je.number || ' (' || je.entry_date || '), account_id=' || coalesce(jel.account_id::text, 'NULL') || ', ' || jel.debit_credit || ', memo="' || coalesce(jel.memo, '') || '"' as info,
    jel.amount as valor1_debito,
    null::numeric as valor2_credito,
    null::numeric as valor3_diferenca
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join alvo a on a.company_id = je.company_id
  where je.status = 'POSTED'
    and (jel.account_id is null or not exists (select 1 from chart_accounts ca where ca.id = jel.account_id))
),

bloco4 as (
  select
    '4-ENCERRAMENTO' as bloco,
    je.competence || ' — nº ' || coalesce(je.number::text, 'DRAFT') || ' (status=' || je.status || ', data=' || je.entry_date || ')' as info,
    coalesce(sum(case when jel.debit_credit = 'DEBIT' then jel.amount else 0 end), 0) as valor1_debito,
    coalesce(sum(case when jel.debit_credit = 'CREDIT' then jel.amount else 0 end), 0) as valor2_credito,
    coalesce(sum(case when jel.debit_credit = 'DEBIT' then jel.amount else -jel.amount end), 0) as valor3_diferenca
  from journal_entries je
  left join journal_entry_lines jel on jel.journal_entry_id = je.id
  join alvo a on a.company_id = je.company_id
  where je.origin = 'RESULT_CLOSING'
  group by je.id, je.competence, je.number, je.status, je.entry_date
),

bloco5 as (
  select
    '5-ESTORNO' as bloco,
    'estorno nº ' || je.number || ' (status=' || je.status || ', ' || je.entry_date || ') do original nº ' || coalesce(orig.number::text, '???') || ' (status=' || coalesce(orig.status::text, '???') || ')' as info,
    null::numeric as valor1_debito,
    null::numeric as valor2_credito,
    null::numeric as valor3_diferenca
  from journal_entries je
  join alvo a on a.company_id = je.company_id
  left join journal_entries orig on orig.id = je.reversal_of_id
  where je.reversal_of_id is not null
)

select * from bloco1
union all select * from bloco2
union all select * from bloco3
union all select * from bloco4
union all select * from bloco5
order by bloco;
