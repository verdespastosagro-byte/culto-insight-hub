
-- Tabela cultos_inteligentes
CREATE TABLE public.cultos_inteligentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  culto_id uuid REFERENCES public.cultos(id) ON DELETE SET NULL,
  congregacao_id uuid REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz,
  duracao_segundos integer,
  latitude double precision,
  longitude double precision,
  cidade_detectada text,
  audio_path text,
  audio_size_bytes bigint,
  audio_mime text,
  transcricao_texto text,
  transcricao_json jsonb,
  extracao_json jsonb,
  status text NOT NULL DEFAULT 'gravando',
  erro_mensagem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cultos_inteligentes TO authenticated;
GRANT ALL ON public.cultos_inteligentes TO service_role;

ALTER TABLE public.cultos_inteligentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dono ve seus cultos inteligentes"
ON public.cultos_inteligentes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "dono insere"
ON public.cultos_inteligentes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "dono atualiza"
ON public.cultos_inteligentes FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "dono deleta"
ON public.cultos_inteligentes FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_cultos_inteligentes_updated
BEFORE UPDATE ON public.cultos_inteligentes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_cultos_inteligentes_user ON public.cultos_inteligentes(user_id, iniciado_em DESC);
CREATE INDEX idx_cultos_inteligentes_transcricao ON public.cultos_inteligentes USING gin (to_tsvector('portuguese', coalesce(transcricao_texto, '')));

-- Storage policies para bucket cultos-audio (privado, dono = primeira pasta = user_id)
CREATE POLICY "audio dono le"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cultos-audio' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "audio dono insere"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cultos-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "audio dono atualiza"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'cultos-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "audio dono deleta"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cultos-audio' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
