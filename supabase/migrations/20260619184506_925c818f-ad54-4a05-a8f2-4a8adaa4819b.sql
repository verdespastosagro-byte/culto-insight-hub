CREATE TABLE public.check_ins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  congregacao_ccb_id bigint NOT NULL REFERENCES public.congregacoes_ccb(id) ON DELETE CASCADE,
  data_culto date NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_ins_unique_user_local_data UNIQUE (user_id, congregacao_ccb_id, data_culto),
  CONSTRAINT check_ins_observacao_len CHECK (observacao IS NULL OR char_length(observacao) <= 500),
  CONSTRAINT check_ins_data_culto_range CHECK (data_culto >= DATE '2000-01-01')
);

CREATE INDEX check_ins_congregacao_data_idx ON public.check_ins (congregacao_ccb_id, data_culto DESC);
CREATE INDEX check_ins_user_idx ON public.check_ins (user_id);
CREATE INDEX check_ins_created_at_idx ON public.check_ins (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all check-ins"
  ON public.check_ins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own check-ins"
  ON public.check_ins FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND data_culto <= (CURRENT_DATE + INTERVAL '1 day')
  );

CREATE POLICY "Users can update their own check-ins"
  ON public.check_ins FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND data_culto <= (CURRENT_DATE + INTERVAL '1 day')
  );

CREATE POLICY "Users can delete their own check-ins"
  ON public.check_ins FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);