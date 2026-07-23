-- =====================================================================================
-- ERP OPS — BAIXA DE FORNECEDORES EM CAIXA (31/12/2025) — TRANSPORTES SELA LTDA
-- =====================================================================================
-- Gera UM lançamento contábil de partidas múltiplas: débito em cada subconta analítica de
-- Fornecedor (2.1.1.xx) com saldo atual diferente de zero, zerando/baixando o passivo, e
-- crédito na conta de Caixa (1.1.1.01) pelo total, na data 31/12/2025.
--
-- Uso:
-- 1) Rode como esta primeiro: v_dry_run = true. Mostra a lista de fornecedores, os saldos
--    calculados AO VIVO no banco e o total que iria para o crédito de Caixa.
-- 2) Confira os valores contra o Balancete antes de prosseguir.
-- 3) Para executar de verdade, altere v_dry_run para false e rode novamente.
--
-- O saldo de cada fornecedor é calculado na hora (soma de crédito menos débito de todas as
-- linhas de lançamentos POSTED daquela conta) — não usa nenhum valor fixo digitado, para
-- não haver risco de transcrição errada nem saldo desatualizado.
--
-- IDEMPOTENTE: usa journal_entries.document = 'BAIXA-FORNECEDORES-2025-12-31' como marca.
-- Se já existir um lançamento POSTED com esse documento nesta empresa, o script não roda de
-- novo (evita debitar os fornecedores duas vezes por engano).
--
-- IMPORTANTE: confirme que a competência 12/2025 está OPEN antes de rodar de verdade — o
-- script cria o período se ele ainda não existir, mas não reabre um período já fechado.
-- =====================================================================================

do $$
declare
  -- Segurança: comece sempre com true.
  v_dry_run boolean := true;

  v_company_cnpj text := '08185797000150';
  v_cash_account_code text := '1.1.1.01';
  v_entry_date date := '2025-12-31';
  v_document text := 'BAIXA-FORNECEDORES-2025-12-31';
  v_description text := 'Baixa de fornecedores em caixa em 31/12/2025';

  v_company_id uuid;
  v_workspace_id uuid;
  v_cash_account_id uuid;
  v_competence date := date_trunc('month', '2025-12-31'::date)::date;

  v_entry_id uuid;
  v_next_number bigint;
  v_total numeric(18,2) := 0;
  v_line_count int := 0;
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

  if exists (
    select 1 from journal_entries
    where company_id = v_company_id and document = v_document and status = 'POSTED'
  ) then
    raise notice 'Ja existe um lancamento POSTED com o documento "%" nesta empresa — este script ja foi executado antes. Nada a fazer.', v_document;
    return;
  end if;

  select id into v_cash_account_id
  from chart_accounts
  where company_id = v_company_id and code = v_cash_account_code;

  if v_cash_account_id is null then
    raise exception 'Conta de caixa % nao encontrada nesta empresa.', v_cash_account_code;
  end if;

  if exists (
    select 1 from chart_accounts
    where id = v_cash_account_id and (not is_active or is_synthetic or not accepts_entries)
  ) then
    raise exception 'A conta de caixa % existe, mas nao esta ativa/analitica/lancavel.', v_cash_account_code;
  end if;

  drop table if exists pg_temp._all_balances;
  drop table if exists pg_temp._supplier_balances;
  drop table if exists pg_temp._excluded_balances;

  create temp table _all_balances on commit drop as
  select
    ca.id as account_id,
    ca.code,
    ca.name,
    sum(case when jel.debit_credit = 'CREDIT' then jel.amount else 0 end)
      - sum(case when jel.debit_credit = 'DEBIT' then jel.amount else 0 end) as balance
  from chart_accounts ca
  join journal_entry_lines jel on jel.account_id = ca.id
  join journal_entries je on je.id = jel.journal_entry_id
  where ca.company_id = v_company_id
    and ca.code like '2.1.1.%'
    and ca.is_synthetic = false
    and ca.accepts_entries = true
    and ca.is_active = true
    and je.status = 'POSTED'
  group by ca.id, ca.code, ca.name
  having abs(
    sum(case when jel.debit_credit = 'CREDIT' then jel.amount else 0 end)
      - sum(case when jel.debit_credit = 'DEBIT' then jel.amount else 0 end)
  ) > 0.009;

  -- So entram na baixa via caixa as contas com saldo CREDOR (passivo normal, a pagar).
  -- Conta com saldo DEVEDOR (debito > credito) nao e um passivo a pagar nesse sentido —
  -- fica de fora e e so reportada, para nao arriscar lancar na direcao errada.
  create temp table _supplier_balances on commit drop as
  select * from _all_balances where balance > 0.009;

  create temp table _excluded_balances on commit drop as
  select * from _all_balances where balance < -0.009;

  select count(*), coalesce(sum(balance), 0) into v_line_count, v_total from _supplier_balances;

  if exists (select 1 from _excluded_balances) then
    raise notice '=== ATENCAO: conta(s) 2.1.1.xx com saldo DEVEDOR, excluida(s) da baixa automatica (revise manualmente) ===';
    for v_row in select * from _excluded_balances order by code loop
      raise notice '  EXCLUIDO — % — % — R$ % (devedor)', v_row.code, v_row.name, v_row.balance;
    end loop;
  end if;

  if v_line_count = 0 then
    raise notice 'Nenhuma subconta 2.1.1.xx com saldo credor diferente de zero encontrada. Nada a fazer.';
    return;
  end if;

  raise notice '=== % fornecedor(es) a baixar, total R$ % ===', v_line_count, v_total;
  for v_row in select * from _supplier_balances order by code loop
    raise notice '  % — % — R$ %', v_row.code, v_row.name, v_row.balance;
  end loop;

  if v_dry_run then
    raise notice 'DRY RUN ativo: nenhuma alteracao foi feita. Confira os valores acima contra o Balancete e altere v_dry_run para false para gerar o lancamento.';
    return;
  end if;

  insert into accounting_periods (workspace_id, company_id, competence, start_date, end_date, status)
  values (
    v_workspace_id,
    v_company_id,
    v_competence,
    v_competence,
    (v_competence + interval '1 month' - interval '1 day')::date,
    'OPEN'::period_status
  )
  on conflict (company_id, competence) do nothing;

  if exists (
    select 1 from accounting_periods
    where company_id = v_company_id and competence = v_competence and status not in ('OPEN', 'REOPENED')
  ) then
    raise exception 'O periodo contabil de % esta fechado. Reabra antes de rodar este script.', v_competence;
  end if;

  insert into journal_entries (
    workspace_id, company_id, entry_date, competence, description, document, origin, status
  )
  values (
    v_workspace_id, v_company_id, v_entry_date, v_competence, v_description, v_document, 'MANUAL'::journal_origin, 'DRAFT'::journal_status
  )
  returning id into v_entry_id;

  insert into journal_entry_lines (workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
  select
    v_workspace_id, v_company_id, v_entry_id, sb.account_id, 'DEBIT'::debit_credit, sb.balance,
    'Baixa em caixa — ' || sb.name
  from _supplier_balances sb;

  insert into journal_entry_lines (workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo)
  values (v_workspace_id, v_company_id, v_entry_id, v_cash_account_id, 'CREDIT'::debit_credit, v_total, v_description);

  -- Scripts operacionais no SQL editor podem rodar sem auth.uid(), o que bloqueia
  -- next_journal_number(); reservamos o numero direto no contador interno (mesmo padrao do
  -- script de apropriacao de folha) e deixamos o trigger validar periodo aberto e partidas
  -- balanceadas.
  insert into company_journal_counters (company_id, last_number)
  values (v_company_id, 1)
  on conflict (company_id) do update
    set last_number = company_journal_counters.last_number + 1,
        updated_at = now()
  returning last_number into v_next_number;

  update journal_entries
  set number = v_next_number,
      status = 'POSTED'::journal_status
  where id = v_entry_id;

  raise notice 'Lancamento nº % postado: % fornecedor(es) baixado(s), total R$ % debitado e creditado em Caixa (%).',
    v_next_number, v_line_count, v_total, v_cash_account_code;
end $$;
