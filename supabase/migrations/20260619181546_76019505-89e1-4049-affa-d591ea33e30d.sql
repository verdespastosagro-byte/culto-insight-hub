
CREATE TABLE public.cultos_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  culto_id uuid NOT NULL,
  organization_id uuid,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  old_data jsonb,
  new_data jsonb
);

GRANT SELECT ON public.cultos_audit TO authenticated;
GRANT ALL ON public.cultos_audit TO service_role;

ALTER TABLE public.cultos_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org culto audit"
ON public.cultos_audit FOR SELECT
TO authenticated
USING (
  organization_id IS NULL
  OR public.is_org_member(organization_id, auth.uid())
);

CREATE INDEX idx_cultos_audit_culto ON public.cultos_audit(culto_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_culto_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_diff jsonb := '{}'::jsonb;
  v_key text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key NOT IN ('updated_at','created_at') AND COALESCE(v_old->v_key, 'null'::jsonb) IS DISTINCT FROM COALESCE(v_new->v_key, 'null'::jsonb) THEN
        v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      END IF;
    END LOOP;
    IF v_diff = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.cultos_audit(culto_id, organization_id, changed_by, action, changes, old_data, new_data)
    VALUES (NEW.id, NEW.organization_id, auth.uid(), 'update', v_diff, v_old, v_new);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.cultos_audit(culto_id, organization_id, changed_by, action, new_data)
    VALUES (NEW.id, NEW.organization_id, auth.uid(), 'insert', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.cultos_audit(culto_id, organization_id, changed_by, action, old_data)
    VALUES (OLD.id, OLD.organization_id, auth.uid(), 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cultos_audit ON public.cultos;
CREATE TRIGGER trg_cultos_audit
AFTER INSERT OR UPDATE OR DELETE ON public.cultos
FOR EACH ROW EXECUTE FUNCTION public.log_culto_change();
