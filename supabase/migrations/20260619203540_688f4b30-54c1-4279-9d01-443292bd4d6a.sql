DROP POLICY IF EXISTS cultos_insert ON public.cultos;
DROP POLICY IF EXISTS cultos_update ON public.cultos;
DROP POLICY IF EXISTS cultos_delete ON public.cultos;

CREATE POLICY cultos_insert ON public.cultos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY cultos_update ON public.cultos
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY cultos_delete ON public.cultos
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));