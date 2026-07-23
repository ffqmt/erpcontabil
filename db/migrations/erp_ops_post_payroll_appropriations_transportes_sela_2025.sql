-- =====================================================================================
-- ERP OPS — APROPRIACAO DE FOLHA — TRANSPORTES SELA — 13/2025 E 12/2025
-- =====================================================================================
-- Uso:
-- 1) Rode como esta primeiro: v_dry_run = true. O script apenas mostra o que sera feito.
-- 2) Para executar de verdade, altere v_dry_run para false e rode novamente.
--
-- O que este script faz quando v_dry_run=false:
-- - localiza a empresa TRANSPORTES SELA LTDA pelo CNPJ 08.185.797/0001-50;
-- - cria/garante contas contabeis analiticas para apropriacao de folha, 13o, INSS e FGTS;
-- - cria a competencia contabil 12/2025 se ainda nao existir;
-- - gera somente lancamentos de apropriacao (origin = PAYROLL_SUMMARY);
-- - reserva a numeracao oficial direto no contador interno, pois o SQL editor pode rodar
--   sem auth.uid() e bloquear next_journal_number();
-- - nao gera pagamentos, nao movimenta banco/caixa e deixa os passivos em aberto;
-- - nao apaga lancamentos ja POSTED: se o documento ja estiver postado, ele e ignorado.
--
-- IMPORTANTE: script operacional. Se algum periodo estiver CLOSED, o script aborta.
-- =====================================================================================

do $$
declare
  -- Seguranca: comece sempre com true.
  v_dry_run boolean := true;

  v_company_id uuid;
  v_workspace_id uuid;
  v_entry_id uuid;
  v_next_number bigint;
  v_document text;
  v_posted_count int;
  v_draft_count int;
  v_entries_to_create int;
  v_accounts_to_create int;
  v_account record;

  v_salarios_ordenados_id uuid;
  v_13_salario_id uuid;
  v_inss_patronal_id uuid;
  v_inss_patronal_13_id uuid;
  v_fgts_folha_id uuid;
  v_fgts_13_id uuid;
  v_salarios_pagar_id uuid;
  v_13_salario_pagar_id uuid;
  v_inss_dctfweb_id uuid;
  v_inss_13_dctfweb_id uuid;
  v_fgts_recolher_id uuid;
begin
  select c.id, c.workspace_id
    into v_company_id, v_workspace_id
  from companies c
  where regexp_replace(coalesce(c.cnpj, ''), '[^0-9]', '', 'g') = '08185797000150'
  order by c.active desc, c.created_at desc
  limit 1;

  if v_company_id is null then
    raise exception 'Empresa TRANSPORTES SELA LTDA (CNPJ 08.185.797/0001-50) nao encontrada.';
  end if;

  drop table if exists pg_temp._payroll_accounts;
  drop table if exists pg_temp._payroll_entries;
  drop table if exists pg_temp._payroll_lines;

  create temp table _payroll_accounts (
    account_key text primary key,
    code text not null,
    name text not null,
    account_type account_type not null,
    normal_balance normal_balance not null,
    parent_code text,
    is_synthetic boolean not null,
    accepts_entries boolean not null
  ) on commit drop;

  insert into _payroll_accounts
    (account_key, code, name, account_type, normal_balance, parent_code, is_synthetic, accepts_entries)
  values
    ('cost_root', '6', 'CUSTOS', 'COST', 'DEBIT', null, true, false),
    ('transport_costs', '6.1', 'CUSTOS OPERACIONAIS DE TRANSPORTE', 'COST', 'DEBIT', '6', true, false),
    ('salarios_ordenados', '6.1.23', 'Salários e Ordenados', 'COST', 'DEBIT', '6.1', false, true),
    ('13_salario', '6.1.24', '13º Salário', 'COST', 'DEBIT', '6.1', false, true),
    ('inss_patronal', '6.1.25', 'INSS Patronal / Encargos Previdenciários', 'COST', 'DEBIT', '6.1', false, true),
    ('inss_patronal_13', '6.1.26', 'INSS Patronal sobre 13º', 'COST', 'DEBIT', '6.1', false, true),
    ('fgts_folha', '6.1.27', 'FGTS sobre Folha', 'COST', 'DEBIT', '6.1', false, true),
    ('fgts_13', '6.1.28', 'FGTS sobre 13º Salário', 'COST', 'DEBIT', '6.1', false, true),

    ('liability_root', '2', 'PASSIVO', 'LIABILITY', 'CREDIT', null, true, false),
    ('current_liabilities', '2.1', 'PASSIVO CIRCULANTE', 'LIABILITY', 'CREDIT', '2', true, false),
    ('labor_liabilities', '2.1.4', 'OBRIGAÇÕES TRABALHISTAS E PREVIDENCIÁRIAS', 'LIABILITY', 'CREDIT', '2.1', true, false),
    ('payroll_liabilities', '2.1.4.01', 'OBRIGAÇÕES COM O PESSOAL', 'LIABILITY', 'CREDIT', '2.1.4', true, false),
    ('social_liabilities', '2.1.4.02', 'OBRIGAÇÕES PREVIDENCIÁRIAS', 'LIABILITY', 'CREDIT', '2.1.4', true, false),
    ('salarios_pagar', '2.1.4.01.01', 'Salários a Pagar', 'LIABILITY', 'CREDIT', '2.1.4.01', false, true),
    ('13_salario_pagar', '2.1.4.01.04', '13º Salário a Pagar', 'LIABILITY', 'CREDIT', '2.1.4.01', false, true),
    ('inss_dctfweb', '2.1.4.02.03', 'INSS a Recolher - DCTFWeb', 'LIABILITY', 'CREDIT', '2.1.4.02', false, true),
    ('inss_13_dctfweb', '2.1.4.02.04', 'INSS sobre 13º a Recolher - DCTFWeb', 'LIABILITY', 'CREDIT', '2.1.4.02', false, true),
    ('fgts_recolher', '2.1.4.02.02', 'FGTS a Recolher', 'LIABILITY', 'CREDIT', '2.1.4.02', false, true);

  create temp table _payroll_entries (
    entry_key text primary key,
    entry_date date not null,
    competence date not null,
    document text not null,
    description text not null
  ) on commit drop;

  insert into _payroll_entries (entry_key, entry_date, competence, document, description)
  values
    (
      '13_2025',
      '2025-12-20',
      '2025-12-01',
      '1.1.0000000036152150844',
      'Apropriação da folha de 13º salário do ano de 2025, incluindo INSS patronal/RAT e FGTS, conforme eSocial/DCTFWeb e FGTS Digital, recibo base nº 1.1.0000000036152150844.'
    ),
    (
      'folha_2025_12',
      '2025-12-31',
      '2025-12-01',
      '1.1.0000000037003202025',
      'Apropriação da folha de pagamento da competência 12/2025, incluindo salários, INSS patronal/RAT e FGTS, conforme eSocial/DCTFWeb e FGTS Digital, recibo base nº 1.1.0000000037003202025.'
    );

  create temp table _payroll_lines (
    entry_key text not null references _payroll_entries(entry_key),
    line_order int not null,
    account_key text not null references _payroll_accounts(account_key),
    debit_credit debit_credit not null,
    amount numeric(18,2) not null,
    memo text not null,
    primary key (entry_key, line_order)
  ) on commit drop;

  insert into _payroll_lines (entry_key, line_order, account_key, debit_credit, amount, memo)
  values
    -- 13o anual: nao repete o FGTS de 9,57 ja reconhecido na apropriacao de 11/2025.
    ('13_2025', 1, '13_salario', 'DEBIT', 478.80, '13º salário 2025 - remuneração'),
    ('13_2025', 2, 'inss_patronal_13', 'DEBIT', 110.12, '13º salário 2025 - INSS patronal/RAT'),
    ('13_2025', 3, 'fgts_13', 'DEBIT', 28.72, '13º salário 2025 - FGTS'),
    ('13_2025', 4, '13_salario_pagar', 'CREDIT', 442.89, '13º salário 2025 - líquido a pagar'),
    ('13_2025', 5, 'inss_13_dctfweb', 'CREDIT', 146.03, '13º salário 2025 - INSS a recolher DCTFWeb'),
    ('13_2025', 6, 'fgts_recolher', 'CREDIT', 28.72, '13º salário 2025 - FGTS a recolher'),

    ('folha_2025_12', 1, 'salarios_ordenados', 'DEBIT', 2872.81, 'Folha mensal 12/2025 - salários e ordenados'),
    ('folha_2025_12', 2, 'inss_patronal', 'DEBIT', 660.75, 'Folha mensal 12/2025 - INSS patronal/RAT'),
    ('folha_2025_12', 3, 'fgts_folha', 'DEBIT', 229.82, 'Folha mensal 12/2025 - FGTS'),
    ('folha_2025_12', 4, 'salarios_pagar', 'CREDIT', 2634.67, 'Folha mensal 12/2025 - salários líquidos a pagar'),
    ('folha_2025_12', 5, 'inss_dctfweb', 'CREDIT', 898.89, 'Folha mensal 12/2025 - INSS a recolher DCTFWeb'),
    ('folha_2025_12', 6, 'fgts_recolher', 'CREDIT', 229.82, 'Folha mensal 12/2025 - FGTS a recolher');

  if exists (
    select 1
    from _payroll_lines
    group by entry_key
    having
      sum(amount) filter (where debit_credit = 'DEBIT')
      <> sum(amount) filter (where debit_credit = 'CREDIT')
  ) then
    raise exception 'As partidas informadas nao estao balanceadas.';
  end if;

  if exists (
    select 1
    from accounting_periods ap
    join (select distinct competence from _payroll_entries) pe on pe.competence = ap.competence
    where ap.company_id = v_company_id
      and ap.status = 'CLOSED'
  ) then
    raise exception 'Existe competencia CLOSED no periodo alvo. Reabra o periodo antes de postar a apropriacao.';
  end if;

  select count(*)
    into v_accounts_to_create
  from _payroll_accounts pa
  where not exists (
    select 1
    from chart_accounts ca
    where ca.company_id = v_company_id
      and ca.code = pa.code
  );

  select count(*)
    into v_posted_count
  from journal_entries je
  join _payroll_entries pe on pe.document = je.document
  where je.company_id = v_company_id
    and je.origin = 'PAYROLL_SUMMARY'
    and je.status = 'POSTED';

  select count(*)
    into v_draft_count
  from journal_entries je
  join _payroll_entries pe on pe.document = je.document
  where je.company_id = v_company_id
    and je.origin = 'PAYROLL_SUMMARY'
    and je.status = 'DRAFT';

  select count(*)
    into v_entries_to_create
  from _payroll_entries pe
  where not exists (
    select 1
    from journal_entries je
    where je.company_id = v_company_id
      and je.origin = 'PAYROLL_SUMMARY'
      and je.document = pe.document
      and je.status = 'POSTED'
  );

  raise notice 'Empresa alvo: % (%).', v_company_id, v_workspace_id;
  raise notice 'Contas a criar: %. Lancamentos POSTED ja existentes: %. Rascunhos a recriar: %. Lancamentos a gerar: %.',
    v_accounts_to_create, v_posted_count, v_draft_count, v_entries_to_create;

  if v_dry_run then
    raise notice 'DRY RUN ativo: nenhuma alteracao foi feita. Altere v_dry_run para false para executar.';
    return;
  end if;

  for v_account in
    select *
    from _payroll_accounts
    order by array_length(string_to_array(code, '.'), 1), code
  loop
    insert into chart_accounts (
      workspace_id,
      company_id,
      code,
      name,
      account_type,
      normal_balance,
      parent_id,
      is_synthetic,
      accepts_entries,
      is_active
    )
    select
      v_workspace_id,
      v_company_id,
      v_account.code,
      v_account.name,
      v_account.account_type,
      v_account.normal_balance,
      parent.id,
      v_account.is_synthetic,
      v_account.accepts_entries,
      true
    from (select 1) seed
    left join chart_accounts parent
      on parent.company_id = v_company_id
     and parent.code = v_account.parent_code
    where not exists (
      select 1
      from chart_accounts existing
      where existing.company_id = v_company_id
        and existing.code = v_account.code
    );
  end loop;

  select ca.id into v_salarios_ordenados_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '6.1.23';

  select ca.id into v_13_salario_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '6.1.24';

  select ca.id into v_inss_patronal_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '6.1.25';

  select ca.id into v_inss_patronal_13_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '6.1.26';

  select ca.id into v_fgts_folha_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '6.1.27';

  select ca.id into v_fgts_13_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '6.1.28';

  select ca.id into v_salarios_pagar_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '2.1.4.01.01';

  select ca.id into v_13_salario_pagar_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '2.1.4.01.04';

  select ca.id into v_inss_dctfweb_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '2.1.4.02.03';

  select ca.id into v_inss_13_dctfweb_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '2.1.4.02.04';

  select ca.id into v_fgts_recolher_id
  from chart_accounts ca
  where ca.company_id = v_company_id and ca.code = '2.1.4.02.02';

  if v_salarios_ordenados_id is null
     or v_13_salario_id is null
     or v_inss_patronal_id is null
     or v_inss_patronal_13_id is null
     or v_fgts_folha_id is null
     or v_fgts_13_id is null
     or v_salarios_pagar_id is null
     or v_13_salario_pagar_id is null
     or v_inss_dctfweb_id is null
     or v_inss_13_dctfweb_id is null
     or v_fgts_recolher_id is null then
    raise exception 'Falha ao localizar/criar uma ou mais contas de folha.';
  end if;

  if exists (
    select 1
    from chart_accounts ca
    where ca.id in (
      v_salarios_ordenados_id,
      v_13_salario_id,
      v_inss_patronal_id,
      v_inss_patronal_13_id,
      v_fgts_folha_id,
      v_fgts_13_id,
      v_salarios_pagar_id,
      v_13_salario_pagar_id,
      v_inss_dctfweb_id,
      v_inss_13_dctfweb_id,
      v_fgts_recolher_id
    )
    and (not ca.is_active or ca.is_synthetic or not ca.accepts_entries)
  ) then
    raise exception 'Uma ou mais contas de folha existem, mas nao estao ativas/analiticas/lancaveis.';
  end if;

  insert into accounting_periods (workspace_id, company_id, competence, start_date, end_date, status)
  select distinct
    v_workspace_id,
    v_company_id,
    pe.competence,
    pe.competence,
    (date_trunc('month', pe.competence) + interval '1 month' - interval '1 day')::date,
    'OPEN'::period_status
  from _payroll_entries pe
  on conflict (company_id, competence) do nothing;

  -- Rascunhos podem ser recriados; lancamentos postados nunca sao apagados por este script.
  delete from journal_entry_lines jel
  using journal_entries je, _payroll_entries pe
  where jel.journal_entry_id = je.id
    and je.company_id = v_company_id
    and je.origin = 'PAYROLL_SUMMARY'
    and je.status = 'DRAFT'
    and je.document = pe.document;

  delete from journal_entries je
  using _payroll_entries pe
  where je.company_id = v_company_id
    and je.origin = 'PAYROLL_SUMMARY'
    and je.status = 'DRAFT'
    and je.document = pe.document;

  for v_document in
    select pe.document
    from _payroll_entries pe
    where not exists (
      select 1
      from journal_entries je
      where je.company_id = v_company_id
        and je.origin = 'PAYROLL_SUMMARY'
        and je.document = pe.document
        and je.status = 'POSTED'
    )
    order by pe.entry_date, pe.document
  loop
    insert into journal_entries (
      workspace_id,
      company_id,
      entry_date,
      competence,
      description,
      document,
      origin,
      status
    )
    select
      v_workspace_id,
      v_company_id,
      pe.entry_date,
      pe.competence,
      pe.description,
      pe.document,
      'PAYROLL_SUMMARY'::journal_origin,
      'DRAFT'::journal_status
    from _payroll_entries pe
    where pe.document = v_document
    returning id into v_entry_id;

    insert into journal_entry_lines (
      workspace_id,
      company_id,
      journal_entry_id,
      account_id,
      debit_credit,
      amount,
      memo
    )
    select
      v_workspace_id,
      v_company_id,
      v_entry_id,
      case pl.account_key
        when 'salarios_ordenados' then v_salarios_ordenados_id
        when '13_salario' then v_13_salario_id
        when 'inss_patronal' then v_inss_patronal_id
        when 'inss_patronal_13' then v_inss_patronal_13_id
        when 'fgts_folha' then v_fgts_folha_id
        when 'fgts_13' then v_fgts_13_id
        when 'salarios_pagar' then v_salarios_pagar_id
        when '13_salario_pagar' then v_13_salario_pagar_id
        when 'inss_dctfweb' then v_inss_dctfweb_id
        when 'inss_13_dctfweb' then v_inss_13_dctfweb_id
        when 'fgts_recolher' then v_fgts_recolher_id
        else null
      end,
      pl.debit_credit,
      pl.amount,
      pl.memo
    from _payroll_lines pl
    join _payroll_entries pe on pe.entry_key = pl.entry_key
    where pe.document = v_document
    order by pl.line_order;

    -- Scripts operacionais rodados pelo SQL editor podem nao ter auth.uid(); nesse caso
    -- next_journal_number() bloqueia a numeracao. Reservamos o numero direto no contador
    -- interno e deixamos o trigger validar periodo aberto e partidas balanceadas.
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

    raise notice 'Lancamento de apropriacao postado para documento %, id %.', v_document, v_entry_id;
  end loop;

  raise notice 'Apropriacao de folha concluida. Nenhum pagamento/banco/caixa foi movimentado.';
end $$;
