
CREATE OR REPLACE FUNCTION public.can_edit_org(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role IN ('owner','admin','editor'))
$$;

CREATE OR REPLACE FUNCTION public.can_manage_org(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role IN ('owner','admin'))
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['cultos','congregacoes','hinos','palavras','atendimentos','visitantes','musicos','agenda','escalas','cultos_inteligentes'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_insert" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_update" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_delete" ON public.%1$s', t);

    EXECUTE format($f$CREATE POLICY "%1$s_select" ON public.%1$s FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id, auth.uid()))$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_insert" ON public.%1$s FOR INSERT TO authenticated
      WITH CHECK (public.can_edit_org(auth.uid(), organization_id))$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_update" ON public.%1$s FOR UPDATE TO authenticated
      USING (public.can_edit_org(auth.uid(), organization_id))
      WITH CHECK (public.can_edit_org(auth.uid(), organization_id))$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_delete" ON public.%1$s FOR DELETE TO authenticated
      USING (public.can_manage_org(auth.uid(), organization_id))$f$, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "org_invites_select_by_token" ON public.organization_invites;
CREATE POLICY "org_invites_select_by_token" ON public.organization_invites
  FOR SELECT TO authenticated, anon
  USING (accepted_at IS NULL AND expires_at > now());

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_editor(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_org(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_org(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) TO authenticated;
