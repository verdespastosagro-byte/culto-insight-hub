import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.5).max(50),
});

export type CCBHorario = {
  diaSemana: number; // 0=Domingo ... 6=Sábado
  diaLabel: string;
  hora: string; // "19:30"
  tipo: "culto" | "rjm";
};

export type CCBChurch = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  bairro?: string;
  horarios?: CCBHorario[];
  cidade?: string;
  uf?: string;
};

const DIA_ABREV: Record<string, { idx: number; label: string }> = {
  dom: { idx: 0, label: "Domingo" },
  seg: { idx: 1, label: "Segunda" },
  ter: { idx: 2, label: "Terça" },
  qua: { idx: 3, label: "Quarta" },
  qui: { idx: 4, label: "Quinta" },
  sex: { idx: 5, label: "Sexta" },
  sab: { idx: 6, label: "Sábado" },
};

function parseHorariosString(raw: string | null | undefined, tipo: "culto" | "rjm"): CCBHorario[] {
  if (!raw || raw === "—") return [];
  const out: CCBHorario[] = [];
  const re = /(Dom|Seg|Ter|Qua|Qui|Sex|S[áa]b)\s+(\d{1,2}):(\d{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const key = m[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3);
    const d = DIA_ABREV[key];
    if (!d) continue;
    out.push({
      diaSemana: d.idx,
      diaLabel: d.label,
      hora: `${m[2].padStart(2, "0")}:${m[3]}`,
      tipo,
    });
  }
  return out;
}

type Row = {
  code: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  uf: string | null;
  cultos: string | null;
  rjm: string | null;
  lat: number;
  lng: number;
};

function rowToChurch(r: Row, dist?: number): CCBChurch {
  const horarios = [...parseHorariosString(r.cultos, "culto"), ...parseHorariosString(r.rjm, "rjm")];
  return {
    id: r.code,
    name: r.name,
    address: r.address ?? "",
    lat: r.lat,
    lng: r.lng,
    bairro: r.neighborhood ?? undefined,
    cidade: r.city ?? undefined,
    uf: r.uf ?? undefined,
    horarios,
    ...(dist !== undefined ? { distancia: dist } : {}),
  };
}

export const buscarCongregacoes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<{ items: CCBChurch[]; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // bounding box rápido para filtragem inicial
    const R = 6371;
    const dLat = (data.radiusKm / R) * (180 / Math.PI);
    const dLng =
      (data.radiusKm / (R * Math.cos((data.lat * Math.PI) / 180))) * (180 / Math.PI);

    const { data: rows, error } = await supabaseAdmin
      .from("congregacoes_ccb")
      .select("code,name,address,neighborhood,city,uf,cultos,rjm,lat,lng")
      .gte("lat", data.lat - dLat)
      .lte("lat", data.lat + dLat)
      .gte("lng", data.lng - dLng)
      .lte("lng", data.lng + dLng)
      .limit(500);

    if (error) {
      console.error("buscarCongregacoes db error", error);
      return { items: [], error: "Erro ao consultar a base de congregações." };
    }

    // distância real (Haversine) + filtro de raio + ordenação
    const items = (rows as Row[])
      .map((r) => {
        const dLatR = ((r.lat - data.lat) * Math.PI) / 180;
        const dLngR = ((r.lng - data.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLatR / 2) ** 2 +
          Math.cos((data.lat * Math.PI) / 180) *
            Math.cos((r.lat * Math.PI) / 180) *
            Math.sin(dLngR / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { row: r, dist };
      })
      .filter((x) => x.dist <= data.radiusKm)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 100)
      .map((x) => rowToChurch(x.row, x.dist));

    return { items };
  });

// Listagem por cidade (usada na tela "Nova congregação")
const ListarInput = z.object({
  cidade: z.string().min(1).max(120),
  uf: z.string().length(2),
});

export type CongregacaoCidade = {
  endereco: string;
  bairro?: string;
  horarios: CCBHorario[];
};

export const listarCongregacoesPorCidade = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ListarInput.parse(data))
  .handler(async ({ data }): Promise<{ items: CongregacaoCidade[]; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("congregacoes_ccb")
      .select("address,neighborhood,cultos,rjm")
      .ilike("city", data.cidade)
      .ilike("uf", data.uf)
      .order("neighborhood", { ascending: true })
      .limit(500);

    if (error) {
      console.error("listarCongregacoesPorCidade db error", error);
      return { items: [], error: "Erro ao buscar congregações da cidade." };
    }

    const items: CongregacaoCidade[] = (rows ?? []).map((r) => ({
      endereco: r.address ?? "",
      bairro: r.neighborhood ?? undefined,
      horarios: [
        ...parseHorariosString(r.cultos, "culto"),
        ...parseHorariosString(r.rjm, "rjm"),
      ],
    }));

    return { items };
  });

// Autocomplete de cidades (distinct city+uf, prefixo da busca)
const CidadeBuscaInput = z.object({ q: z.string().min(1).max(80) });
export type CidadeOpcao = { cidade: string; uf: string };

export const buscarCidadesUf = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CidadeBuscaInput.parse(data))
  .handler(async ({ data }): Promise<{ items: CidadeOpcao[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("congregacoes_ccb")
      .select("city,uf")
      .ilike("city", `${data.q}%`)
      .not("city", "is", null)
      .not("uf", "is", null)
      .limit(200);
    if (error) {
      console.error("buscarCidadesUf error", error);
      return { items: [] };
    }
    const seen = new Set<string>();
    const items: CidadeOpcao[] = [];
    for (const r of rows ?? []) {
      const key = `${r.city}|${r.uf}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ cidade: r.city as string, uf: (r.uf as string).toUpperCase() });
      if (items.length >= 12) break;
    }
    items.sort((a, b) => a.cidade.localeCompare(b.cidade, "pt-BR"));
    return { items };
  });

// Busca textual de comuns no diretório nacional (nome, cidade, bairro, endereço)
const BuscaTextoInput = z.object({ q: z.string().min(2).max(120) });
export type CongregacaoCcbResult = {
  id: number;
  name: string;
  address: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

export const buscarCongregacoesCcbTexto = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BuscaTextoInput.parse(data))
  .handler(async ({ data }): Promise<{ items: CongregacaoCcbResult[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const like = `%${data.q.trim()}%`;
    const { data: rows, error } = await supabaseAdmin
      .from("congregacoes_ccb")
      .select("id,name,address,neighborhood,city,uf")
      .or(`name.ilike.${like},city.ilike.${like},neighborhood.ilike.${like},address.ilike.${like}`)
      .limit(30);
    if (error) {
      console.error("buscarCongregacoesCcbTexto error", error);
      return { items: [] };
    }
    const items: CongregacaoCcbResult[] = (rows ?? []).map((r) => ({
      id: r.id as number,
      name: (r.name as string) ?? "",
      address: (r.address as string) ?? "",
      bairro: (r.neighborhood as string) ?? undefined,
      cidade: (r.city as string) ?? undefined,
      uf: ((r.uf as string) ?? "").toUpperCase() || undefined,
    }));
    return { items };
  });

