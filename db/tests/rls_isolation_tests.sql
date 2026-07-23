-- =====================================================================================
-- ERP CONTÁBIL — SUÍTE DE VALIDAÇÃO DE RLS E ISOLAMENTO MULTIEMPRESA/MULTIWORKSPACE
-- Etapa 17 — Validação de Segurança em Ambiente Descartável
-- =====================================================================================
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- NÃO RODE ESTE ARQUIVO NO BANCO DE DESENVOLVIMENTO PRINCIPAL DO PROJETO.
-- Rode em um projeto Supabase descartável, uma branch de banco, ou um Postgres local
-- resetável. Ver db/tests/README.md para o passo a passo completo.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- PRÉ-REQUISITOS (nessa ordem, no banco descartável):
--   1. erp_schema_v1_1.sql
--   2. db/migrations/erp_schema_v1_2_cadastros_base.sql   (necessário — testamos items/
--      fiscal_operation_natures/states/municipalities/colunas novas de bank_accounts)
--   3. erp_rls_v1.sql
--   4. db/migrations/erp_rls_v1_2_cadastros_base.sql
--   5. ESTE ARQUIVO (db/tests/rls_isolation_tests.sql)
--
-- Os seeds de demonstração (seed_demo_accounting.sql / seed_demo_base_registrations.sql)
-- NÃO são pré-requisito — este arquivo cria seus próprios dados de teste, com UUIDs
-- fixos prefixados em "e" (ex.: 'e1000000-...') para não colidir com os UUIDs dos seeds
-- de demonstração (que usam prefixos '8888.../9999.../1111.../5555.../p000.../c000...').
--
-- ESTRATÉGIA DE SIMULAÇÃO DE AUTH (sem Francoos/sessão HTTP real):
-- As funções de autorização do projeto (is_workspace_member, can_read_company etc., ver
-- erp_rls_v1.sql Bloco 2) resolvem o usuário atual via current_profile_id() -> auth_user_id
-- -> auth.uid(). auth.uid() no Supabase é definido (padrão da plataforma, não deste
-- projeto) como uma leitura de GUC de sessão — variando por versão da imagem entre
-- current_setting('request.jwt.claim.sub', true) e
-- current_setting('request.jwt.claims', true)::jsonb ->> 'sub'. Como este arquivo foi
-- escrito SEM acesso a um projeto Supabase ao vivo para confirmar qual das duas formas
-- está ativa no seu ambiente, a função set_test_auth() abaixo define AS DUAS, mais
-- "set local role authenticated" — cobre ambas as implementações conhecidas. Se
-- nenhuma delas funcionar no seu projeto, veja o fallback manual documentado em
-- db/tests/README.md.
--
-- ESTRUTURA: os helpers são criados como funções normais (BLOCO 0); todo o restante
-- (dados de teste + asserções) roda dentro de UM ÚNICO bloco anônimo "do $test_suite$
-- ... $test_suite$;" — obrigatório porque PERFORM/RAISE só são válidos dentro de
-- PL/pgSQL, não como comandos SQL soltos. A transação inteira (BEGIN ... ROLLBACK) volta
-- o banco descartável ao estado anterior mesmo rodando este arquivo várias vezes.
-- Qualquer FALHA de asserção interrompe a execução com uma exceção (a mensagem de erro
-- identifica exatamente qual caso falhou).
-- =====================================================================================

begin;

-- =====================================================================================
-- BLOCO 0 — HELPERS DE TESTE
-- =====================================================================================

create or replace function assert_true(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'FALHA: %', p_message;
  else
    raise notice 'OK: %', p_message;
  end if;
end;
$$;

create or replace function assert_false(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  perform assert_true(not coalesce(p_condition, true), p_message);
end;
$$;

create or replace function assert_count(p_actual bigint, p_expected bigint, p_message text)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALHA: % (esperado=%, obtido=%)', p_message, p_expected, p_actual;
  else
    raise notice 'OK: % (=%)', p_message, p_actual;
  end if;
end;
$$;

-- Executa uma escrita (INSERT/UPDATE/DELETE) que DEVE ser bloqueada — seja por exceção
-- (RLS via WITH CHECK, ou trigger de negócio como fn_prevent_tenant_change) ou
-- silenciosamente por não afetar nenhuma linha (RLS via USING). Qualquer um dos dois
-- resultados conta como "bloqueado com sucesso". Só falha se a escrita afetar >0 linhas.
create or replace function assert_write_blocked(p_sql text, p_message text)
returns void language plpgsql as $$
declare
  v_rows int;
  v_blocked boolean := false;
  v_sqlstate text := null;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
  exception
    when others then
      v_blocked := true;
      v_sqlstate := sqlstate;
  end;

  if v_blocked then
    raise notice 'OK: % (bloqueado por exceção, SQLSTATE %)', p_message, v_sqlstate;
  elsif v_rows = 0 then
    raise notice 'OK: % (0 linhas afetadas — bloqueado por USING)', p_message;
  else
    raise exception 'FALHA: % (esperava bloqueio, mas afetou % linha(s))', p_message, v_rows;
  end if;
end;
$$;

-- Executa uma escrita que DEVE ter sucesso e afetar pelo menos 1 linha. Não captura
-- exceção de propósito: se a RLS bloquear algo que deveria ser permitido, o erro cru do
-- Postgres aparece na saída, apontando exatamente a policy que barrou incorretamente.
create or replace function assert_write_succeeds(p_sql text, p_message text)
returns void language plpgsql as $$
declare
  v_rows int;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise notice 'OK: % (% linha(s) afetada(s))', p_message, v_rows;
  else
    raise exception 'FALHA: % (esperava sucesso com linhas afetadas, obteve 0)', p_message;
  end if;
end;
$$;

-- Simula um usuário autenticado dentro da transação de teste. Define os dois formatos
-- conhecidos de claim JWT usados por auth.uid() no Supabase (ver nota no cabeçalho) e
-- troca a role da sessão para "authenticated" (necessário para que os GRANTs/policies de
-- "to authenticated" se apliquem — sem isso, mesmo com o JWT certo, a role continuaria
-- sendo a do superusuário/service_role e ignoraria a RLS por completo).
create or replace function set_test_auth(p_auth_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_auth_user_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

-- Reverte para a role original da sessão (tipicamente "postgres", superusuário — ignora
-- RLS) e limpa os claims simulados. Chame entre cada bloco de cenário sempre que precisar
-- voltar a ter visibilidade total.
create or replace function reset_test_auth()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  reset role;
end;
$$;

-- =====================================================================================
-- BLOCO 1 EM DIANTE — TUDO dentro de um único bloco anônimo, porque PERFORM/RAISE só são
-- válidos em PL/pgSQL (não como statements soltos de um script .sql).
-- =====================================================================================

do $test_suite$
begin

  ------------------------------------------------------------------------------------
  -- BLOCO 1 — DADOS DE TESTE
  ------------------------------------------------------------------------------------
  -- Executado com a role original da sessão (postgres/superusuário em ambiente
  -- descartável via SQL Editor/psql direto) — bypassa RLS automaticamente.

  insert into workspaces (id, name, cnpj, plan, status) values
    ('e1000000-0000-0000-0000-000000000001', 'Workspace de Teste A', '10000000000100', 'starter', 'ACTIVE'),
    ('e1000000-0000-0000-0000-000000000002', 'Workspace de Teste B', '20000000000200', 'starter', 'ACTIVE');

  insert into companies (id, workspace_id, legal_name, trade_name, cnpj, tax_regime, company_profile, active) values
    ('e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'Empresa A1 Teste Ltda', 'Empresa A1', '10000000000101', 'LUCRO_REAL', 'SERVICES', true),
    ('e2000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'Empresa A2 Teste Ltda', 'Empresa A2', '10000000000102', 'LUCRO_REAL', 'SERVICES', true),
    ('e2000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 'Empresa B1 Teste Ltda', 'Empresa B1', '20000000000201', 'LUCRO_REAL', 'SERVICES', true);

  -- 8 personas: auth.users + profiles
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role, email_confirmed_at) values
    ('e3000000-0000-0000-0000-000000000001', 'owner_a@teste.rls', '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now()),
    ('e3000000-0000-0000-0000-000000000002', 'admin_a@teste.rls', '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now()),
    ('e3000000-0000-0000-0000-000000000003', 'accountant_a1@teste.rls', '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now()),
    ('e3000000-0000-0000-0000-000000000004', 'assistant_a1@teste.rls', '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now()),
    ('e3000000-0000-0000-0000-000000000005', 'client_viewer_a1@teste.rls', '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now()),
    ('e3000000-0000-0000-0000-000000000006', 'viewer_a1@teste.rls', '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now()),
    ('e3000000-0000-0000-0000-000000000007', 'no_access@teste.rls', '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now()),
    ('e3000000-0000-0000-0000-000000000008', 'owner_b@teste.rls', '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated', now())
  on conflict (id) do nothing;

  insert into profiles (id, auth_user_id, name, email) values
    ('e4000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000001', 'Owner A (Teste RLS)', 'owner_a@teste.rls'),
    ('e4000000-0000-0000-0000-000000000002', 'e3000000-0000-0000-0000-000000000002', 'Admin A (Teste RLS)', 'admin_a@teste.rls'),
    ('e4000000-0000-0000-0000-000000000003', 'e3000000-0000-0000-0000-000000000003', 'Accountant A1 (Teste RLS)', 'accountant_a1@teste.rls'),
    ('e4000000-0000-0000-0000-000000000004', 'e3000000-0000-0000-0000-000000000004', 'Assistant A1 (Teste RLS)', 'assistant_a1@teste.rls'),
    ('e4000000-0000-0000-0000-000000000005', 'e3000000-0000-0000-0000-000000000005', 'Client Viewer A1 (Teste RLS)', 'client_viewer_a1@teste.rls'),
    ('e4000000-0000-0000-0000-000000000006', 'e3000000-0000-0000-0000-000000000006', 'Viewer A1 (Teste RLS)', 'viewer_a1@teste.rls'),
    ('e4000000-0000-0000-0000-000000000007', 'e3000000-0000-0000-0000-000000000007', 'No Access (Teste RLS)', 'no_access@teste.rls'),
    ('e4000000-0000-0000-0000-000000000008', 'e3000000-0000-0000-0000-000000000008', 'Owner B (Teste RLS)', 'owner_b@teste.rls');

  -- Vínculos de workspace. NOTA sobre "user_viewer_a1": o enum workspace_role real não
  -- tem um papel "VIEWER" (ver erp_rls_v1.sql Bloco 0 — decisão documentada de não
  -- adicionar via ALTER TYPE). O fallback documentado no plano mestre é: um ASSISTANT de
  -- workspace SEM vínculo em company_users não tem acesso operacional a NENHUMA empresa.
  -- É esse comportamento que este persona valida (ver Cenário 3).
  insert into workspace_users (id, workspace_id, profile_id, role) values
    (gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000001', 'OWNER'),
    (gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000002', 'ADMIN'),
    (gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000006', 'ASSISTANT'),
    (gen_random_uuid(), 'e1000000-0000-0000-0000-000000000002', 'e4000000-0000-0000-0000-000000000008', 'OWNER');

  -- Vínculos de empresa (só na Empresa A1).
  insert into company_users (id, company_id, profile_id, role) values
    (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000003', 'ACCOUNTANT'),
    (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000004', 'ASSISTANT'),
    (gen_random_uuid(), 'e2000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-000000000005', 'CLIENT_VIEWER');

  -- Dados operacionais mínimos por empresa.
  insert into cost_centers (id, workspace_id, company_id, code, name, active) values
    ('e6000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'CC-A1', 'Centro de Custo A1', true),
    ('e6000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'CC-A2', 'Centro de Custo A2', true),
    ('e6000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000003', 'CC-B1', 'Centro de Custo B1', true);

  insert into partners (id, workspace_id, company_id, name, partner_type, is_customer, active) values
    ('e7000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'Parceiro A1 Teste', 'CUSTOMER', true, true),
    ('e7000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'Parceiro A2 Teste', 'CUSTOMER', true, true),
    ('e7000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000003', 'Parceiro B1 Teste', 'CUSTOMER', true, true);

  -- Plano de contas mínimo (2 contas analíticas balanceáveis) só na Empresa A1.
  insert into chart_accounts (id, workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries, is_active) values
    ('e5000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', '1.1', 'Caixa Teste', 'ASSET', 'DEBIT', false, true, true),
    ('e5000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', '3.1', 'Capital Teste', 'EQUITY', 'CREDIT', false, true, true);

  -- Período contábil aberto, competência do mês corrente, só na Empresa A1.
  insert into accounting_periods (id, workspace_id, company_id, competence, start_date, end_date, status)
  values (
    'e8000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    date_trunc('month', current_date)::date,
    date_trunc('month', current_date)::date,
    (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date,
    'OPEN'
  );

  -- Lançamento contábil mínimo, DRAFT (nunca chega a POSTED neste teste — evita depender
  -- de next_journal_number()/validate_journal_entry_balance, já cobertos pelos testes
  -- funcionais das Etapas 6/9). Mesmo em DRAFT, fn_validate_journal_entry já exige
  -- período aberto e fn_validate_journal_entry_line já exige conta analítica — ambos
  -- satisfeitos pelos dados acima.
  insert into journal_entries (id, workspace_id, company_id, entry_date, competence, description, origin, status)
  values (
    'e9000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    current_date,
    date_trunc('month', current_date)::date,
    'Lançamento de teste de isolamento RLS',
    'MANUAL',
    'DRAFT'
  );

  insert into journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount) values
    (gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'DEBIT', 100.00),
    (gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000002', 'CREDIT', 100.00);

  -- Segundo lançamento DRAFT, dedicado ao teste de transição DRAFT->POSTED do Cenário 5
  -- (mantido separado do lançamento acima para não afetar o estado que o Cenário 8
  -- pressupõe DRAFT).
  insert into journal_entries (id, workspace_id, company_id, entry_date, competence, description, origin, status)
  values (
    'e9000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    current_date,
    date_trunc('month', current_date)::date,
    'Lançamento de teste de transição POSTED (Cenário 5)',
    'MANUAL',
    'DRAFT'
  );

  insert into journal_entry_lines (id, workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount) values
    (gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000002', 'e5000000-0000-0000-0000-000000000001', 'DEBIT', 50.00),
    (gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000002', 'e5000000-0000-0000-0000-000000000002', 'CREDIT', 50.00);

  -- Cadastros Base v1.2 (items, fiscal_operation_natures, bank_accounts) — só na Empresa A1.
  insert into items (id, workspace_id, company_id, code, name, item_type, active) values
    ('ea000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'ITEM-TESTE', 'Item de Teste RLS', 'SERVICE', true);

  insert into fiscal_operation_natures (id, workspace_id, company_id, code, name, direction, is_active) values
    ('eb000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'NAT-TESTE', 'Natureza de Teste RLS', 'OUTBOUND', true);

  insert into bank_accounts (id, workspace_id, company_id, chart_account_id, bank_name, account_type, active) values
    ('ec000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'Banco Teste RLS', 'CHECKING', true);

  -- Documento fiscal mínimo (DRAFT) + 1 item, só na Empresa A1 — cobre a tabela filha
  -- fiscal_document_items (Cenário 8).
  insert into fiscal_documents (id, workspace_id, company_id, direction, document_type, document_amount, status)
  values (
    'ed000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'OUT',
    'NFE',
    100.00,
    'DRAFT'
  );

  insert into fiscal_document_items (id, workspace_id, company_id, fiscal_document_id, description, quantity, unit_amount, total_amount)
  values (
    gen_random_uuid(),
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'ed000000-0000-0000-0000-000000000001',
    'Item de documento fiscal de teste',
    1,
    100.00,
    100.00
  );

  -- Log de auditoria mínimo (Cenário 9) — inserido diretamente com privilégio elevado
  -- (postgres/service_role), simulando o que hoje só um processo interno faz, já que não
  -- existe policy de INSERT para "authenticated" nesta tabela.
  insert into audit_logs (id, workspace_id, company_id, action, entity_type, entity_id, created_at)
  values (
    gen_random_uuid(),
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'TEST_EVENT',
    'partners',
    'e7000000-0000-0000-0000-000000000001',
    now()
  );

  -- Categoria patrimonial mínima (Cenário 12)
  insert into asset_categories (id, workspace_id, company_id, name, default_useful_life_months, default_annual_rate, default_depreciation_account_id, default_expense_account_id, depreciation_start_rule)
  values (
    'f7000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Categoria Teste RLS',
    60,
    20.00,
    'e5000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000002',
    'NEXT_MONTH'
  );

  -- Bem patrimonial mínimo (Cenário 12)
  insert into fixed_assets (id, workspace_id, company_id, category_id, description, acquisition_date, acquisition_amount, residual_amount, useful_life_months, asset_account_id, depreciation_account_id, expense_account_id, status)
  values (
    'f2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'f7000000-0000-0000-0000-000000000001',
    'Computador Teste RLS',
    '2024-01-01',
    5000.00,
    500.00,
    60,
    'e5000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000002',
    'ACTIVE'
  );

  -- Depreciação de bem mínima (Cenário 12)
  insert into asset_depreciations (id, workspace_id, company_id, fixed_asset_id, competence, accounting_amount, fiscal_amount)
  values (
    'f3000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    date_trunc('month', current_date)::date,
    75.00,
    75.00
  );

  -- Retenção de imposto de documento fiscal mínima (Cenário 12)
  insert into fiscal_document_retentions (id, workspace_id, company_id, fiscal_document_id, tax_type, base_amount, amount)
  values (
    'ee000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'ed000000-0000-0000-0000-000000000001',
    'ISS',
    100.00,
    5.00
  );

  -- Documento fiscal secundário para testes de status de transição de retenção (Cenário 12)
  insert into fiscal_documents (id, workspace_id, company_id, direction, document_type, document_amount, status)
  values (
    'ed000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'OUT',
    'NFE',
    100.00,
    'BOOKED'
  );

  -- Apuração de imposto mínima (Cenário 12)
  insert into tax_assessments (id, workspace_id, company_id, tax_type, competence, status)
  values (
    'ef000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'ISS',
    date_trunc('month', current_date)::date,
    'DRAFT'
  );

  -- Linha de apuração de imposto mínima (Cenário 12)
  insert into tax_assessment_lines (id, workspace_id, company_id, tax_assessment_id, description, amount)
  values (
    'f0000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'ef000000-0000-0000-0000-000000000001',
    'Linha manual de teste RLS',
    100.00
  );

  -- Obrigação tributária mínima (Cenário 12)
  insert into obligations (id, workspace_id, company_id, obligation_type, competence, amount, due_date, status)
  values (
    'f1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'ISS',
    date_trunc('month', current_date)::date,
    100.00,
    current_date + interval '10 days',
    'OPEN'
  );

  -- Importação de extrato bancário mínima (Cenário 12)
  insert into bank_statement_imports (id, workspace_id, company_id, bank_account_id, file_name)
  values (
    'f4000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'ec000000-0000-0000-0000-000000000001',
    'extrato_teste.ofx'
  );

  -- Linha de extrato bancário mínima (Cenário 12)
  insert into bank_statement_lines (id, workspace_id, company_id, bank_statement_import_id, bank_account_id, entry_date, description, amount, hash, status)
  values (
    'f5000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'ec000000-0000-0000-0000-000000000001',
    current_date,
    'Movimento bancário de teste',
    500.00,
    'hash_teste_rls',
    'PENDING'
  );

  -- Conciliação bancária mínima (Cenário 12)
  insert into bank_reconciliations (id, workspace_id, company_id, bank_account_id, bank_statement_line_id, journal_entry_line_id)
  values (
    'f6000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'ec000000-0000-0000-0000-000000000001',
    'f5000000-0000-0000-0000-000000000001',
    (select id from journal_entry_lines where journal_entry_id = 'e9000000-0000-0000-0000-000000000001' limit 1)
  );

  raise notice '--- Bloco 1 concluído: dados de teste criados (2 workspaces, 3 empresas, 8 personas) ---';


  ------------------------------------------------------------------------------------
  -- BLOCO 2 — TESTES DE FUNÇÕES AUXILIARES DE AUTORIZAÇÃO
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000001'); -- owner_a
  perform assert_true(is_workspace_member('e1000000-0000-0000-0000-000000000001'), 'owner_a: is_workspace_member(ws_a) deve ser true');
  perform assert_false(is_workspace_member('e1000000-0000-0000-0000-000000000002'), 'owner_a: is_workspace_member(ws_b) deve ser false');
  perform assert_true(has_workspace_role('e1000000-0000-0000-0000-000000000001', array['OWNER','ADMIN']::workspace_role[]), 'owner_a: has_workspace_role(ws_a, [OWNER,ADMIN]) deve ser true');
  perform assert_true(can_read_workspace('e1000000-0000-0000-0000-000000000001'), 'owner_a: can_read_workspace(ws_a) deve ser true');
  perform assert_true(can_admin_workspace('e1000000-0000-0000-0000-000000000001'), 'owner_a: can_admin_workspace(ws_a) deve ser true');
  perform assert_true(can_read_company('e2000000-0000-0000-0000-000000000001'), 'owner_a: can_read_company(company_a1) deve ser true (via papel de workspace)');
  perform assert_true(can_read_company('e2000000-0000-0000-0000-000000000002'), 'owner_a: can_read_company(company_a2) deve ser true (via papel de workspace)');
  perform assert_false(can_read_company('e2000000-0000-0000-0000-000000000003'), 'owner_a: can_read_company(company_b1) deve ser false (outro workspace)');
  perform assert_true(can_write_company('e2000000-0000-0000-0000-000000000001'), 'owner_a: can_write_company(company_a1) deve ser true');
  perform assert_true(can_admin_company('e2000000-0000-0000-0000-000000000001'), 'owner_a: can_admin_company(company_a1) deve ser true');
  perform assert_true(can_close_period('e2000000-0000-0000-0000-000000000001'), 'owner_a: can_close_period(company_a1) deve ser true');
  perform reset_test_auth();

  perform set_test_auth('e3000000-0000-0000-0000-000000000003'); -- accountant_a1
  perform assert_true(current_profile_id() = 'e4000000-0000-0000-0000-000000000003', 'accountant_a1: current_profile_id() deve resolver o profile correto');
  perform assert_false(is_workspace_member('e1000000-0000-0000-0000-000000000001'), 'accountant_a1: is_workspace_member(ws_a) deve ser false (sem vínculo direto de workspace)');
  perform assert_true(is_company_member('e2000000-0000-0000-0000-000000000001'), 'accountant_a1: is_company_member(company_a1) deve ser true');
  perform assert_true(has_company_role('e2000000-0000-0000-0000-000000000001', array['ACCOUNTANT']::company_role[]), 'accountant_a1: has_company_role(company_a1, [ACCOUNTANT]) deve ser true');
  perform assert_true(can_read_company('e2000000-0000-0000-0000-000000000001'), 'accountant_a1: can_read_company(company_a1) deve ser true');
  perform assert_false(can_read_company('e2000000-0000-0000-0000-000000000002'), 'accountant_a1: can_read_company(company_a2) deve ser false (sem papel de workspace nem vínculo direto)');
  perform assert_true(can_write_company('e2000000-0000-0000-0000-000000000001'), 'accountant_a1: can_write_company(company_a1) deve ser true');
  perform assert_true(can_admin_company('e2000000-0000-0000-0000-000000000001'), 'accountant_a1: can_admin_company(company_a1) deve ser true (ACCOUNTANT administra)');
  perform assert_true(can_close_period('e2000000-0000-0000-0000-000000000001'), 'accountant_a1: can_close_period(company_a1) deve ser true');
  perform reset_test_auth();

  perform set_test_auth('e3000000-0000-0000-0000-000000000004'); -- assistant_a1
  perform assert_true(can_read_company('e2000000-0000-0000-0000-000000000001'), 'assistant_a1: can_read_company(company_a1) deve ser true');
  perform assert_true(can_write_company('e2000000-0000-0000-0000-000000000001'), 'assistant_a1: can_write_company(company_a1) deve ser true (ASSISTANT escreve operacional)');
  perform assert_false(can_admin_company('e2000000-0000-0000-0000-000000000001'), 'assistant_a1: can_admin_company(company_a1) deve ser false (ASSISTANT nunca administra)');
  perform assert_false(can_close_period('e2000000-0000-0000-0000-000000000001'), 'assistant_a1: can_close_period(company_a1) deve ser false');
  perform reset_test_auth();

  perform set_test_auth('e3000000-0000-0000-0000-000000000005'); -- client_viewer_a1
  perform assert_true(can_read_company('e2000000-0000-0000-0000-000000000001'), 'client_viewer_a1: can_read_company(company_a1) deve ser true');
  perform assert_false(can_write_company('e2000000-0000-0000-0000-000000000001'), 'client_viewer_a1: can_write_company(company_a1) deve ser false');
  perform assert_false(can_admin_company('e2000000-0000-0000-0000-000000000001'), 'client_viewer_a1: can_admin_company(company_a1) deve ser false');
  perform reset_test_auth();

  perform set_test_auth('e3000000-0000-0000-0000-000000000006'); -- viewer_a1 (workspace ASSISTANT, sem vínculo de empresa)
  perform assert_true(is_workspace_member('e1000000-0000-0000-0000-000000000001'), 'viewer_a1: is_workspace_member(ws_a) deve ser true');
  perform assert_false(can_admin_workspace('e1000000-0000-0000-0000-000000000001'), 'viewer_a1: can_admin_workspace(ws_a) deve ser false (ASSISTANT não administra workspace)');
  perform assert_false(can_read_company('e2000000-0000-0000-0000-000000000001'), 'viewer_a1: can_read_company(company_a1) deve ser false (ASSISTANT de workspace sem vínculo de empresa = zero acesso operacional)');
  perform reset_test_auth();

  perform set_test_auth('e3000000-0000-0000-0000-000000000007'); -- no_access
  perform assert_true(current_profile_id() = 'e4000000-0000-0000-0000-000000000007', 'no_access: current_profile_id() ainda deve resolver (profile existe, só sem vínculos)');
  perform assert_false(is_workspace_member('e1000000-0000-0000-0000-000000000001'), 'no_access: is_workspace_member(ws_a) deve ser false');
  perform assert_false(can_read_company('e2000000-0000-0000-0000-000000000001'), 'no_access: can_read_company(company_a1) deve ser false');
  perform assert_false(can_read_company('e2000000-0000-0000-0000-000000000002'), 'no_access: can_read_company(company_a2) deve ser false');
  perform assert_false(can_read_company('e2000000-0000-0000-0000-000000000003'), 'no_access: can_read_company(company_b1) deve ser false');
  perform reset_test_auth();

  raise notice '--- Bloco 2 concluído: funções auxiliares de autorização validadas ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 1 — Usuário sem vínculo (no_access)
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000007');

  perform assert_count((select count(*) from workspaces where id in ('e1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000002')), 0, 'Cenário 1: no_access não lê nenhum dos 2 workspaces de teste');
  perform assert_count((select count(*) from companies where id in ('e2000000-0000-0000-0000-000000000001','e2000000-0000-0000-0000-000000000002','e2000000-0000-0000-0000-000000000003')), 0, 'Cenário 1: no_access não lê nenhuma das 3 empresas de teste');
  perform assert_count((select count(*) from partners where company_id in ('e2000000-0000-0000-0000-000000000001','e2000000-0000-0000-0000-000000000002','e2000000-0000-0000-0000-000000000003')), 0, 'Cenário 1: no_access não lê nenhum partner de teste');

  perform assert_write_blocked(
    format('insert into partners (workspace_id, company_id, name, is_customer) values (%L, %L, %L, true)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'Tentativa no_access'),
    'Cenário 1: no_access não insere partner em company_a1'
  );
  perform assert_write_blocked(
    format('insert into items (workspace_id, company_id, code, name, item_type) values (%L, %L, %L, %L, %L)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'X', 'X', 'SERVICE'),
    'Cenário 1: no_access não insere item em company_a1'
  );
  perform assert_write_blocked(
    format('insert into bank_accounts (workspace_id, company_id, chart_account_id, bank_name, account_type) values (%L, %L, %L, %L, %L)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'X', 'CHECKING'),
    'Cenário 1: no_access não insere bank_account em company_a1'
  );

  perform reset_test_auth();
  raise notice '--- Cenário 1 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 2 — Owner/Admin do Workspace A
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000001'); -- owner_a

  perform assert_count((select count(*) from workspaces where id = 'e1000000-0000-0000-0000-000000000001'), 1, 'Cenário 2: owner_a lê workspace A');
  perform assert_count((select count(*) from workspaces where id = 'e1000000-0000-0000-0000-000000000002'), 0, 'Cenário 2: owner_a não lê workspace B');
  perform assert_count((select count(*) from companies where workspace_id = 'e1000000-0000-0000-0000-000000000001'), 2, 'Cenário 2: owner_a lê as 2 empresas do workspace A');
  perform assert_count((select count(*) from companies where id = 'e2000000-0000-0000-0000-000000000003'), 0, 'Cenário 2: owner_a não lê company B1');

  perform assert_write_succeeds(
    format('insert into company_users (id, company_id, profile_id, role) values (%L, %L, %L, %L)',
      gen_random_uuid(), 'e2000000-0000-0000-0000-000000000002', 'e4000000-0000-0000-0000-000000000001', 'ACCOUNTANT'),
    'Cenário 2: owner_a consegue gerenciar (inserir) company_users em empresa do próprio workspace'
  );

  perform assert_write_blocked(
    format('update workspaces set name = %L where id = %L', 'Hackeado', 'e1000000-0000-0000-0000-000000000002'),
    'Cenário 2: owner_a não consegue administrar (UPDATE) workspace B'
  );
  perform assert_write_blocked(
    format('insert into company_users (id, company_id, profile_id, role) values (%L, %L, %L, %L)',
      gen_random_uuid(), 'e2000000-0000-0000-0000-000000000003', 'e4000000-0000-0000-0000-000000000001', 'ACCOUNTANT'),
    'Cenário 2: owner_a não consegue gerenciar company_users de empresa de outro workspace (company_b1)'
  );

  perform reset_test_auth();
  raise notice '--- Cenário 2 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 3 — Usuário com vínculo apenas em company_a1
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000003'); -- accountant_a1

  perform assert_count((select count(*) from companies where id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 3: accountant_a1 lê company_a1');
  perform assert_count((select count(*) from companies where id = 'e2000000-0000-0000-0000-000000000002'), 0, 'Cenário 3: accountant_a1 NÃO lê company_a2 (mesmo workspace, sem papel de workspace nem vínculo direto)');
  perform assert_count((select count(*) from companies where id = 'e2000000-0000-0000-0000-000000000003'), 0, 'Cenário 3: accountant_a1 não lê company_b1');

  perform assert_count((select count(*) from partners where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 3: accountant_a1 lê partners de company_a1');
  perform assert_count((select count(*) from partners where company_id = 'e2000000-0000-0000-0000-000000000002'), 0, 'Cenário 3: accountant_a1 não lê partners de company_a2');
  perform assert_count((select count(*) from partners where company_id = 'e2000000-0000-0000-0000-000000000003'), 0, 'Cenário 3: accountant_a1 não lê partners de company_b1');

  perform assert_count((select count(*) from cost_centers where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 3: accountant_a1 lê cost_centers de company_a1');
  perform assert_count((select count(*) from cost_centers where company_id in ('e2000000-0000-0000-0000-000000000002','e2000000-0000-0000-0000-000000000003')), 0, 'Cenário 3: accountant_a1 não lê cost_centers de a2/b1');

  perform assert_count((select count(*) from journal_entries where company_id = 'e2000000-0000-0000-0000-000000000001'), 2, 'Cenário 3: accountant_a1 lê os 2 journal_entries de teste de company_a1');

  perform reset_test_auth();

  -- Persona "viewer_a1" (ASSISTANT de workspace, sem vínculo direto de empresa) —
  -- confirma na prática, via SELECT real, o resultado já validado no Bloco 2.
  perform set_test_auth('e3000000-0000-0000-0000-000000000006');
  perform assert_count((select count(*) from companies), 0, 'Cenário 3: viewer_a1 (workspace ASSISTANT sem vínculo de empresa) não lê NENHUMA empresa');
  perform assert_count((select count(*) from partners), 0, 'Cenário 3: viewer_a1 não lê nenhum partner');

  perform reset_test_auth();
  raise notice '--- Cenário 3 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 4 — ACCOUNTANT da empresa
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000003'); -- accountant_a1

  perform assert_write_succeeds(
    format('insert into partners (workspace_id, company_id, name, is_customer) values (%L, %L, %L, true)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'Novo Parceiro Accountant'),
    'Cenário 4: accountant_a1 consegue INSERT em partners (company_a1)'
  );
  perform assert_write_succeeds(
    format('update partners set notes = %L where id = %L', 'Editado por accountant_a1', 'e7000000-0000-0000-0000-000000000001'),
    'Cenário 4: accountant_a1 consegue UPDATE em partners (company_a1)'
  );
  perform assert_write_succeeds(
    format('insert into chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries) values (%L, %L, %L, %L, %L, %L, false, true)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', '1.2', 'Conta Nova Accountant', 'ASSET', 'DEBIT'),
    'Cenário 4: accountant_a1 consegue INSERT em chart_accounts (can_admin_company)'
  );
  perform assert_write_succeeds(
    format('update accounting_periods set status = %L where id = %L and status = %L', 'IN_REVIEW', 'e8000000-0000-0000-0000-000000000001', 'OPEN'),
    'Cenário 4: accountant_a1 consegue fechar/alterar status de accounting_periods (can_close_period)'
  );
  -- Devolve o período para OPEN (necessário para os cenários seguintes).
  update accounting_periods set status = 'OPEN' where id = 'e8000000-0000-0000-0000-000000000001';

  perform reset_test_auth();
  raise notice '--- Cenário 4 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 5 — ASSISTANT da empresa
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000004'); -- assistant_a1

  perform assert_write_succeeds(
    format('insert into partners (workspace_id, company_id, name, is_customer) values (%L, %L, %L, true)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'Novo Parceiro Assistant'),
    'Cenário 5: assistant_a1 consegue INSERT em partners (operação básica permitida)'
  );
  perform assert_write_blocked(
    format('update accounting_periods set status = %L where id = %L', 'CLOSED', 'e8000000-0000-0000-0000-000000000001'),
    'Cenário 5: assistant_a1 NÃO consegue fechar período (can_close_period exige ACCOUNTANT/OWNER/ADMIN)'
  );
  perform assert_write_blocked(
    format('update chart_accounts set name = %L where id = %L', 'Hackeado por assistant', 'e5000000-0000-0000-0000-000000000001'),
    'Cenário 5: assistant_a1 NÃO consegue alterar chart_accounts (can_admin_company exige ACCOUNTANT/OWNER/ADMIN)'
  );
  -- "Efetivar" (DRAFT -> POSTED) é tratado no desenho da RLS como operação BÁSICA de
  -- escrita (can_write_company), não como operação administrativa — ASSISTANT DEVE
  -- conseguir postar. Usamos o segundo lançamento (e9000000-...0002) para não alterar o
  -- estado que o Cenário 8 pressupõe DRAFT no primeiro lançamento.
  perform assert_write_succeeds(
    format('update journal_entries set status = %L where id = %L', 'POSTED', 'e9000000-0000-0000-0000-000000000002'),
    'Cenário 5: assistant_a1 CONSEGUE efetivar (DRAFT->POSTED) um lançamento — operação básica, coberta por can_write_company'
  );
  -- Uma vez POSTED, o lançamento é terminal para UPDATE direto (USING exige status em
  -- DRAFT/PENDING_CLASSIFICATION) — nem o próprio assistant_a1 consegue alterá-lo mais.
  perform assert_write_blocked(
    format('update journal_entries set description = %L where id = %L', 'Tentativa pós-POSTED', 'e9000000-0000-0000-0000-000000000002'),
    'Cenário 5: assistant_a1 NÃO consegue mais alterar o lançamento depois de POSTED (estado terminal para UPDATE direto)'
  );
  perform assert_write_blocked(
    format('insert into bank_accounts (workspace_id, company_id, chart_account_id, bank_name, account_type) values (%L, %L, %L, %L, %L)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'Banco Assistant', 'CHECKING'),
    'Cenário 5: assistant_a1 NÃO consegue criar bank_accounts (can_admin_company, mais restritivo que items/partners)'
  );

  perform reset_test_auth();
  raise notice '--- Cenário 5 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 6 — CLIENT_VIEWER
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000005'); -- client_viewer_a1

  perform assert_true((select count(*) from partners where company_id = 'e2000000-0000-0000-0000-000000000001') > 0, 'Cenário 6: client_viewer_a1 consegue SELECT e enxerga ao menos 1 partner de company_a1');

  perform assert_write_blocked(
    format('insert into partners (workspace_id, company_id, name, is_customer) values (%L, %L, %L, true)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'Tentativa Client Viewer'),
    'Cenário 6: client_viewer_a1 NÃO consegue INSERT em partners'
  );
  perform assert_write_blocked(
    format('update partners set notes = %L where id = %L', 'Editado por client_viewer', 'e7000000-0000-0000-0000-000000000001'),
    'Cenário 6: client_viewer_a1 NÃO consegue UPDATE em partners'
  );
  perform assert_write_blocked(
    format('delete from partners where id = %L', 'e7000000-0000-0000-0000-000000000001'),
    'Cenário 6: client_viewer_a1 NÃO consegue DELETE em partners'
  );
  perform assert_write_blocked(
    format('insert into journal_entries (workspace_id, company_id, entry_date, competence, description, origin, status) values (%L, %L, current_date, date_trunc(''month'', current_date)::date, %L, %L, %L)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'Tentativa client_viewer', 'MANUAL', 'DRAFT'),
    'Cenário 6: client_viewer_a1 NÃO consegue INSERT em journal_entries'
  );
  perform assert_write_blocked(
    format('update accounting_periods set status = %L where id = %L', 'CLOSED', 'e8000000-0000-0000-0000-000000000001'),
    'Cenário 6: client_viewer_a1 NÃO consegue alterar accounting_periods'
  );
  perform assert_write_blocked(
    format('insert into chart_accounts (workspace_id, company_id, code, name, account_type, normal_balance, is_synthetic, accepts_entries) values (%L, %L, %L, %L, %L, %L, false, true)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', '1.9', 'Tentativa Client Viewer', 'ASSET', 'DEBIT'),
    'Cenário 6: client_viewer_a1 NÃO consegue INSERT em chart_accounts'
  );

  perform reset_test_auth();
  raise notice '--- Cenário 6 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 7 — Isolamento cross-company (casos adicionais)
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000003'); -- accountant_a1

  perform assert_count((select count(*) from partners where company_id = 'e2000000-0000-0000-0000-000000000003'), 0, 'Cenário 7: SELECT em partners de company_b1 (outra empresa/workspace) retorna 0');

  perform assert_write_blocked(
    format('insert into partners (workspace_id, company_id, name, is_customer) values (%L, %L, %L, true)',
      'e1000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000003', 'Tentativa cross-company'),
    'Cenário 7: INSERT com company_id de outra empresa (company_b1) falha'
  );

  -- UPDATE tentando mover um partner PRÓPRIO (company_a1) para outra empresa (company_b1)
  -- deve falhar pelo trigger fn_prevent_tenant_change (erp_rls_v1.sql Bloco 1.1), que
  -- bloqueia qualquer troca de company_id independentemente da RLS.
  perform assert_write_blocked(
    format('update partners set company_id = %L where id = %L', 'e2000000-0000-0000-0000-000000000003', 'e7000000-0000-0000-0000-000000000001'),
    'Cenário 7: UPDATE tentando alterar company_id de registro próprio para outra empresa falha (fn_prevent_tenant_change)'
  );

  -- UPDATE em registro de OUTRA empresa (sem tentar mudar company_id) afeta 0 linhas —
  -- a linha nem é visível para o UPDATE via USING(can_write_company(company_id)).
  perform assert_write_blocked(
    format('update partners set notes = %L where id = %L', 'Tentativa', 'e7000000-0000-0000-0000-000000000003'),
    'Cenário 7: UPDATE em partner de company_b1 (não mudando company_id) afeta 0 linhas'
  );

  perform reset_test_auth();
  raise notice '--- Cenário 7 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 8 — Tabelas filhas
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000003'); -- accountant_a1

  perform assert_count((select count(*) from journal_entry_lines where journal_entry_id = 'e9000000-0000-0000-0000-000000000001'), 2, 'Cenário 8: accountant_a1 lê as 2 linhas do lançamento de teste (via journal_entries)');
  perform assert_write_succeeds(
    format('update journal_entry_lines set memo = %L where journal_entry_id = %L and debit_credit = %L', 'Editado (DRAFT)', 'e9000000-0000-0000-0000-000000000001', 'DEBIT'),
    'Cenário 8: accountant_a1 consegue UPDATE em journal_entry_lines enquanto o lançamento pai é DRAFT'
  );

  perform assert_count((select count(*) from fiscal_document_items where fiscal_document_id = 'ed000000-0000-0000-0000-000000000001'), 1, 'Cenário 8: accountant_a1 lê o item do documento fiscal de teste (via fiscal_documents)');
  perform assert_write_succeeds(
    format('update fiscal_document_items set description = %L where fiscal_document_id = %L', 'Editado (DRAFT)', 'ed000000-0000-0000-0000-000000000001'),
    'Cenário 8: accountant_a1 consegue UPDATE em fiscal_document_items enquanto o documento pai é DRAFT'
  );

  perform reset_test_auth();

  -- Do lado de fora (client_viewer_a1): mesmo tendo can_read_company(company_a1)=true,
  -- não deve conseguir escrever nas tabelas filhas.
  perform set_test_auth('e3000000-0000-0000-0000-000000000005'); -- client_viewer_a1
  perform assert_count((select count(*) from journal_entry_lines where journal_entry_id = 'e9000000-0000-0000-0000-000000000001'), 2, 'Cenário 8: client_viewer_a1 também LÊ as linhas do lançamento (SELECT liberado por can_read_company)');
  perform assert_write_blocked(
    format('delete from journal_entry_lines where journal_entry_id = %L', 'e9000000-0000-0000-0000-000000000001'),
    'Cenário 8: client_viewer_a1 NÃO consegue DELETE em journal_entry_lines'
  );

  perform reset_test_auth();
  raise notice '--- Cenário 8 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 9 — Auditoria/Logs
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000005'); -- client_viewer_a1
  perform assert_count((select count(*) from audit_logs where company_id = 'e2000000-0000-0000-0000-000000000001'), 0, 'Cenário 9: client_viewer_a1 NÃO lê audit_logs da própria empresa');
  perform reset_test_auth();

  perform set_test_auth('e3000000-0000-0000-0000-000000000004'); -- assistant_a1
  perform assert_count((select count(*) from audit_logs where company_id = 'e2000000-0000-0000-0000-000000000001'), 0, 'Cenário 9: assistant_a1 NÃO lê audit_logs da própria empresa');
  perform reset_test_auth();

  perform set_test_auth('e3000000-0000-0000-0000-000000000003'); -- accountant_a1
  perform assert_true((select count(*) from audit_logs where company_id = 'e2000000-0000-0000-0000-000000000001') > 0, 'Cenário 9: accountant_a1 LÊ audit_logs da própria empresa');
  perform assert_write_blocked(
    format('insert into audit_logs (id, workspace_id, company_id, action, entity_type, entity_id) values (%L, %L, %L, %L, %L, %L)',
      gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'TEST_EVENT', 'partners', 'e7000000-0000-0000-0000-000000000001'),
    'Cenário 9: accountant_a1 NÃO consegue INSERT direto em audit_logs (sem policy de insert — só service_role)'
  );
  perform reset_test_auth();

  perform set_test_auth('e3000000-0000-0000-0000-000000000001'); -- owner_a
  perform assert_true((select count(*) from audit_logs where company_id = 'e2000000-0000-0000-0000-000000000001') > 0, 'Cenário 9: owner_a (workspace) LÊ audit_logs da empresa do próprio workspace');
  perform reset_test_auth();

  raise notice '--- Cenário 9 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 10 — Tabelas globais (account_templates, states, municipalities)
  ------------------------------------------------------------------------------------
  -- Mesmo o persona SEM NENHUM vínculo enxerga o catálogo global — é exatamente esse o
  -- desenho documentado ("leitura liberada a qualquer usuário autenticado").

  perform set_test_auth('e3000000-0000-0000-0000-000000000007'); -- no_access

  perform assert_write_blocked(
    format('insert into account_templates (name, tax_regime, company_profile) values (%L, %L, %L)', 'Template Hostil', 'LUCRO_REAL', 'SERVICES'),
    'Cenário 10: no_access NÃO consegue INSERT em account_templates (catálogo global, só migração/service_role)'
  );

  -- SELECT não deve lançar erro de permissão, independentemente de a tabela estar vazia
  -- neste banco descartável — o que importa é que "using (true)" não filtra por vínculo.
  perform count(*) from account_templates;
  raise notice 'OK: Cenário 10: no_access consegue SELECT em account_templates sem erro de permissão';

  perform count(*) from states;
  raise notice 'OK: Cenário 10: no_access consegue SELECT em states sem erro de permissão';

  perform assert_write_blocked(
    format('insert into states (uf, name) values (%L, %L)', 'ZZ', 'Estado Hostil'),
    'Cenário 10: no_access NÃO consegue INSERT em states (catálogo global v1.2, só migração/seed)'
  );

  perform count(*) from municipalities;
  raise notice 'OK: Cenário 10: no_access consegue SELECT em municipalities sem erro de permissão';

  perform reset_test_auth();
  raise notice '--- Cenário 10 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 11 — Cadastros Base v1.2 (partners/items/fiscal_operation_natures/bank_accounts)
  ------------------------------------------------------------------------------------
  -- partners já foi exercitado nos cenários 4/5/6 (INSERT/UPDATE por ACCOUNTANT/
  -- ASSISTANT, bloqueio para CLIENT_VIEWER). Este bloco fecha a cobertura específica de
  -- items/fiscal_operation_natures/bank_accounts com SELECT cross-company e confirma
  -- ausência de policy de DELETE nas 4 tabelas.

  perform set_test_auth('e3000000-0000-0000-0000-000000000003'); -- accountant_a1

  perform assert_count((select count(*) from items where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 11: accountant_a1 lê items de company_a1');
  perform assert_count((select count(*) from items where company_id in ('e2000000-0000-0000-0000-000000000002','e2000000-0000-0000-0000-000000000003')), 0, 'Cenário 11: accountant_a1 não lê items de a2/b1');

  perform assert_count((select count(*) from fiscal_operation_natures where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 11: accountant_a1 lê fiscal_operation_natures de company_a1');
  perform assert_count((select count(*) from bank_accounts where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 11: accountant_a1 lê bank_accounts de company_a1');

  perform assert_write_succeeds(
    format('insert into fiscal_operation_natures (workspace_id, company_id, code, name, direction, is_active) values (%L, %L, %L, %L, %L, true)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'NAT-2', 'Segunda Natureza Teste', 'INBOUND'),
    'Cenário 11: accountant_a1 consegue INSERT em fiscal_operation_natures (can_write_company)'
  );
  perform assert_write_succeeds(
    format('insert into bank_accounts (workspace_id, company_id, chart_account_id, bank_name, account_type) values (%L, %L, %L, %L, %L)',
      'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'Segundo Banco Teste', 'SAVINGS'),
    'Cenário 11: accountant_a1 consegue INSERT em bank_accounts (can_admin_company)'
  );

  perform assert_write_blocked(
    format('delete from items where id = %L', 'ea000000-0000-0000-0000-000000000001'),
    'Cenário 11: DELETE físico em items é bloqueado (sem policy de delete — soft delete via active=false)'
  );
  perform assert_write_blocked(
    format('delete from bank_accounts where id = %L', 'ec000000-0000-0000-0000-000000000001'),
    'Cenário 11: DELETE físico em bank_accounts é bloqueado (sem policy de delete)'
  );

  perform reset_test_auth();
  raise notice '--- Cenário 11 concluído ---';


  ------------------------------------------------------------------------------------
  -- CENÁRIO 12 — Módulos Fiscal, Apurações, Obrigações, Patrimônio e Bancos (Etapas 19-24)
  ------------------------------------------------------------------------------------

  perform set_test_auth('e3000000-0000-0000-0000-000000000003'); -- accountant_a1

  -- 12.1. Fiscal Document Retentions & Items
  perform assert_count((select count(*) from fiscal_document_retentions where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 12.1: accountant_a1 lê fiscal_document_retentions de company_a1');
  perform assert_count((select count(*) from fiscal_document_retentions where company_id = 'e2000000-0000-0000-0000-000000000003'), 0, 'Cenário 12.1: accountant_a1 não lê retensões de company_b1');

  perform assert_write_succeeds(
    format('insert into fiscal_document_retentions (id, workspace_id, company_id, fiscal_document_id, tax_type, base_amount, amount) values (%L, %L, %L, %L, %L, 200.00, 10.00)',
      gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000001', 'ISS'),
    'Cenário 12.1: accountant_a1 CONSEGUE criar retenção se o documento pai estiver em status editável (DRAFT)'
  );

  perform assert_write_blocked(
    format('insert into fiscal_document_retentions (id, workspace_id, company_id, fiscal_document_id, tax_type, base_amount, amount) values (%L, %L, %L, %L, %L, 200.00, 10.00)',
      gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'ed000000-0000-0000-0000-000000000002', 'ISS'),
    'Cenário 12.1: accountant_a1 NÃO consegue criar retenção se o documento pai estiver em status restrito (BOOKED) — validação da subquery de status na policy de INSERT'
  );

  -- 12.2. Tax Assessments & Lines
  perform assert_count((select count(*) from tax_assessments where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 12.2: accountant_a1 lê apurações (tax_assessments) de company_a1');
  perform assert_count((select count(*) from tax_assessment_lines where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 12.2: accountant_a1 lê linhas de apuração de company_a1');

  perform assert_write_succeeds(
    format('insert into tax_assessment_lines (id, workspace_id, company_id, tax_assessment_id, description, amount) values (%L, %L, %L, %L, %L, 50.00)',
      gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'ef000000-0000-0000-0000-000000000001', 'Nova linha de teste RLS'),
    'Cenário 12.2: accountant_a1 CONSEGUE criar linha de apuração se a apuração pai estiver em status editável (DRAFT)'
  );

  -- 12.3. Obligations
  perform assert_count((select count(*) from obligations where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 12.3: accountant_a1 lê obrigações (obligations) de company_a1');
  perform assert_count((select count(*) from obligations where company_id = 'e2000000-0000-0000-0000-000000000003'), 0, 'Cenário 12.3: accountant_a1 não lê obrigações de company_b1');

  perform assert_write_succeeds(
    format('insert into obligations (id, workspace_id, company_id, obligation_type, competence, amount, due_date, status) values (%L, %L, %L, %L, date_trunc(''month'', current_date)::date, 250.00, current_date + interval ''15 days'', %L)',
      gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'ICMS', 'OPEN'),
    'Cenário 12.3: accountant_a1 consegue INSERT em obligations (company_a1)'
  );

  -- 12.4. Fixed Assets & Asset Depreciations
  perform assert_count((select count(*) from fixed_assets where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 12.4: accountant_a1 lê bens (fixed_assets) de company_a1');
  perform assert_count((select count(*) from asset_depreciations where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 12.4: accountant_a1 lê depreciações de company_a1');

  perform assert_write_succeeds(
    format('insert into asset_categories (id, workspace_id, company_id, name, default_useful_life_months, default_annual_rate, default_depreciation_account_id, default_expense_account_id, depreciation_start_rule) values (%L, %L, %L, %L, 120, 10.00, %L, %L, %L)',
      gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'Categoria 2', 'e5000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000002', 'NEXT_MONTH'),
    'Cenário 12.4: accountant_a1 consegue INSERT em asset_categories (company_a1)'
  );

  perform assert_write_blocked(
    format('delete from fixed_assets where id = %L', 'f2000000-0000-0000-0000-000000000001'),
    'Cenário 12.4: accountant_a1 NÃO consegue DELETE físico de fixed_assets ativo (status = ACTIVE) — DELETE só permitido para status = DRAFT'
  );

  -- 12.5. Bank Statement Lines & Reconciliations
  perform assert_count((select count(*) from bank_statement_lines where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 12.5: accountant_a1 lê bank_statement_lines de company_a1');
  perform assert_count((select count(*) from bank_reconciliations where company_id = 'e2000000-0000-0000-0000-000000000001'), 1, 'Cenário 12.5: accountant_a1 lê bank_reconciliations de company_a1');

  perform assert_write_succeeds(
    format('insert into bank_statement_lines (id, workspace_id, company_id, bank_statement_import_id, bank_account_id, entry_date, description, amount, hash, status) values (%L, %L, %L, %L, %L, current_date, %L, 100.00, %L, %L)',
      gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000001', 'ec000000-0000-0000-0000-000000000001', 'Outro movimento', 'hash_outro_rls', 'PENDING'),
    'Cenário 12.5: accountant_a1 consegue INSERT em bank_statement_lines (company_a1)'
  );

  perform reset_test_auth();

  -- 12.6. Client Viewer (Leitura sim, escrita não)
  perform set_test_auth('e3000000-0000-0000-0000-000000000005'); -- client_viewer_a1
  perform assert_count((select count(*) from obligations where company_id = 'e2000000-0000-0000-0000-000000000001'), 2, 'Cenário 12.6: client_viewer_a1 lê as 2 obrigações de company_a1');

  perform assert_write_blocked(
    format('insert into obligations (id, workspace_id, company_id, obligation_type, due_date, amount, status) values (%L, %L, %L, %L, current_date, 100.00, %L)',
      gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'ISS', 'OPEN'),
    'Cenário 12.6: client_viewer_a1 NÃO consegue INSERT em obligations'
  );

  perform reset_test_auth();
  raise notice '--- Cenário 12 concluído ---';


  ------------------------------------------------------------------------------------
  -- RESUMO
  ------------------------------------------------------------------------------------

  raise notice '=====================================================================================';
  raise notice '  TODOS OS CENÁRIOS DE ISOLAMENTO E RLS PASSARAM SEM FALHAS.';
  raise notice '  Nenhum dado foi persistido — esta transação termina com ROLLBACK.';
  raise notice '=====================================================================================';

end;
$test_suite$;

rollback;
