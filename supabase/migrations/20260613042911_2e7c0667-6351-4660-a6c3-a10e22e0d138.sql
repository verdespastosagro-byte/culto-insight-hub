
CREATE TABLE public.congregacoes_ccb (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  cep TEXT,
  neighborhood TEXT,
  city TEXT,
  uf TEXT,
  cultos TEXT,
  rjm TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_congregacoes_ccb_lat ON public.congregacoes_ccb(lat);
CREATE INDEX idx_congregacoes_ccb_lng ON public.congregacoes_ccb(lng);
CREATE INDEX idx_congregacoes_ccb_city ON public.congregacoes_ccb(city, uf);

GRANT SELECT ON public.congregacoes_ccb TO anon, authenticated;
GRANT ALL ON public.congregacoes_ccb TO service_role;

ALTER TABLE public.congregacoes_ccb ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read CCB directory"
  ON public.congregacoes_ccb FOR SELECT
  USING (true);

CREATE POLICY "Admins manage CCB directory"
  ON public.congregacoes_ccb FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
