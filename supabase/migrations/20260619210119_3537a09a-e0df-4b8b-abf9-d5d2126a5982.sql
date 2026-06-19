ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS congregacao_ccb_id BIGINT REFERENCES public.congregacoes_ccb(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_congregacao_ccb_id ON public.profiles(congregacao_ccb_id);