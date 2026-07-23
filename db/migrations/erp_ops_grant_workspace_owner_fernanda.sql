-- =====================================================================================
-- ERP CONTÁBIL — OPERAÇÃO DE DADOS (não é migração de schema/RLS) — Conceder OWNER a
-- fernandaqueiroz.mt@gmail.com em todos os workspaces existentes.
-- =====================================================================================
--
-- CONTEXTO: pedido explícito da usuária para que ela seja a administradora/owner
-- principal do ERP. Auditoria de schema (feita antes de escrever este script) confirmou:
--   - `workspace_users.profile_id` e `company_users.profile_id` referenciam `profiles(id)`
--     (não `auth.users(id)` diretamente) — profiles.auth_user_id é quem faz essa ponte.
--   - `workspace_role` (enum de `workspace_users.role`) tem OWNER/ADMIN/ACCOUNTANT/
--     ASSISTANT — só workspace_users carrega OWNER, não existe "OWNER" em company_role.
--   - Por decisão de produto já documentada em erp_rls_v1.sql ("OWNER/ADMIN do workspace
--     enxergam TODAS as empresas do workspace, mesmo SEM vínculo explícito em
--     company_users"), OWNER em workspace_users já concede administração completa de
--     TODAS as empresas do escritório — não é necessário nenhum INSERT/UPDATE adicional em
--     company_users para "principal admin do ERP".
--
-- SEGURANÇA / NÃO-DESTRUTIVO:
--   - Só toca a linha de workspace_users cujo profile_id pertence à própria Fernanda
--     (resolvido via auth.users.email -> profiles.auth_user_id -> profiles.id). Nenhuma
--     outra linha de workspace_users/company_users de nenhum outro usuário é lida,
--     alterada ou removida.
--   - IDEMPOTENTE: pode ser executado quantas vezes for preciso. INSERT ... ON CONFLICT
--     (workspace_id, profile_id) DO UPDATE cobre tanto o caso "ainda não tem vínculo com
--     este workspace" quanto "já tem vínculo com papel menor (ADMIN/ACCOUNTANT/ASSISTANT)".
--   - Sem DELETE. Sem alterar papel de nenhum outro profile_id.
-- =====================================================================================

do $$
declare
  v_auth_user_id uuid;
  v_profile_id uuid;
  v_workspace record;
  v_count int := 0;
begin
  select id into v_auth_user_id
  from auth.users
  where email = 'fernandaqueiroz.mt@gmail.com';

  if v_auth_user_id is null then
    raise exception 'Usuário fernandaqueiroz.mt@gmail.com não encontrado em auth.users — faça login pelo menos uma vez antes de rodar este script.';
  end if;

  select id into v_profile_id
  from profiles
  where auth_user_id = v_auth_user_id;

  if v_profile_id is null then
    raise exception 'profiles.auth_user_id = % não tem registro em profiles. Contate o administrador para vincular o perfil.', v_auth_user_id;
  end if;

  for v_workspace in select id from workspaces loop
    insert into workspace_users (id, workspace_id, profile_id, role)
    values (gen_random_uuid(), v_workspace.id, v_profile_id, 'OWNER')
    on conflict (workspace_id, profile_id)
    do update set role = 'OWNER'
    where workspace_users.role <> 'OWNER';

    v_count := v_count + 1;
  end loop;

  raise notice 'OK: fernandaqueiroz.mt@gmail.com (profile %) agora é OWNER em % workspace(s).', v_profile_id, v_count;
end;
$$;

-- Verificação manual pós-execução (rode separadamente se quiser conferir):
-- select w.name, wu.role
-- from workspace_users wu
-- join workspaces w on w.id = wu.workspace_id
-- join profiles p on p.id = wu.profile_id
-- where p.email = 'fernandaqueiroz.mt@gmail.com';
