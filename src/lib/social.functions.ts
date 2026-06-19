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

async function signAvatar(
  admin: { storage: { from: (b: string) => { createSignedUrl: (p: string, t: number) => Promise<{ data: { signedUrl: string } | null }> } } },
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  try {
    const { data } = await admin.storage.from("perfil-fotos").createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
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
      .select("user_id,data_culto,created_at,profile_privacy!inner(perfil_publico),profiles!inner(nome,foto_url)")
      .eq("congregacao_ccb_id", data.id)
      .eq("profile_privacy.perfil_publico", true)
      .order("created_at", { ascending: false })
      .limit(data.limite);

    const { count: totalAll } = await supabaseAdmin
      .from("check_ins")
      .select("user_id", { count: "exact", head: true })
      .eq("congregacao_ccb_id", data.id);

    const publicos: Visitante[] = [];
    const seen = new Set<string>();
    for (const r of (rows as Array<{ user_id: string; data_culto: string; profiles: { nome: string; foto_url: string | null } }>) ?? []) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      publicos.push({
        user_id: r.user_id,
        nome: r.profiles?.nome ?? "Irmão(ã)",
        foto_url: await signAvatar(supabaseAdmin, r.profiles?.foto_url ?? null),
        data_culto: r.data_culto,
      });
    }

    // contagem de usuários distintos no total
    const { data: distintosRows } = await supabaseAdmin
      .from("check_ins")
      .select("user_id")
      .eq("congregacao_ccb_id", data.id);
    const distintos = new Set((distintosRows as Array<{ user_id: string }> | null)?.map((r) => r.user_id) ?? []);
    const totalPrivados = Math.max(0, distintos.size - publicos.length);

    return { publicos, totalPrivados: totalAll == null ? totalPrivados : totalPrivados };
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

    // privacidade do autor
    const { data: priv } = await supabaseAdmin
      .from("profile_privacy")
      .select("perfil_publico")
      .eq("user_id", ci.user_id)
      .maybeSingle();
    const publico = !!priv?.perfil_publico;

    if (!isOwn && !publico) {
      return { checkIn: null, companheiros: [], podeVer: false };
    }

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("nome,foto_url")
      .eq("id", ci.user_id)
      .maybeSingle();
    const { data: comum } = await supabaseAdmin
      .from("congregacoes_ccb")
      .select("name,city,uf")
      .eq("id", ci.congregacao_ccb_id)
      .maybeSingle();

    // companheiros públicos da mesma comum + mesma data (exclui o próprio autor)
    const { data: comp } = await supabaseAdmin
      .from("check_ins")
      .select("user_id,data_culto,profile_privacy!inner(perfil_publico),profiles!inner(nome,foto_url)")
      .eq("congregacao_ccb_id", ci.congregacao_ccb_id)
      .eq("data_culto", ci.data_culto)
      .eq("profile_privacy.perfil_publico", true)
      .neq("user_id", ci.user_id)
      .limit(50);

    const companheiros: Visitante[] = [];
    for (const r of (comp as Array<{ user_id: string; data_culto: string; profiles: { nome: string; foto_url: string | null } }>) ?? []) {
      companheiros.push({
        user_id: r.user_id,
        nome: r.profiles?.nome ?? "Irmão(ã)",
        foto_url: await signAvatar(supabaseAdmin, r.profiles?.foto_url ?? null),
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
        autor_nome: (prof?.nome as string) ?? "Irmão(ã)",
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
      .select("id,user_id,texto,created_at,profiles!inner(nome,foto_url)")
      .eq("tipo_alvo", data.tipo_alvo)
      .eq("alvo_id", data.alvo_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limite);
    if (error) {
      console.error("listarComentarios", error);
      return { items: [] };
    }
    const items: ComentarioItem[] = [];
    for (const r of (rows as Array<{ id: string; user_id: string; texto: string; created_at: string; profiles: { nome: string; foto_url: string | null } }>) ?? []) {
      items.push({
        id: r.id,
        user_id: r.user_id,
        texto: r.texto,
        created_at: r.created_at,
        autor_nome: r.profiles?.nome ?? "Irmão(ã)",
        autor_foto_url: await signAvatar(supabaseAdmin, r.profiles?.foto_url ?? null),
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
