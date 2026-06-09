
-- =========================================================
-- FASE 1: Multi-tenant foundation + planos
-- =========================================================

-- Enums
CREATE TYPE public.org_plan AS ENUM ('free', 'pro', 'church');
CREATE TYPE public.org_plan_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- Tabela organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  plan public.org_plan NOT NULL DEFAULT 'free',
  plan_status public.org_plan_status NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  stripe_customer_id text,
  stripe_subscription_id text,
  cidade text,
  estado text,
  timezone text DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Tabela organization_members
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'viewer',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX ON public.organization_members(user_id);
CREATE INDEX ON public.organization_members(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Tabela organization_invites
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.org_role NOT NULL DEFAULT 'editor',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.organization_invites(organization_id);
CREATE INDEX ON public.organization_invites(email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites TO authenticated;
GRANT ALL ON public.organization_invites TO service_role;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Coluna onboarding_completed em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Helper functions (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id ORDER BY created_at ASC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id = _org_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _user_id uuid, _roles public.org_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_org(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND role IN ('owner','admin','editor')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_org(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND role IN ('owner','admin')
  )
$$;

-- Trigger updated_at em organizations
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- BACKFILL: criar organização "default" para dados existentes
-- =========================================================
DO $$
DECLARE
  v_default_org uuid;
  v_first_user uuid;
BEGIN
  -- pega o primeiro usuário (mais antigo)
  SELECT id INTO v_first_user FROM auth.users ORDER BY created_at ASC LIMIT 1;

  IF v_first_user IS NOT NULL THEN
    INSERT INTO public.organizations (name, slug, plan, plan_status, trial_ends_at)
    VALUES ('Minha Congregação', 'default', 'pro', 'active', now() + interval '365 days')
    RETURNING id INTO v_default_org;

    -- adiciona TODOS os usuários existentes como membros (primeiro = owner, demais = editor)
    INSERT INTO public.organization_members (organization_id, user_id, role)
    SELECT v_default_org, u.id,
      CASE WHEN u.id = v_first_user THEN 'owner'::public.org_role ELSE 'editor'::public.org_role END
    FROM auth.users u;
  END IF;
END $$;

-- Adicionar coluna organization_id em todas as tabelas operacionais
ALTER TABLE public.cultos              ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.congregacoes        ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.hinos               ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.palavras            ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.atendimentos        ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.visitantes          ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.musicos             ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.agenda              ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.escalas             ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cultos_inteligentes ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill: atribuir tudo à organização default
UPDATE public.cultos              SET organization_id = (SELECT id FROM public.organizations WHERE slug='default');
UPDATE public.congregacoes        SET organization_id = (SELECT id FROM public.organizations WHERE slug='default');
UPDATE public.hinos               SET organization_id = (SELECT id FROM public.organizations WHERE slug='default');
UPDATE public.palavras            SET organization_id = (SELECT id FROM public.organizations WHERE slug='default');
UPDATE public.atendimentos        SET organization_id = (SELECT id FROM public.organizations WHERE slug='default');
UPDATE public.visitantes          SET organization_id = (SELECT id FROM public.organizations WHERE slug='default');
UPDATE public.musicos             SET organization_id = (SELECT id FROM public.organizations WHERE slug='default');
UPDATE public.agenda              SET organization_id = (SELECT id FROM public.organizations WHERE slug='default');
UPDATE public.escalas             SET organization_id = (SELECT id FROM public.organizations WHERE slug='default');
UPDATE public.cultos_inteligentes SET organization_id = (SELECT id FROM public.organizations WHERE slug='default');

-- Tornar organization_id NOT NULL onde houver organização default
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug='default') THEN
    ALTER TABLE public.cultos              ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE public.congregacoes        ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE public.hinos               ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE public.palavras            ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE public.atendimentos        ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE public.visitantes          ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE public.musicos             ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE public.agenda              ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE public.escalas             ALTER COLUMN organization_id SET NOT NULL;
    ALTER TABLE public.cultos_inteligentes ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX ON public.cultos(organization_id);
CREATE INDEX ON public.congregacoes(organization_id);
CREATE INDEX ON public.hinos(organization_id);
CREATE INDEX ON public.palavras(organization_id);
CREATE INDEX ON public.atendimentos(organization_id);
CREATE INDEX ON public.visitantes(organization_id);
CREATE INDEX ON public.musicos(organization_id);
CREATE INDEX ON public.agenda(organization_id);
CREATE INDEX ON public.escalas(organization_id);
CREATE INDEX ON public.cultos_inteligentes(organization_id);

-- =========================================================
-- POLICIES DAS NOVAS TABELAS
-- =========================================================
-- organizations: membros veem; owner/admin atualizam; ninguém deleta direto
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));
CREATE POLICY organizations_update ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

-- organization_members: membros veem da própria org; owner/admin gerenciam
CREATE POLICY org_members_select ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY org_members_insert ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY org_members_update ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY org_members_delete ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

-- organization_invites: gerenciado por owner/admin
CREATE POLICY org_invites_select ON public.organization_invites FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY org_invites_write ON public.organization_invites FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

-- =========================================================
-- REESCREVER POLICIES DAS TABELAS OPERACIONAIS
-- =========================================================

-- profiles: usuário vê o próprio + membros da mesma org
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;
CREATE POLICY profiles_select_org ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.organization_members me
      JOIN public.organization_members other ON other.organization_id = me.organization_id
      WHERE me.user_id = auth.uid() AND other.user_id = public.profiles.id
    )
  );

-- congregacoes
DROP POLICY IF EXISTS congregacoes_select ON public.congregacoes;
DROP POLICY IF EXISTS congregacoes_insert ON public.congregacoes;
DROP POLICY IF EXISTS congregacoes_update ON public.congregacoes;
DROP POLICY IF EXISTS congregacoes_delete ON public.congregacoes;
CREATE POLICY congregacoes_select ON public.congregacoes FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY congregacoes_insert ON public.congregacoes FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));
CREATE POLICY congregacoes_update ON public.congregacoes FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));
CREATE POLICY congregacoes_delete ON public.congregacoes FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_manage_org(auth.uid()));

-- cultos
DROP POLICY IF EXISTS cultos_select ON public.cultos;
DROP POLICY IF EXISTS cultos_insert ON public.cultos;
DROP POLICY IF EXISTS cultos_update ON public.cultos;
DROP POLICY IF EXISTS cultos_delete ON public.cultos;
CREATE POLICY cultos_select ON public.cultos FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY cultos_insert ON public.cultos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));
CREATE POLICY cultos_update ON public.cultos FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));
CREATE POLICY cultos_delete ON public.cultos FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_manage_org(auth.uid()));

-- hinos
DROP POLICY IF EXISTS hinos_select ON public.hinos;
DROP POLICY IF EXISTS hinos_write ON public.hinos;
CREATE POLICY hinos_select ON public.hinos FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY hinos_write ON public.hinos FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));

-- palavras
DROP POLICY IF EXISTS palavras_select ON public.palavras;
DROP POLICY IF EXISTS palavras_write ON public.palavras;
CREATE POLICY palavras_select ON public.palavras FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY palavras_write ON public.palavras FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));

-- atendimentos
DROP POLICY IF EXISTS atendimentos_select ON public.atendimentos;
DROP POLICY IF EXISTS atendimentos_write ON public.atendimentos;
CREATE POLICY atendimentos_select ON public.atendimentos FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY atendimentos_write ON public.atendimentos FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));

-- visitantes
DROP POLICY IF EXISTS visitantes_select ON public.visitantes;
DROP POLICY IF EXISTS visitantes_write ON public.visitantes;
CREATE POLICY visitantes_select ON public.visitantes FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY visitantes_write ON public.visitantes FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));

-- musicos
DROP POLICY IF EXISTS musicos_select ON public.musicos;
DROP POLICY IF EXISTS musicos_write ON public.musicos;
CREATE POLICY musicos_select ON public.musicos FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY musicos_write ON public.musicos FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));

-- agenda
DROP POLICY IF EXISTS agenda_select ON public.agenda;
DROP POLICY IF EXISTS agenda_write ON public.agenda;
CREATE POLICY agenda_select ON public.agenda FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY agenda_write ON public.agenda FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));

-- escalas
DROP POLICY IF EXISTS escalas_select ON public.escalas;
DROP POLICY IF EXISTS escalas_write ON public.escalas;
CREATE POLICY escalas_select ON public.escalas FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY escalas_write ON public.escalas FOR ALL TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND public.can_edit_org(auth.uid()));

-- cultos_inteligentes: agora filtra por org; mantém user_id como criador
DROP POLICY IF EXISTS "dono ve seus cultos inteligentes" ON public.cultos_inteligentes;
DROP POLICY IF EXISTS "dono insere" ON public.cultos_inteligentes;
DROP POLICY IF EXISTS "dono atualiza" ON public.cultos_inteligentes;
DROP POLICY IF EXISTS "dono deleta" ON public.cultos_inteligentes;
CREATE POLICY cultos_inteligentes_select ON public.cultos_inteligentes FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY cultos_inteligentes_insert ON public.cultos_inteligentes FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY cultos_inteligentes_update ON public.cultos_inteligentes FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND (user_id = auth.uid() OR public.can_manage_org(auth.uid())));
CREATE POLICY cultos_inteligentes_delete ON public.cultos_inteligentes FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org_id(auth.uid()) AND (user_id = auth.uid() OR public.can_manage_org(auth.uid())));

-- =========================================================
-- TRIGGER: ao criar usuário, criar organization e adicionar como owner
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_nome text;
  v_invite RECORD;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1));

  INSERT INTO public.profiles (id, nome, email) VALUES (NEW.id, v_nome, NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'usuario');

  -- Se há convite pendente para este email, juntar a essa organização
  SELECT * INTO v_invite FROM public.organization_invites
   WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL AND expires_at > now()
   ORDER BY created_at DESC LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
    VALUES (v_invite.organization_id, NEW.id, v_invite.role, v_invite.invited_by);
    UPDATE public.organization_invites SET accepted_at = now() WHERE id = v_invite.id;
  ELSE
    -- cria nova organização
    INSERT INTO public.organizations (name, plan, plan_status, trial_ends_at)
    VALUES (v_nome || ' (Congregação)', 'free', 'trialing', now() + interval '14 days')
    RETURNING id INTO v_org_id;
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, NEW.id, 'owner');
  END IF;

  RETURN NEW;
END; $$;

-- Trigger (idempotente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
