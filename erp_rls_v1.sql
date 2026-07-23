-- =====================================================================================
-- ERP CONTÁBIL — MIGRAÇÃO DE ROW LEVEL SECURITY — v1
-- Aplica-se sobre erp_schema_v1_1.sql (41 tabelas, 25 enums, todas já com RLS HABILITADA
-- e ZERO policies — ou seja, hoje tudo está bloqueado para "authenticated"/"anon").
-- =====================================================================================
-- Escopo desta migração: SOMENTE funções auxiliares de autorização, policies, grants
-- mínimos, comentários de segurança e testes básicos de isolamento. Sem frontend, sem
-- Server Actions. O schema estrutural NÃO é reescrito — os únicos ajustes feitos (Bloco
-- 1) são patches mínimos e aditivos, todos justificados por uma lacuna que tornaria a
-- RLS inaplicável ou insegura (ver comentário "LACUNA CRÍTICA" em cada um).
-- =====================================================================================


-- =====================================================================================
-- BLOCO 0 — ADAPTAÇÕES DE PAPEL (registro obrigatório da divergência com o pedido)
-- =====================================================================================
-- O pedido descreve:
--   workspace_role: OWNER, ADMIN, ACCOUNTANT, ASSISTANT, VIEWER
--   company_role:   ACCOUNTANT, ASSISTANT, CLIENT_VIEWER, CLIENT_ADMIN
--
-- O schema real (erp_schema_v1_1.sql) tem:
--   workspace_role: OWNER, ADMIN, ACCOUNTANT, ASSISTANT           (sem VIEWER)
--   company_role:   ACCOUNTANT, ASSISTANT, CLIENT_VIEWER          (sem CLIENT_ADMIN)
--
-- DECISÃO: NÃO adicionei os valores faltantes via ALTER TYPE ... ADD VALUE.
-- Motivo técnico: o Postgres proíbe usar um valor de enum recém-adicionado na MESMA
-- transação em que ele foi criado ("unsafe use of new value of enum type"). Como esta
-- migração inteira roda como uma transação, eu precisaria adicionar os valores num
-- arquivo/migração ANTERIOR e só então referenciá-los aqui — dois passos, dois deploys.
-- Isso não é o que eu chamaria de "lacuna crítica necessária para RLS": as regras que
-- os dois papéis ausentes descreveriam já têm um análogo funcional no schema atual:
--   - workspace "VIEWER" → não implementado. Hoje ASSISTANT já é o papel de workspace
--     mais baixo, e por si só (sem vínculo em company_users) NÃO dá acesso operacional
--     nenhum, exatamente o que "VIEWER" pediria. Se um papel de workspace só-leitura
--     dedicado for necessário depois, ele deve ser adicionado por uma migração PRÉVIA
--     e isolada (só o ALTER TYPE, sem mais nada), seguida por esta.
--   - company "CLIENT_ADMIN" → tratado como CLIENT_VIEWER (somente leitura), seguindo
--     literalmente a sua própria instrução de fallback ("Se não estiver claro no
--     schema, trate como leitura no MVP"). Não há CLIENT_ADMIN neste MVP.
-- Ambas as adaptações estão refletidas nas funções can_write_company/can_admin_company
-- abaixo — nenhum papel "CLIENT_ADMIN" aparece nelas porque ele simplesmente não existe
-- ainda no domínio do enum.


-- =====================================================================================
-- BLOCO 1 — AJUSTES MÍNIMOS AO SCHEMA (lacunas críticas para RLS funcionar com segurança)
-- =====================================================================================

-- ---------------------------------------------------------------------------------
-- 1.1 — LACUNA CRÍTICA: nada impede trocar company_id/workspace_id de uma linha via
-- UPDATE. RLS não consegue expressar "NEW.company_id = OLD.company_id" sozinha (USING
-- só vê a linha antiga, WITH CHECK só vê a nova — não há como comparar as duas dentro
-- de uma única policy). Sem esta trava, um UPDATE poderia "mover" um lançamento, bem
-- patrimonial etc. para outra empresa/escritório que o usuário também tenha acesso de
-- escrita, corrompendo a rastreabilidade e os triggers de consistência já existentes
-- (que assumem company_id estável). Corrigido com um único trigger genérico, anexado
-- dinamicamente a toda tabela que tenha as colunas company_id e/ou workspace_id.
-- ---------------------------------------------------------------------------------

create or replace function fn_prevent_tenant_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (to_jsonb(old) ? 'company_id') and (to_jsonb(new)->>'company_id') is distinct from (to_jsonb(old)->>'company_id') then
    raise exception 'Não é permitido alterar company_id de um registro existente.'
      using errcode = '23514';
  end if;
  if (to_jsonb(old) ? 'workspace_id') and (to_jsonb(new)->>'workspace_id') is distinct from (to_jsonb(old)->>'workspace_id') then
    raise exception 'Não é permitido alterar workspace_id de um registro existente.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function fn_prevent_tenant_change() is 'Bloqueia UPDATE que troque company_id/workspace_id de qualquer linha. Anexado dinamicamente (ver DO block abaixo) a toda tabela com essas colunas — supre uma limitação estrutural da RLS (não há como comparar OLD vs NEW dentro de uma única policy).';

do $$
declare
  r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_name = c.table_name and t.table_schema = c.table_schema
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.column_name in ('company_id', 'workspace_id')
    group by c.table_name
  loop
    execute format('drop trigger if exists trg_%s_prevent_tenant_change on %I;', r.table_name, r.table_name);
    execute format(
      'create trigger trg_%s_prevent_tenant_change before update on %I for each row execute function fn_prevent_tenant_change();',
      r.table_name, r.table_name
    );
  end loop;
end;
$$;


-- ---------------------------------------------------------------------------------
-- 1.2 — LACUNA CRÍTICA: next_journal_number() é SECURITY INVOKER. Uma vez que
-- company_journal_counters NÃO terá NENHUMA policy (fica travada — só a função deve
-- tocá-la, ver Bloco 4), um usuário "authenticated" efetivando um lançamento (que
-- dispara fn_validate_journal_entry -> next_journal_number -> INSERT/UPDATE em
-- company_journal_counters) teria esse INSERT/UPDATE barrado pela própria RLS, e todo
-- o fluxo de POSTED quebraria. A função precisa rodar com privilégio elevado para
-- tocar o contador independentemente da visibilidade RLS do chamador. Adicionamos
-- também uma checagem interna de autorização (can_write_company) — nunca conceda
-- SECURITY DEFINER sem um guard de permissão equivalente dentro da própria função.
-- ---------------------------------------------------------------------------------

create or replace function next_journal_number(p_company_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next bigint;
begin
  if not can_write_company(p_company_id) then
    raise exception 'Sem permissão para gerar numeração de lançamento nesta empresa.'
      using errcode = '42501';
  end if;

  insert into company_journal_counters (company_id, last_number)
  values (p_company_id, 1)
  on conflict (company_id) do update set last_number = company_journal_counters.last_number + 1, updated_at = now()
  returning last_number into v_next;

  return v_next;
end;
$$;

comment on function next_journal_number(uuid) is 'SECURITY DEFINER: precisa tocar company_journal_counters (tabela sem policies) independentemente da RLS do chamador. Guard interno (can_write_company) evita que isto vire um bypass amplo — só quem tem escrita na empresa pode consumir um número.';


-- ---------------------------------------------------------------------------------
-- 1.3 — LACUNA CRÍTICA: reverse_journal_entry() já era SECURITY DEFINER (necessário
-- para rodar a reversão como rotina de sistema), mas nesta etapa ela passa a ser
-- chamada diretamente por "authenticated" via RPC (é a "função controlada" que a
-- policy de UPDATE de journal_entries delega para estorno — ver Bloco 4). SECURITY
-- DEFINER ignora RLS por definição; sem uma checagem de permissão DENTRO da própria
-- função, QUALQUER usuário autenticado poderia estornar lançamentos de QUALQUER
-- empresa. Adicionado o guard can_close_period (mesma regra de quem pode fechar
-- período — estorno é uma operação do mesmo nível de sensibilidade).
-- ---------------------------------------------------------------------------------

create or replace function reverse_journal_entry(p_entry_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original journal_entries%rowtype;
  v_new_id uuid;
begin
  select * into v_original from journal_entries where id = p_entry_id for update;

  if not found then
    raise exception 'Lançamento % não encontrado.', p_entry_id;
  end if;

  -- Guard de autorização — obrigatório numa SECURITY DEFINER chamável por "authenticated".
  if not can_close_period(v_original.company_id) then
    raise exception 'Sem permissão para estornar lançamentos desta empresa.'
      using errcode = '42501';
  end if;

  if v_original.status <> 'POSTED' then
    raise exception 'Só é possível estornar um lançamento POSTED (status atual: %).', v_original.status;
  end if;

  perform assert_period_open(v_original.company_id, v_original.entry_date);

  v_new_id := gen_random_uuid();

  insert into journal_entries (
    id, workspace_id, company_id, establishment_id, entry_date, competence,
    description, document, partner_id, origin, origin_id, status, reversal_of_id, notes
  ) values (
    v_new_id, v_original.workspace_id, v_original.company_id, v_original.establishment_id,
    v_original.entry_date, v_original.competence,
    'ESTORNO — ' || v_original.description, v_original.document, v_original.partner_id,
    'REVERSAL', v_original.id, 'DRAFT', v_original.id, coalesce(p_reason, 'Estorno do lançamento nº ' || v_original.number)
  );

  insert into journal_entry_lines (workspace_id, company_id, journal_entry_id, account_id, debit_credit, amount, memo, cost_center_id)
  select
    workspace_id, company_id, v_new_id, account_id,
    case debit_credit when 'DEBIT' then 'CREDIT'::debit_credit else 'DEBIT'::debit_credit end,
    amount, memo, cost_center_id
  from journal_entry_lines
  where journal_entry_id = v_original.id;

  update journal_entries set status = 'POSTED' where id = v_new_id;

  update journal_entries
    set status = 'REVERSED', reversed_by_entry_id = v_new_id
    where id = v_original.id;

  return v_new_id;
end;
$$;

comment on function reverse_journal_entry(uuid, text) is 'Estorna um lançamento POSTED por reversão. SECURITY DEFINER + guard interno can_close_period (obrigatório: sem ele, qualquer "authenticated" estornaria qualquer empresa). Chamável via RPC pelo Contador; service_role também pode chamar (uso administrativo/backend).';


-- =====================================================================================
-- BLOCO 2 — FUNÇÕES AUXILIARES DE AUTORIZAÇÃO
-- =====================================================================================
-- Todas as funções de MEMBRESIA/PAPEL (is_workspace_member, has_workspace_role,
-- is_company_member, has_company_role e as que compõem a partir delas) são
-- SECURITY DEFINER. Motivo: elas leem workspace_users/company_users — tabelas que
-- TÊM SUAS PRÓPRIAS policies de RLS (Bloco 4). Se estas funções fossem SECURITY
-- INVOKER, chamá-las de DENTRO de uma policy de workspace_users criaria uma
-- dependência circular (a policy de leitura de workspace_users dependeria de uma
-- função que, por sua vez, precisa ler workspace_users sob a MESMA policy). O padrão
-- recomendado pela própria Supabase para "is_member_of()" é exatamente SECURITY
-- DEFINER com search_path fixo — é isso que fazemos aqui. O único dado exposto por
-- essas funções é um booleano (pertence/não pertence, tem/não tem o papel); elas
-- nunca retornam linhas ou dados sensíveis.

create or replace function auth_user_id()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select auth.uid();
$$;

comment on function auth_user_id() is 'Wrapper de auth.uid(). SECURITY INVOKER (padrão): não precisa de elevação, é só leitura de uma claim de sessão.';


create or replace function current_profile_id()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select id from profiles where auth_user_id = auth.uid();
$$;

comment on function current_profile_id() is 'profiles.id do usuário autenticado. SECURITY INVOKER: a policy de profiles ("ver o próprio perfil") já permite exatamente esta consulta, sem precisar de elevação.';


create or replace function is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from workspace_users wu
    where wu.workspace_id = p_workspace_id
      and wu.profile_id = current_profile_id()
  );
$$;

comment on function is_workspace_member(uuid) is 'true se o usuário autenticado pertence ao workspace. SECURITY DEFINER (ver nota do Bloco 2) — evita recursão com a policy de workspace_users.';


create or replace function has_workspace_role(p_workspace_id uuid, p_roles workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from workspace_users wu
    where wu.workspace_id = p_workspace_id
      and wu.profile_id = current_profile_id()
      and wu.role = any(p_roles)
  );
$$;

comment on function has_workspace_role(uuid, workspace_role[]) is 'true se o usuário tem um dos papéis informados no workspace. SECURITY DEFINER.';


create or replace function is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from company_users cu
    where cu.company_id = p_company_id
      and cu.profile_id = current_profile_id()
  );
$$;

comment on function is_company_member(uuid) is 'true se o usuário está vinculado à empresa em company_users. SECURITY DEFINER.';


create or replace function has_company_role(p_company_id uuid, p_roles company_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from company_users cu
    where cu.company_id = p_company_id
      and cu.profile_id = current_profile_id()
      and cu.role = any(p_roles)
  );
$$;

comment on function has_company_role(uuid, company_role[]) is 'true se o usuário tem um dos papéis informados na empresa. SECURITY DEFINER.';


-- Helper interno (não pedido nominalmente, mas necessário para "OWNER/ADMIN do
-- workspace DA empresa" nas funções seguintes) — resolve o workspace_id de uma empresa.
create or replace function company_workspace_id(p_company_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select workspace_id from companies where id = p_company_id;
$$;

comment on function company_workspace_id(uuid) is 'Resolve o workspace_id de uma empresa. SECURITY DEFINER: companies tem policy própria (can_read_company), e esta função é usada justamente para CALCULAR o can_read_company de outras tabelas — evita a mesma recursão do comentário do Bloco 2.';


create or replace function can_read_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select is_workspace_member(p_workspace_id);
$$;

comment on function can_read_workspace(uuid) is 'Leitura de dados do workspace: qualquer papel de workspace_users (OWNER/ADMIN/ACCOUNTANT/ASSISTANT) pode ler o próprio workspace.';


create or replace function can_admin_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select has_workspace_role(p_workspace_id, array['OWNER', 'ADMIN']::workspace_role[]);
$$;

comment on function can_admin_workspace(uuid) is 'Administração do workspace (gerenciar empresas/usuários/config): só OWNER/ADMIN.';


-- DECISÃO DE PRODUTO (pedida explicitamente: "explique a decisão"): OWNER/ADMIN do
-- workspace enxergam TODAS as empresas do workspace, mesmo SEM vínculo explícito em
-- company_users. Já ACCOUNTANT/ASSISTANT de workspace SÓ enxergam empresas onde têm
-- vínculo direto em company_users (política mais restritiva, "menor privilégio por
-- padrão" para quem opera o dia a dia). A razão: OWNER/ADMIN são papéis de GESTÃO do
-- escritório (poucas pessoas, tipicamente os sócios/gestores), e exigir que eles sejam
-- adicionados manualmente em company_users para CADA empresa nova criada seria fricção
-- administrativa sem ganho de segurança real — eles já têm autoridade sobre o
-- escritório inteiro por definição do papel. ACCOUNTANT/ASSISTANT, por outro lado, são
-- o time operacional do dia a dia, potencialmente numeroso, e a expectativa de produto
-- (confirmada por você) é que cada um só opere as empresas que lhe foram atribuídas.
create or replace function can_read_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    has_workspace_role(company_workspace_id(p_company_id), array['OWNER', 'ADMIN']::workspace_role[])
    or is_company_member(p_company_id);
$$;

comment on function can_read_company(uuid) is 'Leitura de dados da empresa: OWNER/ADMIN do workspace (qualquer empresa do escritório) OU vínculo direto em company_users (qualquer papel).';


create or replace function can_write_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    has_workspace_role(company_workspace_id(p_company_id), array['OWNER', 'ADMIN']::workspace_role[])
    or has_company_role(p_company_id, array['ACCOUNTANT', 'ASSISTANT']::company_role[]);
$$;

comment on function can_write_company(uuid) is 'Escrita operacional (lançar, importar, conciliar): OWNER/ADMIN do workspace, ou ACCOUNTANT/ASSISTANT da empresa. CLIENT_VIEWER nunca escreve — não aparece aqui. CLIENT_ADMIN (ausente no enum atual, ver Bloco 0) também não escreveria contabilidade se existisse.';


create or replace function can_admin_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    has_workspace_role(company_workspace_id(p_company_id), array['OWNER', 'ADMIN']::workspace_role[])
    or has_company_role(p_company_id, array['ACCOUNTANT']::company_role[]);
$$;

comment on function can_admin_company(uuid) is 'Administração de configuração crítica da empresa (plano de contas, categorias patrimoniais, contas bancárias, regras): OWNER/ADMIN do workspace, ou ACCOUNTANT da empresa. ASSISTANT nunca administra.';


create or replace function can_close_period(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    has_workspace_role(company_workspace_id(p_company_id), array['OWNER', 'ADMIN']::workspace_role[])
    or has_company_role(p_company_id, array['ACCOUNTANT']::company_role[]);
$$;

comment on function can_close_period(uuid) is 'Fechar/reabrir período e estornar lançamentos POSTED: OWNER/ADMIN do workspace, ou ACCOUNTANT da empresa. Mesmo critério de can_admin_company — fechamento e estorno são operações do mesmo nível de sensibilidade que administrar a empresa.';


-- =====================================================================================
-- BLOCO 3 — GRANTS DE TABELA MÍNIMOS
-- =====================================================================================
-- RLS por si só NÃO libera acesso: o Postgres exige tanto o GRANT de tabela quanto a
-- policy de linha passando. "anon" não recebe NENHUM privilégio em tabela de negócio —
-- este é um produto autenticado, sem superfície pública. "authenticated" recebe os
-- privilégios amplos de tabela; quem realmente decide o que cada linha permite são as
-- policies do Bloco 4 (inclusive negando tudo via "using (false)" onde necessário).

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
-- company_journal_counters é a única exceção prática: recebe o GRANT de tabela acima
-- (para não quebrar o padrão), mas NENHUMA policy é criada para ela no Bloco 4 — RLS
-- habilitada + zero policies = acesso negado por padrão para "authenticated". Só
-- next_journal_number() (SECURITY DEFINER) e "service_role" tocam essa tabela.

grant execute on function
  auth_user_id(), current_profile_id(), is_workspace_member(uuid), has_workspace_role(uuid, workspace_role[]),
  is_company_member(uuid), has_company_role(uuid, company_role[]), company_workspace_id(uuid),
  can_read_workspace(uuid), can_admin_workspace(uuid), can_read_company(uuid), can_write_company(uuid),
  can_admin_company(uuid), can_close_period(uuid)
to authenticated;

grant execute on function reverse_journal_entry(uuid, text) to authenticated, service_role;
grant execute on function next_journal_number(uuid) to authenticated, service_role;


-- =====================================================================================
-- BLOCO 4 — POLICIES
-- =====================================================================================

-- ---------------------------------------------------------------------------------
-- 4.1 — profiles
-- ---------------------------------------------------------------------------------
create policy profiles_select_own on profiles
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy profiles_update_own on profiles
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Sem trigger de auth.users -> profiles neste schema; o próprio usuário cria seu
-- profile no primeiro login (fluxo de app, fora deste arquivo).
create policy profiles_insert_own on profiles
  for insert to authenticated
  with check (auth_user_id = auth.uid());

comment on table profiles is 'RLS: usuário só vê/edita o próprio perfil. Admins de workspace NÃO enxergam profiles de outros usuários por esta tabela (só indiretamente, via workspace_users/company_users, que expõem o vínculo mas não o profile inteiro de terceiros).';


-- ---------------------------------------------------------------------------------
-- 4.2 — workspaces
-- ---------------------------------------------------------------------------------
create policy workspaces_select on workspaces
  for select to authenticated
  using (is_workspace_member(id));

create policy workspaces_update on workspaces
  for update to authenticated
  using (can_admin_workspace(id))
  with check (can_admin_workspace(id));

-- DECISÃO: criação de workspace é liberada a qualquer usuário autenticado (fluxo de
-- onboarding self-service — "crie sua conta de escritório"). Não há um papel "global
-- platform admin" neste schema para restringir isso; se o produto quiser onboarding
-- só por convite/aprovação manual, troque para "using (false)" aqui e crie workspaces
-- só via service_role (Edge Function de onboarding).
create policy workspaces_insert on workspaces
  for insert to authenticated
  with check (true);

-- DELETE bloqueado: não há policy de delete = negado por padrão para authenticated.
comment on table workspaces is 'RLS: leitura para membros; escrita de configuração só OWNER/ADMIN; criação livre para authenticated (onboarding self-service); delete físico bloqueado (arquive via companies.active/deleted_at nas empresas, não apagando o escritório).';


-- ---------------------------------------------------------------------------------
-- 4.3 — workspace_users
-- ---------------------------------------------------------------------------------
create policy workspace_users_select on workspace_users
  for select to authenticated
  using (is_workspace_member(workspace_id) or profile_id = current_profile_id());

create policy workspace_users_insert on workspace_users
  for insert to authenticated
  with check (can_admin_workspace(workspace_id));

create policy workspace_users_update on workspace_users
  for update to authenticated
  using (can_admin_workspace(workspace_id))
  with check (can_admin_workspace(workspace_id));

create policy workspace_users_delete on workspace_users
  for delete to authenticated
  using (can_admin_workspace(workspace_id));

comment on table workspace_users is 'RLS: membros veem a lista de membros do workspace (e sempre o próprio vínculo, mesmo em algum estado futuro em que a policy geral fique mais restritiva); só OWNER/ADMIN gerenciam.';


-- ---------------------------------------------------------------------------------
-- 4.4 — companies
-- ---------------------------------------------------------------------------------
create policy companies_select on companies
  for select to authenticated
  using (can_read_company(id));

create policy companies_insert on companies
  for insert to authenticated
  with check (can_admin_workspace(workspace_id));

create policy companies_update on companies
  for update to authenticated
  using (can_admin_workspace(workspace_id) or has_company_role(id, array['ACCOUNTANT']::company_role[]))
  with check (can_admin_workspace(workspace_id) or has_company_role(id, array['ACCOUNTANT']::company_role[]));

-- DELETE bloqueado: use companies.active=false / deleted_at (já suportado pelo schema).
comment on table companies is 'RLS: leitura por can_read_company; criação só OWNER/ADMIN do workspace; edição cadastral por OWNER/ADMIN do workspace OU Contador vinculado à empresa; delete físico bloqueado (arquive via active=false/deleted_at).';


-- ---------------------------------------------------------------------------------
-- 4.5 — company_users
-- ---------------------------------------------------------------------------------
create policy company_users_select on company_users
  for select to authenticated
  using (can_read_company(company_id));

-- MVP: só OWNER/ADMIN do workspace gerenciam vínculos de empresa (mesmo Contador não
-- convida auxiliares nesta versão — conforme sua preferência explícita no pedido).
create policy company_users_insert on company_users
  for insert to authenticated
  with check (can_admin_workspace(company_workspace_id(company_id)));

create policy company_users_update on company_users
  for update to authenticated
  using (can_admin_workspace(company_workspace_id(company_id)))
  with check (can_admin_workspace(company_workspace_id(company_id)));

create policy company_users_delete on company_users
  for delete to authenticated
  using (can_admin_workspace(company_workspace_id(company_id)));

comment on table company_users is 'RLS: leitura por can_read_company; gerenciamento restrito a OWNER/ADMIN do workspace (MVP — Contador não convida auxiliares nesta versão).';


-- ---------------------------------------------------------------------------------
-- 4.6 — establishments
-- ---------------------------------------------------------------------------------
create policy establishments_select on establishments
  for select to authenticated
  using (can_read_company(company_id));

create policy establishments_insert on establishments
  for insert to authenticated
  with check (can_admin_company(company_id));

create policy establishments_update on establishments
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

-- DELETE bloqueado: use active=false.


-- ---------------------------------------------------------------------------------
-- 4.7 — cost_centers
-- ---------------------------------------------------------------------------------
create policy cost_centers_select on cost_centers
  for select to authenticated
  using (can_read_company(company_id));

create policy cost_centers_insert on cost_centers
  for insert to authenticated
  with check (can_write_company(company_id));

create policy cost_centers_update on cost_centers
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- DELETE bloqueado: use active=false.


-- ---------------------------------------------------------------------------------
-- 4.8 — partners
-- ---------------------------------------------------------------------------------
create policy partners_select on partners
  for select to authenticated
  using (can_read_company(company_id));

create policy partners_insert on partners
  for insert to authenticated
  with check (can_write_company(company_id));

create policy partners_update on partners
  for update to authenticated
  using (can_write_company(company_id))
  with check (can_write_company(company_id));

-- DELETE bloqueado: use active=false.


-- ---------------------------------------------------------------------------------
-- 4.9 — account_templates / account_template_lines (catálogo GLOBAL, sem company_id)
-- ---------------------------------------------------------------------------------
create policy account_templates_select on account_templates
  for select to authenticated
  using (true);

create policy account_template_lines_select on account_template_lines
  for select to authenticated
  using (true);

-- Sem policy de INSERT/UPDATE/DELETE para "authenticated" = escrita bloqueada. Não há
-- papel "admin global da plataforma" neste schema; a manutenção dos templates é feita
-- por migração/seed ou por uma ferramenta interna rodando como service_role (que
-- ignora RLS). Documentado aqui como decisão explícita, não omissão.
comment on table account_templates is 'RLS: leitura liberada a qualquer usuário autenticado (catálogo compartilhado, não sensível). Escrita bloqueada via RLS — mantido por migração/seed ou ferramenta interna via service_role.';
comment on table account_template_lines is 'RLS: mesmo tratamento de account_templates (leitura liberada, escrita só via service_role/migração).';


-- ---------------------------------------------------------------------------------
-- 4.10 — chart_accounts
-- ---------------------------------------------------------------------------------
create policy chart_accounts_select on chart_accounts
  for select to authenticated
  using (can_read_company(company_id));

create policy chart_accounts_insert on chart_accounts
  for insert to authenticated
  with check (can_admin_company(company_id));

create policy chart_accounts_update on chart_accounts
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

-- DELETE bloqueado: use is_active=false (o schema já trava is_synthetic/accepts_entries
-- retroativos com lançamento existente via trigger — RLS não precisa reforçar isso).
comment on table chart_accounts is 'RLS: leitura por can_read_company; escrita restrita a can_admin_company (ASSISTANT nunca altera plano de contas, conforme pedido); delete físico bloqueado.';


-- ---------------------------------------------------------------------------------
-- 4.11 — accounting_rules
-- ---------------------------------------------------------------------------------
create policy accounting_rules_select on accounting_rules
  for select to authenticated
  using (can_read_company(company_id));

create policy accounting_rules_insert on accounting_rules
  for insert to authenticated
  with check (can_admin_company(company_id));

create policy accounting_rules_update on accounting_rules
  for update to authenticated
  using (can_admin_company(company_id))
  with check (can_admin_company(company_id));

-- DELETE bloqueado: use status='INACTIVE'.


-- ---------------------------------------------------------------------------------
-- 4.12 — accounting_periods
-- ---------------------------------------------------------------------------------
create policy accounting_periods_select on accounting_periods
  for select to authenticated
  using (can_read_company(company_id));

create policy accounting_periods_insert on accounting_periods
  for insert to authenticated
  with check (can_admin_company(company_id));

create policy accounting_periods_update on accounting_periods
  for update to authenticated
  using (can_close_period(company_id))
  with check (can_close_period(company_id));

-- DELETE bloqueado (rule 8 obrigatória).
comment on table accounting_periods is 'RLS: leitura por can_read_company; criação por can_admin_company; UPDATE (inclui fechar/reabrir) restrito a can_close_period; delete bloqueado — período nunca é apagado.';


-- ---------------------------------------------------------------------------------
-- 4.13 — journal_entries
-- ---------------------------------------------------------------------------------
create policy journal_entries_select on journal_entries
  for select to authenticated
  using (can_read_company(company_id));

create policy journal_entries_insert on journal_entries
  for insert to authenticated
  with check (
    can_write_company(company_id)
    and status in ('DRAFT', 'PENDING_CLASSIFICATION')
  );

-- UPDATE só é permitido enquanto o estado ATUAL (linha antiga) ainda é DRAFT ou
-- PENDING_CLASSIFICATION — inclui a própria transição para POSTED (efetivar é
-- considerado "operação básica", conforme sua descrição do papel ASSISTANT). Uma vez
-- POSTED/REVERSED, esta policy não libera mais nenhum UPDATE: a única forma de mudar
-- o estado a partir daí é reverse_journal_entry() (SECURITY DEFINER, com seu próprio
-- guard can_close_period — ver Bloco 1.3). O trigger fn_validate_journal_entry
-- reforça tudo isto no nível do banco, independentemente da policy.
create policy journal_entries_update on journal_entries
  for update to authenticated
  using (
    can_write_company(company_id)
    and status in ('DRAFT', 'PENDING_CLASSIFICATION')
  )
  with check (can_write_company(company_id));

-- DELETE bloqueado (rule 8 obrigatória) — journal_entry_lines está em CASCADE a partir
-- daqui; sem policy de delete, um DELETE físico de um lançamento (e suas linhas) nunca
-- acontece via "authenticated", regime nenhum.
comment on table journal_entries is 'RLS: leitura por can_read_company; INSERT/UPDATE só em DRAFT/PENDING_CLASSIFICATION (inclui efetivar); POSTED/REVERSED são terminais para UPDATE direto — mudança de estado a partir daí só via reverse_journal_entry(); DELETE bloqueado (o cascade para journal_entry_lines nunca é alcançável por "authenticated" sem uma policy de delete, que propositalmente não existe).';


-- ---------------------------------------------------------------------------------
-- 4.14 — journal_entry_lines
-- ---------------------------------------------------------------------------------
create policy journal_entry_lines_select on journal_entry_lines
  for select to authenticated
  using (can_read_company(company_id));

create policy journal_entry_lines_insert on journal_entry_lines
  for insert to authenticated
  with check (
    can_write_company(company_id)
    and exists (
      select 1 from journal_entries je
      where je.id = journal_entry_lines.journal_entry_id
        and je.status in ('DRAFT', 'PENDING_CLASSIFICATION')
    )
  );

create policy journal_entry_lines_update on journal_entry_lines
  for update to authenticated
  using (
    can_write_company(company_id)
    and exists (
      select 1 from journal_entries je
      where je.id = journal_entry_lines.journal_entry_id
        and je.status in ('DRAFT', 'PENDING_CLASSIFICATION')
    )
  )
  with check (can_write_company(company_id));

create policy journal_entry_lines_delete on journal_entry_lines
  for delete to authenticated
  using (
    can_write_company(company_id)
    and exists (
      select 1 from journal_entries je
      where je.id = journal_entry_lines.journal_entry_id
        and je.status in ('DRAFT', 'PENDING_CLASSIFICATION')
    )
  );

comment on table journal_entry_lines is 'RLS: INSERT/UPDATE/DELETE exigem que o lançamento PAI ainda esteja DRAFT/PENDING_CLASSIFICATION — reforça, na camada de autorização, o que fn_protect_journal_entry_line_delete e fn_validate_journal_entry_line já garantem na camada de banco.';


-- ---------------------------------------------------------------------------------
-- 4.15 — fiscal_imports, fiscal_documents, fiscal_document_items, tax_assessments,
--         tax_assessment_lines
-- ---------------------------------------------------------------------------------
create policy fiscal_imports_select on fiscal_imports
  for select to authenticated using (can_read_company(company_id));
create policy fiscal_imports_insert on fiscal_imports
  for insert to authenticated with check (can_write_company(company_id));
-- Sem UPDATE/DELETE: log de importação é histórico, não editável por "authenticated".

create policy fiscal_documents_select on fiscal_documents
  for select to authenticated using (can_read_company(company_id));
create policy fiscal_documents_insert on fiscal_documents
  for insert to authenticated with check (can_write_company(company_id) and status in ('DRAFT', 'IMPORTED', 'VALIDATED'));
create policy fiscal_documents_update on fiscal_documents
  for update to authenticated
  using (can_write_company(company_id) and status in ('DRAFT', 'IMPORTED', 'VALIDATED'))
  with check (can_write_company(company_id));
create policy fiscal_documents_delete on fiscal_documents
  for delete to authenticated using (can_write_company(company_id) and status = 'DRAFT');

create policy fiscal_document_items_select on fiscal_document_items
  for select to authenticated using (can_read_company(company_id));
create policy fiscal_document_items_insert on fiscal_document_items
  for insert to authenticated with check (
    can_write_company(company_id)
    and exists (select 1 from fiscal_documents fd where fd.id = fiscal_document_items.fiscal_document_id and fd.status in ('DRAFT', 'IMPORTED', 'VALIDATED'))
  );
create policy fiscal_document_items_update on fiscal_document_items
  for update to authenticated
  using (
    can_write_company(company_id)
    and exists (select 1 from fiscal_documents fd where fd.id = fiscal_document_items.fiscal_document_id and fd.status in ('DRAFT', 'IMPORTED', 'VALIDATED'))
  )
  with check (can_write_company(company_id));
create policy fiscal_document_items_delete on fiscal_document_items
  for delete to authenticated using (
    can_write_company(company_id)
    and exists (select 1 from fiscal_documents fd where fd.id = fiscal_document_items.fiscal_document_id and fd.status = 'DRAFT')
  );

create policy tax_assessments_select on tax_assessments
  for select to authenticated using (can_read_company(company_id));
create policy tax_assessments_insert on tax_assessments
  for insert to authenticated with check (can_write_company(company_id) and status in ('DRAFT', 'CALCULATED', 'REVIEWED'));
create policy tax_assessments_update on tax_assessments
  for update to authenticated
  using (can_write_company(company_id) and status in ('DRAFT', 'CALCULATED', 'REVIEWED'))
  with check (can_write_company(company_id));
create policy tax_assessments_delete on tax_assessments
  for delete to authenticated using (can_write_company(company_id) and status = 'DRAFT');

create policy tax_assessment_lines_select on tax_assessment_lines
  for select to authenticated using (can_read_company(company_id));
create policy tax_assessment_lines_insert on tax_assessment_lines
  for insert to authenticated with check (
    can_write_company(company_id)
    and exists (select 1 from tax_assessments ta where ta.id = tax_assessment_lines.tax_assessment_id and ta.status in ('DRAFT', 'CALCULATED', 'REVIEWED'))
  );
create policy tax_assessment_lines_delete on tax_assessment_lines
  for delete to authenticated using (
    can_write_company(company_id)
    and exists (select 1 from tax_assessments ta where ta.id = tax_assessment_lines.tax_assessment_id and ta.status = 'DRAFT')
  );

comment on table fiscal_documents is 'RLS: geração/estorno de POSTED (lançamento contábil do documento) segue sendo feita por função/Server Action fora deste arquivo — a policy aqui só cobre o CRUD do documento em si enquanto DRAFT/READY.';


-- ---------------------------------------------------------------------------------
-- 4.16 — payroll_summaries, payroll_lines, payroll_payments
-- ---------------------------------------------------------------------------------
create policy payroll_summaries_select on payroll_summaries
  for select to authenticated using (can_read_company(company_id));
create policy payroll_summaries_insert on payroll_summaries
  for insert to authenticated with check (can_write_company(company_id) and status in ('DRAFT', 'READY'));
create policy payroll_summaries_update on payroll_summaries
  for update to authenticated
  using (can_write_company(company_id) and status in ('DRAFT', 'READY'))
  with check (can_write_company(company_id));
create policy payroll_summaries_delete on payroll_summaries
  for delete to authenticated using (can_write_company(company_id) and status = 'DRAFT');

create policy payroll_lines_select on payroll_lines
  for select to authenticated using (can_read_company(company_id));
create policy payroll_lines_insert on payroll_lines
  for insert to authenticated with check (
    can_write_company(company_id)
    and exists (select 1 from payroll_summaries ps where ps.id = payroll_lines.payroll_summary_id and ps.status in ('DRAFT', 'READY'))
  );
create policy payroll_lines_update on payroll_lines
  for update to authenticated
  using (
    can_write_company(company_id)
    and exists (select 1 from payroll_summaries ps where ps.id = payroll_lines.payroll_summary_id and ps.status in ('DRAFT', 'READY'))
  )
  with check (can_write_company(company_id));
create policy payroll_lines_delete on payroll_lines
  for delete to authenticated using (
    can_write_company(company_id)
    and exists (select 1 from payroll_summaries ps where ps.id = payroll_lines.payroll_summary_id and ps.status = 'DRAFT')
  );

-- payroll_payments não tem coluna de status (é um FATO — "este pagamento aconteceu"),
-- então só SELECT/INSERT fazem sentido; não há UPDATE/DELETE via RLS.
create policy payroll_payments_select on payroll_payments
  for select to authenticated using (can_read_company(company_id));
create policy payroll_payments_insert on payroll_payments
  for insert to authenticated with check (can_write_company(company_id));

comment on table payroll_payments is 'RLS: só SELECT/INSERT — tabela representa um fato consumado (pagamento realizado), sem estado de rascunho. Correção posterior deve ser feita por estorno do journal_entry vinculado, não por UPDATE deste registro.';


-- ---------------------------------------------------------------------------------
-- 4.17 — bank_accounts
-- ---------------------------------------------------------------------------------
create policy bank_accounts_select on bank_accounts
  for select to authenticated using (can_read_company(company_id));
create policy bank_accounts_insert on bank_accounts
  for insert to authenticated with check (can_admin_company(company_id));
create policy bank_accounts_update on bank_accounts
  for update to authenticated using (can_admin_company(company_id)) with check (can_admin_company(company_id));
-- DELETE bloqueado: use active=false.


-- ---------------------------------------------------------------------------------
-- 4.18 — bank_statement_imports, bank_statement_lines, bank_reconciliations
-- ---------------------------------------------------------------------------------
create policy bank_statement_imports_select on bank_statement_imports
  for select to authenticated using (can_read_company(company_id));
create policy bank_statement_imports_insert on bank_statement_imports
  for insert to authenticated with check (can_write_company(company_id));

create policy bank_statement_lines_select on bank_statement_lines
  for select to authenticated using (can_read_company(company_id));
create policy bank_statement_lines_insert on bank_statement_lines
  for insert to authenticated with check (can_write_company(company_id));
create policy bank_statement_lines_update on bank_statement_lines
  for update to authenticated using (can_write_company(company_id)) with check (can_write_company(company_id));
-- Sem DELETE: extrato importado é histórico; "limpar" deve ser uma função dedicada
-- (fora do escopo deste arquivo), não um DELETE direto do usuário.

create policy bank_reconciliations_select on bank_reconciliations
  for select to authenticated using (can_read_company(company_id));
create policy bank_reconciliations_insert on bank_reconciliations
  for insert to authenticated with check (can_write_company(company_id));
create policy bank_reconciliations_update on bank_reconciliations
  for update to authenticated using (can_write_company(company_id)) with check (can_write_company(company_id));

comment on table bank_statement_lines is 'RLS: UPDATE cobre a conciliação/desconciliação (troca de "reconciled"/"journal_entry_line_id"); a trava de período fechado continua sendo regra de banco (assert_period_open dentro das funções de conciliação, fora deste arquivo) — a policy aqui não amplia nem substitui essa regra.';


-- ---------------------------------------------------------------------------------
-- 4.19 — obligations
-- ---------------------------------------------------------------------------------
create policy obligations_select on obligations
  for select to authenticated using (can_read_company(company_id));
create policy obligations_insert on obligations
  for insert to authenticated with check (can_write_company(company_id));
create policy obligations_update on obligations
  for update to authenticated using (can_write_company(company_id)) with check (can_write_company(company_id));
create policy obligations_delete on obligations
  for delete to authenticated using (can_write_company(company_id) and status <> 'PAID');

comment on table obligations is 'RLS: DELETE só quando status <> PAID (rule 8 obrigatória — obrigação paga nunca é apagada). A imutabilidade de payment_journal_entry_id já é garantida por trigger (fn_protect_obligation_payment) independente da policy.';


-- ---------------------------------------------------------------------------------
-- 4.20 — asset_categories
-- ---------------------------------------------------------------------------------
create policy asset_categories_select on asset_categories
  for select to authenticated using (can_read_company(company_id));
create policy asset_categories_insert on asset_categories
  for insert to authenticated with check (can_admin_company(company_id));
create policy asset_categories_update on asset_categories
  for update to authenticated using (can_admin_company(company_id)) with check (can_admin_company(company_id));
-- DELETE bloqueado: use active=false.


-- ---------------------------------------------------------------------------------
-- 4.21 — fixed_assets, asset_events, asset_depreciations
-- ---------------------------------------------------------------------------------
create policy fixed_assets_select on fixed_assets
  for select to authenticated using (can_read_company(company_id));
create policy fixed_assets_insert on fixed_assets
  for insert to authenticated with check (can_write_company(company_id));
create policy fixed_assets_update on fixed_assets
  for update to authenticated using (can_write_company(company_id)) with check (can_write_company(company_id));
create policy fixed_assets_delete on fixed_assets
  for delete to authenticated using (can_write_company(company_id) and status = 'DRAFT');

create policy asset_events_select on asset_events
  for select to authenticated using (can_read_company(company_id));
create policy asset_events_insert on asset_events
  for insert to authenticated with check (can_write_company(company_id));
-- Sem UPDATE/DELETE: evento patrimonial é histórico (melhoria, baixa, reavaliação já
-- ocorridos) — corrigir é estornar o journal_entry vinculado e lançar um evento novo.

create policy asset_depreciations_select on asset_depreciations
  for select to authenticated using (can_read_company(company_id));
create policy asset_depreciations_insert on asset_depreciations
  for insert to authenticated with check (can_write_company(company_id));
-- Sem UPDATE/DELETE: depreciação mensal já lançada é histórico contábil.

comment on table fixed_assets is 'RLS: DELETE só quando status=DRAFT (bem ainda não ativado) — bem ACTIVE/DISPOSED/SOLD nunca é apagado (rule 8 obrigatória), só muda de status via evento de baixa.';
comment on table asset_events is 'RLS: só SELECT/INSERT — evento é fato histórico, não editável/removível via RLS.';
comment on table asset_depreciations is 'RLS: só SELECT/INSERT — depreciação de uma competência já processada é fato histórico; status ACTIVE do bem (checado por trigger, não pela policy) já impede depreciar bem indevido.';


-- ---------------------------------------------------------------------------------
-- 4.22 — income_tax_assessments, income_tax_adjustments
-- ---------------------------------------------------------------------------------
create policy income_tax_assessments_select on income_tax_assessments
  for select to authenticated using (can_read_company(company_id));
create policy income_tax_assessments_insert on income_tax_assessments
  for insert to authenticated with check (can_write_company(company_id) and status in ('DRAFT', 'READY'));
create policy income_tax_assessments_update on income_tax_assessments
  for update to authenticated
  using (can_write_company(company_id) and status in ('DRAFT', 'READY'))
  with check (can_write_company(company_id));
create policy income_tax_assessments_delete on income_tax_assessments
  for delete to authenticated using (can_write_company(company_id) and status = 'DRAFT');

create policy income_tax_adjustments_select on income_tax_adjustments
  for select to authenticated using (can_read_company(company_id));
create policy income_tax_adjustments_insert on income_tax_adjustments
  for insert to authenticated with check (
    can_write_company(company_id)
    and exists (select 1 from income_tax_assessments ita where ita.id = income_tax_adjustments.income_tax_assessment_id and ita.status in ('DRAFT', 'READY'))
  );
create policy income_tax_adjustments_delete on income_tax_adjustments
  for delete to authenticated using (
    can_write_company(company_id)
    and exists (select 1 from income_tax_assessments ita where ita.id = income_tax_adjustments.income_tax_assessment_id and ita.status = 'DRAFT')
  );


-- ---------------------------------------------------------------------------------
-- 4.23 — period_audits, period_audit_findings
-- ---------------------------------------------------------------------------------
create policy period_audits_select on period_audits
  for select to authenticated using (can_read_company(company_id));
create policy period_audits_insert on period_audits
  for insert to authenticated with check (can_admin_company(company_id) or can_close_period(company_id));
-- Sem UPDATE/DELETE: execução de auditoria é imutável (rule 8 obrigatória).

create policy period_audit_findings_select on period_audit_findings
  for select to authenticated using (can_read_company(company_id));
create policy period_audit_findings_insert on period_audit_findings
  for insert to authenticated with check (
    can_admin_company(company_id)
    or can_close_period(company_id)
    or exists (select 1 from period_audits pa where pa.id = period_audit_findings.period_audit_id and can_read_company(pa.company_id))
  );
-- Sem UPDATE/DELETE.

comment on table period_audits is 'RLS: leitura por can_read_company; execução por can_admin_company/can_close_period; UPDATE/DELETE bloqueados — é um registro de auditoria, não deve ser alterável depois de gerado.';


-- ---------------------------------------------------------------------------------
-- 4.24 — import_logs
-- ---------------------------------------------------------------------------------
create policy import_logs_select on import_logs
  for select to authenticated using (can_read_company(company_id));
create policy import_logs_insert on import_logs
  for insert to authenticated with check (can_write_company(company_id));
-- Sem UPDATE/DELETE: log de importação é histórico.


-- ---------------------------------------------------------------------------------
-- 4.25 — audit_logs
-- ---------------------------------------------------------------------------------
-- Leitura restrita: OWNER/ADMIN do workspace ou ACCOUNTANT da empresa. CLIENT_VIEWER,
-- ASSISTANT e (se existisse) CLIENT_ADMIN não veem a trilha de auditoria interna.
create policy audit_logs_select on audit_logs
  for select to authenticated
  using (
    (company_id is not null and (
      has_workspace_role(company_workspace_id(company_id), array['OWNER', 'ADMIN']::workspace_role[])
      or has_company_role(company_id, array['ACCOUNTANT']::company_role[])
    ))
    or (company_id is null and can_admin_workspace(workspace_id))
  );

-- Sem policy de INSERT para "authenticated": esta tabela não tem hoje nenhum trigger
-- automático populando-a (ver observações na resposta) — só service_role escreve por
-- enquanto. Nenhuma policy de UPDATE/DELETE = imutável mesmo para quem administra.
comment on table audit_logs is 'RLS: leitura restrita a OWNER/ADMIN de workspace ou ACCOUNTANT de empresa — CLIENT_VIEWER/ASSISTANT nunca veem log interno de atividade. INSERT bloqueado para "authenticated" (só service_role escreve; este schema ainda não tem trigger automático de auditoria de atividade — ver observações).';


-- ---------------------------------------------------------------------------------
-- 4.26 — attachments
-- ---------------------------------------------------------------------------------
create policy attachments_select on attachments
  for select to authenticated using (can_read_company(company_id));
create policy attachments_insert on attachments
  for insert to authenticated with check (can_write_company(company_id));
create policy attachments_update on attachments
  for update to authenticated
  using (can_write_company(company_id) and (created_by = auth.uid() or can_admin_company(company_id)))
  with check (can_write_company(company_id));
create policy attachments_delete on attachments
  for delete to authenticated
  using (created_by = auth.uid() or can_admin_company(company_id));

comment on table attachments is 'RLS: só quem anexou o arquivo (created_by) ou can_admin_company pode editar/remover o REGISTRO do anexo. O arquivo em si, no Supabase Storage, precisa de policies PRÓPRIAS de bucket (ver observações — não cobertas por este arquivo).';


-- ---------------------------------------------------------------------------------
-- 4.27 — role_permissions (catálogo GLOBAL)
-- ---------------------------------------------------------------------------------
create policy role_permissions_select on role_permissions
  for select to authenticated
  using (true);

-- Sem INSERT/UPDATE/DELETE: catálogo de permissões é gerenciado por migração/admin
-- global (mesmo tratamento de account_templates).
comment on table role_permissions is 'RLS: leitura liberada; escrita só via migração/service_role (extensibilidade pós-MVP, ainda sem papel de admin global no domínio).';


-- ---------------------------------------------------------------------------------
-- 4.28 — company_journal_counters: NENHUMA policy de propósito.
-- ---------------------------------------------------------------------------------
-- RLS já habilitada (herdada de erp_schema_v1_1.sql) e sem nenhuma policy aqui = acesso
-- total negado para "authenticated"/"anon". Só next_journal_number() (SECURITY DEFINER,
-- Bloco 1.2) e "service_role" tocam esta tabela. Isto é intencional, não um esquecimento.
comment on table company_journal_counters is 'RLS: propositalmente SEM NENHUMA policy — tabela 100% interna, só acessível via next_journal_number() (SECURITY DEFINER) ou service_role. Nunca exponha esta tabela diretamente a "authenticated".';


-- =====================================================================================
-- BLOCO 5 — TESTES BÁSICOS DE ISOLAMENTO (rodar manualmente contra um projeto de teste)
-- =====================================================================================
-- Estes testes NÃO rodam sozinhos neste arquivo (dependem de dados semeados e de dois
-- usuários JWT reais). São um roteiro pronto para colar no SQL Editor do Supabase (ou
-- rodar via psql trocando de role) depois de: (1) aplicar erp_schema_v1_1.sql, (2)
-- aplicar este arquivo, (3) semear 2 workspaces/empresas/usuários de teste.
--
-- Padrão de uso no SQL Editor do Supabase (roda como o JWT do usuário logado no editor,
-- então troque de usuário entre os blocos) ou via psql:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid-do-usuario-de-teste>"}';
--
-- Roteiro sugerido (adaptar os UUIDs para os dados semeados):
--
-- -- 1) Usuário da Empresa A não deve ver NENHUMA linha da Empresa B.
-- select count(*) from companies where id = '<uuid-empresa-b>';           -- esperado: 0
-- select count(*) from chart_accounts where company_id = '<uuid-empresa-b>'; -- esperado: 0
-- select count(*) from journal_entries where company_id = '<uuid-empresa-b>'; -- esperado: 0
--
-- -- 2) Usuário da Empresa A NÃO deve conseguir inserir um lançamento na Empresa B
-- --    (deve falhar com "new row violates row-level security policy").
-- insert into journal_entries (workspace_id, company_id, entry_date, competence, description, origin, status)
-- values ('<workspace-b>', '<uuid-empresa-b>', current_date, date_trunc('month', current_date)::date, 'teste isolamento', 'MANUAL', 'DRAFT');
--
-- -- 3) CLIENT_VIEWER não deve conseguir inserir lançamento na PRÓPRIA empresa
-- --    (troque o JWT para um profile com company_role = CLIENT_VIEWER).
-- insert into journal_entries (workspace_id, company_id, entry_date, competence, description, origin, status)
-- values ('<workspace-a>', '<uuid-empresa-a>', current_date, date_trunc('month', current_date)::date, 'teste client_viewer', 'MANUAL', 'DRAFT');
-- -- esperado: falha (RLS) — CLIENT_VIEWER não está em can_write_company.
--
-- -- 4) ASSISTANT da empresa NÃO deve conseguir fechar período.
-- update accounting_periods set status = 'CLOSED' where company_id = '<uuid-empresa-a>' and competence = '<competencia>';
-- -- esperado: 0 linhas afetadas (using de accounting_periods_update falha para ASSISTANT).
--
-- -- 5) Ninguém (nem OWNER) deve conseguir apagar um lançamento.
-- delete from journal_entries where id = '<uuid-lancamento-qualquer>';
-- -- esperado: 0 linhas afetadas — não há policy de delete em journal_entries.
--
-- -- 6) Tentar trocar company_id de um lançamento (mesmo com acesso de escrita nas duas
-- --    empresas) deve falhar no TRIGGER, não silenciosamente passar pela RLS.
-- update journal_entries set company_id = '<outra-empresa-do-mesmo-usuario>' where id = '<uuid-lancamento>';
-- -- esperado: erro "Não é permitido alterar company_id de um registro existente."
--
-- Para uma suíte automatizada de verdade, recomenda-se pgTAP (supabase test db) rodando
-- exatamente estes 6 casos por tabela crítica (journal_entries, chart_accounts,
-- fixed_assets, obligations) — fora do escopo deste arquivo SQL isolado.


-- =====================================================================================
-- FIM DA MIGRAÇÃO DE RLS
-- =====================================================================================
