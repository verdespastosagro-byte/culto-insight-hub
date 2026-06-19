import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ComumDetalhe = {
  id: number;
  name: string;
  address: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  totalVisitas: number;
};

export type Visitante = {
  user_id: string;
  nome: string;
  foto_url: string | null;
  data_culto: string;
};

export type ComentarioItem = {
  id: string;
  user_id: string;
  texto: string;
  created_at: string;
  autor_nome: string;
  autor_foto_url: string | null;
};

export type CheckInDetalhe = {
  id: string;
  user_id: string;
  congregacao_ccb_id: number;
  data_culto: string;
  observacao: string | null;
  congregacao_nome: string;
  congregacao_cidade: string | null;
  congregacao_uf: string | null;
  autor_nome: string;
  autor_foto_url: string | null;
  autor_publico: boolean;
};

type AdminClient = {
  storage: {
    from: (b: string) => {
      createSignedUrl: (p: string, t: number) => Promise<{ data: { signedUrl: string } | null }>;
    };
  };
};

async function signAvatar(admin: AdminClient, path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const { data } = await admin.storage.from("perfil-fotos").createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

async function loadProfilesMap(
  admin: ReturnType<typeof Object> extends infer _ ? any : never, // eslint-disable-line @typescript-eslint/no-explicit-any
  userIds: string[],
): Promise<Map<string, { nome: string; foto_url: string | null }>> {
  const map = new Map<string, { nome: string; foto_url: string | null }>();
  if (!userIds.length) return map;
  const { data } = await admin
    .from("profiles")
    .select("id,nome,foto_url")
    .in("id", userIds);
  for (const p of (data as Array<{ id: string; nome: string; foto_url: string | null }>) ?? []) {
    map.set(p.id, { nome: p.nome ?? "Irmão(ã)", foto_url: p.foto_url ?? null });
  }
  return map;
}

async function loadPublicSet(
  admin: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userIds: string[],
): Promise<Set<string>> {
  const set = new Set<string>();
  if (!userIds.length) return set;
  const { data } = await admin
    .from("profile_privacy")
    .select("user_id,perfil_publico")
    .in("user_id", userIds);
  for (const r of (data as Array<{ user_id: string; perfil_publico: boolean }>) ?? []) {
    if (r.perfil_publico) set.add(r.user_id);
  }
  return set;
}

// ---------- Detalhe de comum ----------
export const getComumDetalhe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.coerce.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ comum: ComumDetalhe | null; error?: string }> => {
    const { data: row, error } = await context.supabase
      .from("congregacoes_ccb")
      .select("id,name,address,neighborhood,city,uf")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) return { comum: null, error: error?.message };
    const { data: tot } = await context.supabase.rpc("contar_visitas_totais_congregacao", {
      p_congregacao_ccb_id: data.id,
    });
    return {
      comum: {
        id: row.id as number,
        name: (row.name as string) ?? "",
        address: (row.address as string) ?? "",
        bairro: (row.neighborhood as string) ?? undefined,
        cidade: (row.city as string) ?? undefined,
        uf: ((row.uf as string) ?? "").toUpperCase() || undefined,
        totalVisitas: Number(tot ?? 0),
      },
    };
  });

// ---------- Visitantes recentes da comum (perfis públicos) ----------
export const listarVisitantesRecentesComum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.coerce.number().int().positive(), limite: z.number().int().min(1).max(50).default(20) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ publicos: Visitante[]; totalPrivados: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("check_ins")
      .select("user_id,data_culto,created_at")
      .eq("congregacao_ccb_id", data.id)
      .order("created_at", { ascending: false })
      .limit(300);

    const allUserIds = Array.from(new Set(((rows as Array<{ user_id: string }>) ?? []).map((r) => r.user_id)));
    const publicSet = await loadPublicSet(supabaseAdmin, allUserIds);
    const profilesMap = await loadProfilesMap(supabaseAdmin, Array.from(publicSet));

    const publicos: Visitante[] = [];
    const seen = new Set<string>();
    for (const r of (rows as Array<{ user_id: string; data_culto: string }>) ?? []) {
      if (!publicSet.has(r.user_id)) continue;
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      const prof = profilesMap.get(r.user_id);
      publicos.push({
        user_id: r.user_id,
        nome: prof?.nome ?? "Irmão(ã)",
        foto_url: await signAvatar(supabaseAdmin, prof?.foto_url ?? null),
        data_culto: r.data_culto,
      });
      if (publicos.length >= data.limite) break;
    }

    const totalPrivados = Math.max(0, allUserIds.length - publicSet.size);
    return { publicos, totalPrivados };
  });

// ---------- Detalhe de um check-in ----------
export const getCheckInDetalhe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ checkIn: CheckInDetalhe | null; companheiros: Visitante[]; podeVer: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ci } = await supabaseAdmin
      .from("check_ins")
      .select("id,user_id,congregacao_ccb_id,data_culto,observacao")
      .eq("id", data.id)
      .maybeSingle();
    if (!ci) return { checkIn: null, companheiros: [], podeVer: false };

    const isOwn = ci.user_id === context.userId;

    const publicSet = await loadPublicSet(supabaseAdmin, [ci.user_id as string]);
    const publico = publicSet.has(ci.user_id as string);

    if (!isOwn && !publico) {
      return { checkIn: null, companheiros: [], podeVer: false };
    }

    const profilesMap = await loadProfilesMap(supabaseAdmin, [ci.user_id as string]);
    const prof = profilesMap.get(ci.user_id as string);

    const { data: comum } = await supabaseAdmin
      .from("congregacoes_ccb")
      .select("name,city,uf")
      .eq("id", ci.congregacao_ccb_id as number)
      .maybeSingle();

    // companheiros públicos da mesma comum + mesma data
    const { data: comp } = await supabaseAdmin
      .from("check_ins")
      .select("user_id,data_culto")
      .eq("congregacao_ccb_id", ci.congregacao_ccb_id as number)
      .eq("data_culto", ci.data_culto as string)
      .neq("user_id", ci.user_id as string)
      .limit(100);

    const compIds = Array.from(new Set(((comp as Array<{ user_id: string }>) ?? []).map((r) => r.user_id)));
    const compPublic = await loadPublicSet(supabaseAdmin, compIds);
    const compProfiles = await loadProfilesMap(supabaseAdmin, Array.from(compPublic));

    const companheiros: Visitante[] = [];
    const seen = new Set<string>();
    for (const r of (comp as Array<{ user_id: string; data_culto: string }>) ?? []) {
      if (!compPublic.has(r.user_id) || seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      const p = compProfiles.get(r.user_id);
      companheiros.push({
        user_id: r.user_id,
        nome: p?.nome ?? "Irmão(ã)",
        foto_url: await signAvatar(supabaseAdmin, p?.foto_url ?? null),
        data_culto: r.data_culto,
      });
    }

    return {
      checkIn: {
        id: ci.id as string,
        user_id: ci.user_id as string,
        congregacao_ccb_id: ci.congregacao_ccb_id as number,
        data_culto: ci.data_culto as string,
        observacao: (ci.observacao as string) ?? null,
        congregacao_nome: (comum?.name as string) ?? "Congregação",
        congregacao_cidade: (comum?.city as string) ?? null,
        congregacao_uf: ((comum?.uf as string) ?? "").toUpperCase() || null,
        autor_nome: prof?.nome ?? "Irmão(ã)",
        autor_foto_url: await signAvatar(supabaseAdmin, prof?.foto_url ?? null),
        autor_publico: publico,
      },
      companheiros,
      podeVer: true,
    };
  });

// ---------- Comentários ----------
const TipoAlvo = z.enum(["check_in", "congregacao_ccb"]);

export const listarComentarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      tipo_alvo: TipoAlvo,
      alvo_id: z.string().min(1).max(64),
      limite: z.number().int().min(1).max(100).default(50),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ items: ComentarioItem[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("comentarios")
      .select("id,user_id,texto,created_at")
      .eq("tipo_alvo", data.tipo_alvo)
      .eq("alvo_id", data.alvo_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limite);
    if (error) {
      console.error("listarComentarios", error);
      return { items: [] };
    }
    const list = (rows as Array<{ id: string; user_id: string; texto: string; created_at: string }>) ?? [];
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    const profilesMap = await loadProfilesMap(supabaseAdmin, userIds);
    const items: ComentarioItem[] = [];
    for (const r of list) {
      const p = profilesMap.get(r.user_id);
      items.push({
        id: r.id,
        user_id: r.user_id,
        texto: r.texto,
        created_at: r.created_at,
        autor_nome: p?.nome ?? "Irmão(ã)",
        autor_foto_url: await signAvatar(supabaseAdmin, p?.foto_url ?? null),
      });
    }
    return { items };
  });

export const criarComentario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      tipo_alvo: TipoAlvo,
      alvo_id: z.string().min(1).max(64),
      texto: z.string().trim().min(1).max(1000),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: row, error } = await context.supabase
      .from("comentarios")
      .insert({
        tipo_alvo: data.tipo_alvo,
        alvo_id: data.alvo_id,
        texto: data.texto,
        user_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const excluirComentario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("comentarios")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
