
-- FOLLOWS
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows readable by authenticated" ON public.follows
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows insert by follower" ON public.follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows delete by follower" ON public.follows
  FOR DELETE TO authenticated USING (auth.uid() = follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows(following_id);

-- POSTS
CREATE TABLE IF NOT EXISTS public.posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto      text CHECK (texto IS NULL OR length(texto) <= 2000),
  foto_url   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (texto IS NOT NULL OR foto_url IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts view own or public" ON public.posts
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (user_id = auth.uid() OR public.is_profile_publico(user_id)));
CREATE POLICY "posts insert own" ON public.posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts update own" ON public.posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts delete own" ON public.posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS posts_user_created_idx ON public.posts(user_id, created_at DESC);

-- STORAGE posts-fotos
CREATE POLICY "posts fotos read auth" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'posts-fotos');
CREATE POLICY "posts fotos insert owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts-fotos' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "posts fotos update owner" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'posts-fotos' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'posts-fotos' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "posts fotos delete owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'posts-fotos' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- COMENTARIOS: aceitar post e culto
ALTER TABLE public.comentarios DROP CONSTRAINT IF EXISTS comentarios_tipo_alvo_check;
ALTER TABLE public.comentarios
  ADD CONSTRAINT comentarios_tipo_alvo_check
  CHECK (tipo_alvo IN ('check_in','congregacao_ccb','post','culto'));

CREATE OR REPLACE FUNCTION public.dono_do_alvo_eh_publico(p_tipo text, p_alvo_id text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF p_tipo = 'congregacao_ccb' THEN RETURN true;
  ELSIF p_tipo = 'culto' THEN RETURN true;
  ELSIF p_tipo = 'check_in' THEN
    SELECT user_id INTO v_owner FROM public.check_ins WHERE id = p_alvo_id::uuid;
    IF v_owner IS NULL THEN RETURN false; END IF;
    RETURN public.is_profile_publico(v_owner);
  ELSIF p_tipo = 'post' THEN
    SELECT user_id INTO v_owner FROM public.posts WHERE id = p_alvo_id::uuid AND deleted_at IS NULL;
    IF v_owner IS NULL THEN RETURN false; END IF;
    RETURN public.is_profile_publico(v_owner);
  ELSE RETURN false;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.is_post_owner(_post_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.posts WHERE id = _post_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_post_owner_publico(_post_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_profile_publico(p.user_id) FROM public.posts p WHERE p.id = _post_id
$$;

DROP POLICY IF EXISTS "View comments by target visibility" ON public.comentarios;
CREATE POLICY "View comments by target visibility" ON public.comentarios
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      tipo_alvo = 'congregacao_ccb' OR tipo_alvo = 'culto'
      OR (tipo_alvo = 'check_in' AND (
        user_id = auth.uid()
        OR public.is_check_in_owner(alvo_id::uuid, auth.uid())
        OR public.is_check_in_owner_publico(alvo_id::uuid)))
      OR (tipo_alvo = 'post' AND (
        user_id = auth.uid()
        OR public.is_post_owner(alvo_id::uuid, auth.uid())
        OR public.is_post_owner_publico(alvo_id::uuid)))
    )
  );

-- RPCs
CREATE OR REPLACE FUNCTION public.minhas_congregacoes_visitadas(p_user_id uuid)
RETURNS TABLE (
  congregacao_ccb_id bigint, nome text, cidade text, uf text,
  qtd_visitas bigint, primeira_visita date, ultima_visita date
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.city, c.uf,
         COUNT(ci.*)::bigint, MIN(ci.data_culto), MAX(ci.data_culto)
    FROM public.check_ins ci
    JOIN public.congregacoes_ccb c ON c.id = ci.congregacao_ccb_id
   WHERE ci.user_id = p_user_id
     AND (p_user_id = auth.uid() OR public.is_profile_publico(p_user_id))
   GROUP BY c.id, c.name, c.city, c.uf
   ORDER BY MAX(ci.data_culto) DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.quem_congregou_junto(p_congregacao_ccb_id bigint, p_data date)
RETURNS TABLE (total_geral bigint, publicos jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT COUNT(*)::bigint FROM public.check_ins ci
      WHERE ci.congregacao_ccb_id = p_congregacao_ccb_id AND ci.data_culto = p_data),
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'user_id', p.id, 'nome', p.nome, 'foto_url', p.foto_url
              ) ORDER BY p.nome)
         FROM public.check_ins ci
         JOIN public.profile_privacy pp ON pp.user_id = ci.user_id AND pp.perfil_publico = true
         JOIN public.profiles p         ON p.id = ci.user_id
        WHERE ci.congregacao_ccb_id = p_congregacao_ccb_id
          AND ci.data_culto = p_data),
      '[]'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.contar_congregacoes_pessoa(p_user_id uuid)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count bigint;
BEGIN
  IF p_user_id <> auth.uid() AND NOT public.is_profile_publico(p_user_id) THEN
    RETURN NULL;
  END IF;
  SELECT COUNT(DISTINCT congregacao_ccb_id) INTO v_count
    FROM public.check_ins WHERE user_id = p_user_id;
  RETURN v_count;
END; $$;
