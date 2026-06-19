
-- 1) Função SECURITY DEFINER para checar privacidade do dono do alvo
--    (evita recursão de RLS, padrão has_role / is_profile_publico)
CREATE OR REPLACE FUNCTION public.dono_do_alvo_eh_publico(p_tipo text, p_alvo_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF p_tipo = 'congregacao_ccb' THEN
    -- mural público da comum: sempre permitido
    RETURN true;
  ELSIF p_tipo = 'check_in' THEN
    SELECT user_id INTO v_owner FROM public.check_ins WHERE id = p_alvo_id::uuid;
    IF v_owner IS NULL THEN
      RETURN false;
    END IF;
    RETURN public.is_profile_publico(v_owner);
  ELSE
    -- tipos ainda não suportados (post, culto) — negar até a regra estar definida
    RETURN false;
  END IF;
END;
$$;

-- 2) Endurecer a policy de INSERT em comentarios:
--    além de auth.uid() = user_id, exigir que o alvo aceite comentário
DROP POLICY IF EXISTS "Users can create their own comments" ON public.comentarios;

CREATE POLICY "Users can create their own comments"
  ON public.comentarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.dono_do_alvo_eh_publico(tipo_alvo, alvo_id)
  );
