
-- =========================================================
-- Conversas + mensagens diretas com fluxo de solicitação
-- =========================================================

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_user_order CHECK (user_a < user_b),
  CONSTRAINT conversations_unique_pair UNIQUE (user_a, user_b)
);

GRANT SELECT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() IN (user_a, user_b));

-- update só para marcar accepted/last_message_at (controlado pelas RPCs);
-- mantemos o update aberto aos participantes mas restrito por trigger.
CREATE POLICY conversations_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (user_a, user_b))
  WITH CHECK (auth.uid() IN (user_a, user_b));

CREATE INDEX conversations_user_a_idx ON public.conversations(user_a, last_message_at DESC);
CREATE INDEX conversations_user_b_idx ON public.conversations(user_b, last_message_at DESC);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX messages_conv_created_idx ON public.messages(conversation_id, created_at DESC);

CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b)
  ));

-- só o destinatário pode marcar leitura
CREATE POLICY messages_update_read ON public.messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND auth.uid() IN (c.user_a, c.user_b)
      AND sender_id <> auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND auth.uid() IN (c.user_a, c.user_b)
      AND sender_id <> auth.uid()
  ));

-- =========================================================
-- Helpers
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_mutual_follow(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _a AND following_id = _b)
     AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _b AND following_id = _a);
$$;

-- =========================================================
-- RPC: enviar mensagem (cria/abre conversa, respeita solicitação)
-- =========================================================
CREATE OR REPLACE FUNCTION public.enviar_mensagem(_to uuid, _body text)
RETURNS public.messages
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_conv public.conversations;
  v_msg public.messages;
  v_mutual boolean;
  v_msg_count int;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _to IS NULL OR _to = v_me THEN RAISE EXCEPTION 'Destinatário inválido'; END IF;
  IF _body IS NULL OR char_length(btrim(_body)) = 0 THEN RAISE EXCEPTION 'Mensagem vazia'; END IF;
  IF char_length(_body) > 2000 THEN RAISE EXCEPTION 'Mensagem muito longa'; END IF;

  v_a := LEAST(v_me, _to);
  v_b := GREATEST(v_me, _to);
  v_mutual := public.is_mutual_follow(v_me, _to);

  SELECT * INTO v_conv FROM public.conversations WHERE user_a = v_a AND user_b = v_b;

  IF v_conv.id IS NULL THEN
    INSERT INTO public.conversations(user_a, user_b, status, requested_by, accepted_at)
    VALUES (v_a, v_b,
            CASE WHEN v_mutual THEN 'accepted' ELSE 'pending' END,
            v_me,
            CASE WHEN v_mutual THEN now() ELSE NULL END)
    RETURNING * INTO v_conv;
  ELSIF v_conv.status = 'pending' THEN
    IF v_mutual THEN
      UPDATE public.conversations SET status = 'accepted', accepted_at = now()
       WHERE id = v_conv.id RETURNING * INTO v_conv;
    ELSIF v_conv.requested_by <> v_me THEN
      -- destinatário respondendo a uma solicitação = aceita automaticamente
      UPDATE public.conversations SET status = 'accepted', accepted_at = now()
       WHERE id = v_conv.id RETURNING * INTO v_conv;
    ELSE
      -- mesmo solicitante tentando mandar de novo enquanto pendente
      SELECT count(*) INTO v_msg_count FROM public.messages WHERE conversation_id = v_conv.id;
      IF v_msg_count >= 1 THEN
        RAISE EXCEPTION 'Aguardando o destinatário aceitar sua solicitação';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.messages(conversation_id, sender_id, body)
  VALUES (v_conv.id, v_me, btrim(_body))
  RETURNING * INTO v_msg;

  UPDATE public.conversations SET last_message_at = now() WHERE id = v_conv.id;

  RETURN v_msg;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enviar_mensagem(uuid, text) TO authenticated;

-- =========================================================
-- RPC: aceitar / recusar conversa
-- =========================================================
CREATE OR REPLACE FUNCTION public.aceitar_conversa(_conv_id uuid)
RETURNS public.conversations
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_me uuid := auth.uid(); v_conv public.conversations;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_conv FROM public.conversations
   WHERE id = _conv_id AND v_me IN (user_a, user_b);
  IF v_conv.id IS NULL THEN RAISE EXCEPTION 'Conversa não encontrada'; END IF;
  IF v_conv.requested_by = v_me THEN RAISE EXCEPTION 'Você não pode aceitar sua própria solicitação'; END IF;
  UPDATE public.conversations SET status = 'accepted', accepted_at = now()
   WHERE id = _conv_id RETURNING * INTO v_conv;
  RETURN v_conv;
END;
$$;

CREATE OR REPLACE FUNCTION public.recusar_conversa(_conv_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  DELETE FROM public.conversations
   WHERE id = _conv_id
     AND v_me IN (user_a, user_b)
     AND status = 'pending'
     AND requested_by <> v_me;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceitar_conversa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recusar_conversa(uuid) TO authenticated;

-- =========================================================
-- RPC: marcar conversa como lida
-- =========================================================
CREATE OR REPLACE FUNCTION public.marcar_conversa_lida(_conv_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  UPDATE public.messages SET read_at = now()
   WHERE conversation_id = _conv_id
     AND sender_id <> v_me
     AND read_at IS NULL
     AND EXISTS (SELECT 1 FROM public.conversations c
                  WHERE c.id = _conv_id AND v_me IN (c.user_a, c.user_b));
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_conversa_lida(uuid) TO authenticated;

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
