
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'encarregado', 'cooperador', 'usuario');
CREATE TYPE public.tipo_reuniao AS ENUM ('culto_oficial','ensaio','jovens_menores','santa_ceia','ministerial','evangelizacao','especial','outro');
CREATE TYPE public.momento_hino AS ENUM ('entrada','antes_palavra','apos_palavra','encerramento','outro');
CREATE TYPE public.funcao_visitante AS ENUM ('irmao','cooperador','diacono','anciao','encarregado','cooperador_jovens','organista','musico','outro');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  cargo TEXT,
  congregacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_editor(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','encarregado','cooperador')
  )
$$;

CREATE POLICY "user_roles_select_self" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Função utilitária updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Trigger para criar profile e role default no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'usuario');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Congregações
CREATE TABLE public.congregacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cidade TEXT,
  estado TEXT,
  regiao TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.congregacoes TO authenticated;
GRANT ALL ON public.congregacoes TO service_role;
ALTER TABLE public.congregacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "congregacoes_select" ON public.congregacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "congregacoes_insert" ON public.congregacoes FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "congregacoes_update" ON public.congregacoes FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "congregacoes_delete" ON public.congregacoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_congregacoes_updated BEFORE UPDATE ON public.congregacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cultos
CREATE TABLE public.cultos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  horario TIME,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  cidade TEXT,
  tipo public.tipo_reuniao NOT NULL DEFAULT 'culto_oficial',
  participantes INTEGER,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cultos TO authenticated;
GRANT ALL ON public.cultos TO service_role;
ALTER TABLE public.cultos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cultos_select" ON public.cultos FOR SELECT TO authenticated USING (true);
CREATE POLICY "cultos_insert" ON public.cultos FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "cultos_update" ON public.cultos FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "cultos_delete" ON public.cultos FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cultos_updated BEFORE UPDATE ON public.cultos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_cultos_data ON public.cultos(data DESC);
CREATE INDEX idx_cultos_congregacao ON public.cultos(congregacao_id);

-- Hinos
CREATE TABLE public.hinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  titulo TEXT,
  momento public.momento_hino NOT NULL DEFAULT 'entrada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hinos TO authenticated;
GRANT ALL ON public.hinos TO service_role;
ALTER TABLE public.hinos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hinos_select" ON public.hinos FOR SELECT TO authenticated USING (true);
CREATE POLICY "hinos_write" ON public.hinos FOR ALL TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE INDEX idx_hinos_culto ON public.hinos(culto_id);
CREATE INDEX idx_hinos_numero ON public.hinos(numero);

-- Palavras
CREATE TABLE public.palavras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  nome_irmao TEXT NOT NULL,
  cargo TEXT,
  congregacao_origem TEXT,
  cidade_origem TEXT,
  texto_biblico TEXT,
  tema TEXT,
  resumo TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.palavras TO authenticated;
GRANT ALL ON public.palavras TO service_role;
ALTER TABLE public.palavras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "palavras_select" ON public.palavras FOR SELECT TO authenticated USING (true);
CREATE POLICY "palavras_write" ON public.palavras FOR ALL TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE INDEX idx_palavras_culto ON public.palavras(culto_id);

-- Atendimentos
CREATE TABLE public.atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cargo TEXT,
  congregacao_origem TEXT,
  cidade TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimentos TO authenticated;
GRANT ALL ON public.atendimentos TO service_role;
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atendimentos_select" ON public.atendimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "atendimentos_write" ON public.atendimentos FOR ALL TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE INDEX idx_atendimentos_culto ON public.atendimentos(culto_id);

-- Visitantes
CREATE TABLE public.visitantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  culto_id UUID REFERENCES public.cultos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  congregacao_origem TEXT,
  cidade TEXT,
  funcao public.funcao_visitante NOT NULL DEFAULT 'irmao',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitantes TO authenticated;
GRANT ALL ON public.visitantes TO service_role;
ALTER TABLE public.visitantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitantes_select" ON public.visitantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "visitantes_write" ON public.visitantes FOR ALL TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));

-- Músicos
CREATE TABLE public.musicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  instrumento TEXT,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.musicos TO authenticated;
GRANT ALL ON public.musicos TO service_role;
ALTER TABLE public.musicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "musicos_select" ON public.musicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "musicos_write" ON public.musicos FOR ALL TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE TRIGGER trg_musicos_updated BEFORE UPDATE ON public.musicos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Escalas de músicos
CREATE TABLE public.escalas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  musico_id UUID NOT NULL REFERENCES public.musicos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  culto_id UUID REFERENCES public.cultos(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalas TO authenticated;
GRANT ALL ON public.escalas TO service_role;
ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "escalas_select" ON public.escalas FOR SELECT TO authenticated USING (true);
CREATE POLICY "escalas_write" ON public.escalas FOR ALL TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));

-- Agenda de reuniões
CREATE TABLE public.agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  horario TIME,
  local TEXT,
  responsavel TEXT,
  tipo public.tipo_reuniao NOT NULL DEFAULT 'culto_oficial',
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda TO authenticated;
GRANT ALL ON public.agenda TO service_role;
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agenda_select" ON public.agenda FOR SELECT TO authenticated USING (true);
CREATE POLICY "agenda_write" ON public.agenda FOR ALL TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE TRIGGER trg_agenda_updated BEFORE UPDATE ON public.agenda FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
