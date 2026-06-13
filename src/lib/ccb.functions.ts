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

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const DIAS_MAP: Record<string, { idx: number; label: string }> = {
  domingo: { idx: 0, label: "Domingo" },
  "segunda-feira": { idx: 1, label: "Segunda" },
  segunda: { idx: 1, label: "Segunda" },
  "terca-feira": { idx: 2, label: "Terça" },
  terca: { idx: 2, label: "Terça" },
  "quarta-feira": { idx: 3, label: "Quarta" },
  quarta: { idx: 3, label: "Quarta" },
  "quinta-feira": { idx: 4, label: "Quinta" },
  quinta: { idx: 4, label: "Quinta" },
  "sexta-feira": { idx: 5, label: "Sexta" },
  sexta: { idx: 5, label: "Sexta" },
  sabado: { idx: 6, label: "Sábado" },
};

function isCCB(name: string) {
  const n = norm(name);
  return (
    n.includes("congregacao crista no brasil") ||
    n.includes("congregacao crista") ||
    /\bccb\b/.test(n)
  );
}

async function reverseGeocode(
  lat: number,
  lng: number,
  lovableKey: string,
  mapsKey: string,
): Promise<{ cidade?: string; uf?: string }> {
  try {
    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?latlng=${lat},${lng}&language=pt-BR`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
      },
    });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      results?: Array<{
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
      }>;
    };
    let cidade: string | undefined;
    let uf: string | undefined;
    for (const r of json.results ?? []) {
      for (const c of r.address_components ?? []) {
        if (!cidade && (c.types.includes("administrative_area_level_2") || c.types.includes("locality"))) {
          cidade = c.long_name;
        }
        if (!uf && c.types.includes("administrative_area_level_1")) {
          uf = c.short_name.toLowerCase();
        }
      }
      if (cidade && uf) break;
    }
    return { cidade, uf };
  } catch (e) {
    console.error("reverseGeocode error", e);
    return {};
  }
}

type CongregacaoSite = {
  endereco: string;
  bairro?: string;
  horarios: CCBHorario[];
};

function parseCongregacoesSite(html: string): CongregacaoSite[] {
  // Tenta extrair blocos por endereço. O site tipicamente lista:
  // <h3>Rua X, 123 - Bairro</h3> seguido de dias/horários.
  // Estratégia: capturar texto bruto e parsear por linhas.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ");

  const linhas = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const itens: CongregacaoSite[] = [];
  let atual: CongregacaoSite | null = null;

  const reEndereco = /(rua|av\.?|avenida|travessa|praça|praca|estrada|rod\.?|rodovia|alameda|servidão|servidao|beco|largo|via)\b[^,]{2,120},?\s*(s\/n|sn|\d{1,6}[a-zA-Z]?)/i;
  const reHorario = /\b(\d{1,2})(?::|h)(\d{2})?\b/g;
  const reDia = /\b(domingo|segunda(?:-feira)?|terca(?:-feira)?|terça(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|sábado)\b/gi;

  for (const linha of linhas) {
    const matchEnd = linha.match(reEndereco);
    if (matchEnd) {
      if (atual) itens.push(atual);
      const partes = linha.split(" - ");
      const endereco = partes[0]?.trim() ?? linha;
      const bairro = partes[1]?.trim();
      atual = { endereco, bairro, horarios: [] };
      continue;
    }
    if (!atual) continue;

    // procura dia + hora na mesma linha
    const linhaNorm = norm(linha);
    const dias: { idx: number; label: string }[] = [];
    let m: RegExpExecArray | null;
    reDia.lastIndex = 0;
    while ((m = reDia.exec(linhaNorm)) !== null) {
      const key = m[1].replace("ç", "c").replace("á", "a");
      const d = DIAS_MAP[key] ?? DIAS_MAP[key.replace("-feira", "")];
      if (d) dias.push(d);
    }
    const horas: string[] = [];
    reHorario.lastIndex = 0;
    while ((m = reHorario.exec(linha)) !== null) {
      const h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      if (h >= 5 && h <= 23) horas.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
    if (dias.length && horas.length) {
      for (const d of dias) {
        for (const h of horas) {
          atual.horarios.push({ diaSemana: d.idx, diaLabel: d.label, hora: h });
        }
      }
    }
  }
  if (atual) itens.push(atual);

  // dedup horários por item
  return itens.map((i) => {
    const seen = new Set<string>();
    const horarios = i.horarios.filter((h) => {
      const k = `${h.diaSemana}-${h.hora}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { ...i, horarios };
  });
}

async function buscarHorariosCidade(
  cidade: string,
  uf: string,
): Promise<CongregacaoSite[]> {
  try {
    const url = `https://congregacoes.com.br/ccb/br/${uf}/${slug(cidade)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CCBPertoBot/1.0; +https://lovable.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      console.warn("congregacoes.com.br status", res.status, url);
      return [];
    }
    const html = await res.text();
    return parseCongregacoesSite(html);
  } catch (e) {
    console.error("buscarHorariosCidade error", e);
    return [];
  }
}

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
    try {
      const itens = await buscarHorariosCidade(data.cidade, data.uf.toLowerCase());
      return { items: itens };
    } catch (e) {
      console.error("listarCongregacoesPorCidade error", e);
      return { items: [], error: "Erro ao buscar congregações da cidade." };
    }
  });

function similaridadeEndereco(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  const tokensA = new Set(na.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(nb.split(" ").filter((t) => t.length > 2));
  if (!tokensA.size || !tokensB.size) return 0;
  let comuns = 0;
  for (const t of tokensA) if (tokensB.has(t)) comuns++;
  return comuns / Math.max(tokensA.size, tokensB.size);
}

export const buscarCongregacoes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<{ items: CCBChurch[]; error?: string; cidade?: string; uf?: string }> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return { items: [], error: "Credenciais do Google Maps não configuradas." };
    }

    const radiusMeters = Math.min(50000, Math.round(data.radiusKm * 1000));

    try {
      // 1) Places API
      const res = await fetch(
        "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
            "Content-Type": "application/json",
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.location",
          },
          body: JSON.stringify({
            textQuery: "Congregação Cristã no Brasil",
            maxResultCount: 20,
            locationBias: {
              circle: {
                center: { latitude: data.lat, longitude: data.lng },
                radius: radiusMeters,
              },
            },
          }),
        },
      );

      if (!res.ok) {
        const txt = await res.text();
        console.error("Places API error", res.status, txt);
        return { items: [], error: `Falha na busca (${res.status})` };
      }

      const json = (await res.json()) as {
        places?: Array<{
          id: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          location?: { latitude: number; longitude: number };
        }>;
      };

      const placesItems: CCBChurch[] = (json.places ?? [])
        .filter((p) => p.location && isCCB(p.displayName?.text ?? ""))
        .map((p) => ({
          id: p.id,
          name: p.displayName?.text ?? "Congregação Cristã no Brasil",
          address: p.formattedAddress ?? "",
          lat: p.location!.latitude,
          lng: p.location!.longitude,
        }));

      // 2) Reverse geocode + horários do site
      const { cidade, uf } = await reverseGeocode(
        data.lat,
        data.lng,
        LOVABLE_API_KEY,
        GOOGLE_MAPS_API_KEY,
      );

      let horariosSite: CongregacaoSite[] = [];
      if (cidade && uf) {
        horariosSite = await buscarHorariosCidade(cidade, uf);
      }

      // 3) Cruza por similaridade de endereço
      const items = placesItems.map((p) => {
        if (!horariosSite.length) return { ...p, cidade, uf };
        let melhor: CongregacaoSite | null = null;
        let melhorScore = 0;
        for (const s of horariosSite) {
          const score = similaridadeEndereco(p.address, s.endereco);
          if (score > melhorScore) {
            melhorScore = score;
            melhor = s;
          }
        }
        if (melhor && melhorScore >= 0.35) {
          return {
            ...p,
            cidade,
            uf,
            bairro: melhor.bairro,
            horarios: melhor.horarios,
          };
        }
        return { ...p, cidade, uf };
      });

      return { items, cidade, uf };
    } catch (err) {
      console.error("buscarCongregacoes error", err);
      return { items: [], error: "Erro ao consultar o serviço de busca." };
    }
  });
