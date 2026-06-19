import { supabase } from "@/integrations/supabase/client";

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  status: "pending" | "accepted";
  requested_by: string;
  last_message_at: string;
  accepted_at: string | null;
  created_at: string;
  other: { id: string; nome: string | null; foto_url: string | null };
  last_message?: { body: string; sender_id: string; created_at: string } | null;
  unread: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export async function listConversations(meId: string): Promise<Conversation[]> {
  const { data: convs, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`user_a.eq.${meId},user_b.eq.${meId}`)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  if (!convs || convs.length === 0) return [];

  const otherIds = Array.from(
    new Set(convs.map((c) => (c.user_a === meId ? c.user_b : c.user_a))),
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nome, foto_url")
    .in("id", otherIds);
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const ids = convs.map((c) => c.id);
  const { data: lasts } = await supabase
    .from("messages")
    .select("conversation_id, body, sender_id, created_at, read_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });

  const lastMap = new Map<string, { body: string; sender_id: string; created_at: string }>();
  const unreadMap = new Map<string, number>();
  for (const m of lasts ?? []) {
    if (!lastMap.has(m.conversation_id)) {
      lastMap.set(m.conversation_id, {
        body: m.body,
        sender_id: m.sender_id,
        created_at: m.created_at,
      });
    }
    if (!m.read_at && m.sender_id !== meId) {
      unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
    }
  }

  return convs.map((c) => {
    const otherId = c.user_a === meId ? c.user_b : c.user_a;
    const p = pmap.get(otherId);
    return {
      ...(c as Omit<Conversation, "other" | "last_message" | "unread">),
      other: { id: otherId, nome: p?.nome ?? null, foto_url: p?.foto_url ?? null },
      last_message: lastMap.get(c.id) ?? null,
      unread: unreadMap.get(c.id) ?? 0,
    } as Conversation;
  });
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(toUserId: string, body: string) {
  const { data, error } = await supabase.rpc("enviar_mensagem", {
    _to: toUserId,
    _body: body,
  });
  if (error) throw error;
  return data as Message;
}

export async function acceptConversation(convId: string) {
  const { error } = await supabase.rpc("aceitar_conversa", { _conv_id: convId });
  if (error) throw error;
}

export async function declineConversation(convId: string) {
  const { error } = await supabase.rpc("recusar_conversa", { _conv_id: convId });
  if (error) throw error;
}

export async function markRead(convId: string) {
  await supabase.rpc("marcar_conversa_lida", { _conv_id: convId });
}

export async function getConversationWith(meId: string, otherId: string) {
  const a = meId < otherId ? meId : otherId;
  const b = meId < otherId ? otherId : meId;
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  return data as Conversation | null;
}

export async function isMutualFollow(meId: string, otherId: string) {
  const { data } = await supabase
    .from("follows")
    .select("follower_id,following_id")
    .or(
      `and(follower_id.eq.${meId},following_id.eq.${otherId}),and(follower_id.eq.${otherId},following_id.eq.${meId})`,
    );
  return (data ?? []).length >= 2;
}

export async function searchFollowers(meId: string, query: string) {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  const [{ data: following }, { data: followers }] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", meId),
    supabase.from("follows").select("follower_id").eq("following_id", meId),
  ]);

  const ids = Array.from(
    new Set([
      ...(following?.map((f) => f.following_id) ?? []),
      ...(followers?.map((f) => f.follower_id) ?? []),
    ]),
  );

  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nome, foto_url")
    .in("id", ids)
    .ilike("nome", `%${q}%`)
    .limit(10);

  return (profiles ?? []) as { id: string; nome: string | null; foto_url: string | null }[];
}
