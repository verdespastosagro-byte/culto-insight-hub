ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fundo_animado text DEFAULT 'nenhum';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_fundo_animado_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_fundo_animado_check CHECK (fundo_animado IN ('nenhum','chuva','chuva_raio','neve'));