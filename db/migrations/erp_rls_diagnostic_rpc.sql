-- =====================================================================================
-- ERP CONTÁBIL — RPC DE DIAGNÓSTICO RLS — v1.0
-- =====================================================================================
-- Cria uma função RPC temporária no schema public para que o client de teste possa
-- invocar com a sessão de Fernanda e ler o estado das variáveis e funções internas.
-- =====================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.debug_rls_context(p_workspace_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER -- roda sob a identidade do chamador (Fernanda)
AS $$
DECLARE
  v_uid uuid;
  v_profile_id uuid;
  v_profile_record record;
  v_is_ws_member boolean;
  v_has_role boolean;
  v_can_admin_ws boolean;
  v_wu_record record;
BEGIN
  -- 1. Capturar ID do Auth
  v_uid := auth.uid();

  -- 2. Tentar ler o perfil direto (passando pela RLS de profiles)
  SELECT id, auth_user_id, email, name INTO v_profile_record
  FROM profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  -- 3. Chamar a função current_profile_id()
  BEGIN
    v_profile_id := current_profile_id();
  EXCEPTION WHEN OTHERS THEN
    v_profile_id := NULL;
  END;

  -- 4. Chamar as funções de membresia
  BEGIN
    v_is_ws_member := is_workspace_member(p_workspace_id);
  EXCEPTION WHEN OTHERS THEN
    v_is_ws_member := FALSE;
  END;

  BEGIN
    v_has_role := has_workspace_role(p_workspace_id, ARRAY['OWNER', 'ADMIN']::workspace_role[]);
  EXCEPTION WHEN OTHERS THEN
    v_has_role := FALSE;
  END;

  BEGIN
    v_can_admin_ws := can_admin_workspace(p_workspace_id);
  EXCEPTION WHEN OTHERS THEN
    v_can_admin_ws := FALSE;
  END;

  -- 5. Ler workspace_users direto
  SELECT * INTO v_wu_record
  FROM workspace_users
  WHERE workspace_id = p_workspace_id AND profile_id = v_profile_id
  LIMIT 1;

  RETURN json_build_object(
    'auth_uid_raw', v_uid,
    'profile_from_direct_select', to_jsonb(v_profile_record),
    'current_profile_id_fn', v_profile_id,
    'is_workspace_member_fn', v_is_ws_member,
    'has_workspace_role_fn', v_has_role,
    'can_admin_workspace_fn', v_can_admin_ws,
    'workspace_user_record_from_direct_select', to_jsonb(v_wu_record)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_rls_context(uuid) TO authenticated;

COMMIT;
