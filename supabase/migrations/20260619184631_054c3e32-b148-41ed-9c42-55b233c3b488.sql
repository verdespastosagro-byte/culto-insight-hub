CREATE TABLE public.profile_privacy (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil_publico boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_privacy TO authenticated;
GRANT ALL ON public.profile_privacy TO service_role;

ALTER TABLE public.profile_privacy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own privacy settings"
  ON public.profile_privacy FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own privacy settings"
  ON public.profile_privacy FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own privacy settings"
  ON public.profile_privacy FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own privacy settings"
  ON public.profile_privacy FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER profile_privacy_set_updated_at
  BEFORE UPDATE ON public.profile_privacy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Garante linha padrão (perfil_publico = false) para todo usuário novo
CREATE OR REPLACE FUNCTION public.handle_new_user_privacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile_privacy (user_id, perfil_publico)
  VALUES (NEW.id, false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_privacy
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_privacy();

-- Backfill para usuários já existentes
INSERT INTO public.profile_privacy (user_id, perfil_publico)
SELECT id, false FROM auth.users
ON CONFLICT (user_id) DO NOTHING;