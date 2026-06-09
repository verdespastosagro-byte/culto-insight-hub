
-- Função que devolve a org do usuário atual (auth.uid())
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
   WHERE user_id = auth.uid()
   ORDER BY created_at ASC LIMIT 1
$$;

-- Defaults
ALTER TABLE public.cultos              ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
ALTER TABLE public.congregacoes        ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
ALTER TABLE public.hinos               ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
ALTER TABLE public.palavras            ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
ALTER TABLE public.atendimentos        ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
ALTER TABLE public.visitantes          ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
ALTER TABLE public.musicos             ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
ALTER TABLE public.agenda              ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
ALTER TABLE public.escalas             ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
ALTER TABLE public.cultos_inteligentes ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();
