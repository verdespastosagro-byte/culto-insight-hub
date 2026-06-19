
CREATE TABLE public.plan_configs (
  plan text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_label text NOT NULL DEFAULT 'R$ 0',
  period_label text NOT NULL DEFAULT '/mês',
  cta_label text NOT NULL DEFAULT 'Assinar',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  highlight boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_configs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plan_configs TO authenticated;
GRANT ALL ON public.plan_configs TO service_role;

ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plans" ON public.plan_configs
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert plans" ON public.plan_configs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update plans" ON public.plan_configs
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete plans" ON public.plan_configs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER plan_configs_updated_at
  BEFORE UPDATE ON public.plan_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.plan_configs (plan, label, description, price_label, period_label, cta_label, features, highlight, sort_order) VALUES
  ('free','Free','Para começar','R$ 0','/sempre','Começar grátis',
    '["1 congregação","30 cultos por mês","Relatórios básicos"]'::jsonb, false, 1),
  ('pro','Pro','Para a sua igreja','R$ 47','/mês','Assinar Pro',
    '["Congregações ilimitadas","Cultos ilimitados","Relatórios PDF + Excel","Insights IA","Culto Inteligente (10 gravações/mês)","Até 5 usuários"]'::jsonb, true, 2),
  ('church','Church','Para múltiplas congregações','R$ 127','/mês','Assinar Church',
    '["Tudo do Pro","Usuários ilimitados","Culto Inteligente ilimitado","Suporte prioritário","Exportação avançada"]'::jsonb, false, 3);
