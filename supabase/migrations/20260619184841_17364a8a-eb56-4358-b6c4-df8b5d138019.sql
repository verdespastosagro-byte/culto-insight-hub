CREATE TABLE public.comentarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_alvo text NOT NULL CHECK (tipo_alvo IN ('check_in', 'congregacao_ccb')),
  alvo_id text NOT NULL,
  texto text NOT NULL CHECK (length(trim(texto)) > 0 AND length(texto) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX comentarios_alvo_idx
  ON public.comentarios (tipo_alvo, alvo_id, created_at DESC);
CREATE INDEX comentarios_user_idx ON public.comentarios (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comentarios TO authenticated;
GRANT ALL ON public.comentarios TO service_role;

ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado vê comentários ativos; dono também vê os próprios apagados
CREATE POLICY "Authenticated users can view active comments"
  ON public.comentarios FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can create their own comments"
  ON public.comentarios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.comentarios FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.comentarios FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);