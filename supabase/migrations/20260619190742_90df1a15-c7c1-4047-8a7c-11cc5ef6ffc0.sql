
-- ===== helpers (SECURITY DEFINER, evitam recursão) =====
CREATE OR REPLACE FUNCTION public.is_profile_publico(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT perfil_publico FROM public.profile_privacy WHERE user_id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.is_check_in_owner_publico(_check_in_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_profile_publico(ci.user_id) FROM public.check_ins ci WHERE ci.id = _check_in_id
$$;

CREATE OR REPLACE FUNCTION public.is_check_in_owner(_check_in_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.check_ins WHERE id = _check_in_id AND user_id = _user_id)
$$;

GRANT EXECUTE ON FUNCTION public.is_profile_publico(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_check_in_owner_publico(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_check_in_owner(uuid, uuid)       TO authenticated;

-- ===== check_ins: SELECT = próprio OU dono é público =====
DROP POLICY IF EXISTS "Authenticated users can view all check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Users view own or public check-ins" ON public.check_ins;
CREATE POLICY "Users view own or public check-ins"
  ON public.check_ins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_profile_publico(user_id));

-- ===== profile_privacy: SELECT = qualquer autenticado =====
DROP POLICY IF EXISTS "Users can view their own privacy settings" ON public.profile_privacy;
DROP POLICY IF EXISTS "Authenticated users can read privacy" ON public.profile_privacy;
CREATE POLICY "Authenticated users can read privacy"
  ON public.profile_privacy FOR SELECT TO authenticated
  USING (true);

-- ===== comentarios: SELECT condicional ao tipo_alvo =====
DROP POLICY IF EXISTS "Authenticated users can view active comments" ON public.comentarios;
DROP POLICY IF EXISTS "View comments by target visibility" ON public.comentarios;
CREATE POLICY "View comments by target visibility"
  ON public.comentarios FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      -- mural de congregação: sempre visível
      tipo_alvo = 'congregacao_ccb'
      OR
      -- comentário em check_in: autor do comentário OU dono do check_in OU dono é público
      (tipo_alvo = 'check_in' AND (
        user_id = auth.uid()
        OR public.is_check_in_owner(alvo_id::uuid, auth.uid())
        OR public.is_check_in_owner_publico(alvo_id::uuid)
      ))
    )
  );
