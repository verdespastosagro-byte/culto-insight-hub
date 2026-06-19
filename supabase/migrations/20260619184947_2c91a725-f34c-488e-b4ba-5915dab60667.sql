-- 1) View: minhas congregações visitadas (filtra pelo usuário logado via security_invoker + RLS de check_ins)
CREATE OR REPLACE VIEW public.v_minhas_congregacoes_visitadas
WITH (security_invoker = true) AS
SELECT
  ci.user_id,
  ci.congregacao_ccb_id,
  cc.name        AS congregacao_nome,
  cc.city        AS congregacao_cidade,
  cc.uf          AS congregacao_uf,
  COUNT(*)::bigint AS total_visitas,
  MIN(ci.data_culto) AS primeira_visita,
  MAX(ci.data_culto) AS ultima_visita
FROM public.check_ins ci
JOIN public.congregacoes_ccb cc ON cc.id = ci.congregacao_ccb_id
WHERE ci.user_id = auth.uid()
GROUP BY ci.user_id, ci.congregacao_ccb_id, cc.name, cc.city, cc.uf;

GRANT SELECT ON public.v_minhas_congregacoes_visitadas TO authenticated;

-- 2) Visitantes de uma comum em uma data específica
CREATE OR REPLACE FUNCTION public.contar_visitantes_culto(
  p_congregacao_ccb_id bigint,
  p_data date
)
RETURNS TABLE (
  total bigint,
  publicos jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::bigint
       FROM public.check_ins ci
      WHERE ci.congregacao_ccb_id = p_congregacao_ccb_id
        AND ci.data_culto = p_data) AS total,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'user_id', p.id,
                'nome',    p.nome,
                'foto_url', p.foto_url
              ) ORDER BY p.nome)
         FROM public.check_ins ci
         JOIN public.profile_privacy pp ON pp.user_id = ci.user_id AND pp.perfil_publico = true
         JOIN public.profiles p         ON p.id = ci.user_id
        WHERE ci.congregacao_ccb_id = p_congregacao_ccb_id
          AND ci.data_culto = p_data),
      '[]'::jsonb
    ) AS publicos;
$$;

REVOKE ALL ON FUNCTION public.contar_visitantes_culto(bigint, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_visitantes_culto(bigint, date) TO authenticated;

-- 3) Total histórico de visitas a uma comum
CREATE OR REPLACE FUNCTION public.contar_visitas_totais_congregacao(
  p_congregacao_ccb_id bigint
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
    FROM public.check_ins
   WHERE congregacao_ccb_id = p_congregacao_ccb_id;
$$;

REVOKE ALL ON FUNCTION public.contar_visitas_totais_congregacao(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_visitas_totais_congregacao(bigint) TO authenticated;