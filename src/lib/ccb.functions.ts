import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.5).max(50),
});

export type CCBChurch = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export const buscarCongregacoes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<{ items: CCBChurch[]; error?: string }> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return { items: [], error: "Credenciais do Google Maps não configuradas." };
    }

    const radiusMeters = Math.min(50000, Math.round(data.radiusKm * 1000));

    try {
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

      // Normaliza para filtrar apenas Congregação Cristã no Brasil (CCB)
      const norm = (s: string) =>
        s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

      const isCCB = (name: string) => {
        const n = norm(name);
        return (
          n.includes("congregacao crista no brasil") ||
          n.includes("congregacao crista") ||
          /\bccb\b/.test(n)
        );
      };

      const items: CCBChurch[] = (json.places ?? [])
        .filter((p) => p.location && isCCB(p.displayName?.text ?? ""))
        .map((p) => ({
          id: p.id,
          name: p.displayName?.text ?? "Congregação Cristã no Brasil",
          address: p.formattedAddress ?? "",
          lat: p.location!.latitude,
          lng: p.location!.longitude,
        }));

      return { items };
    } catch (err) {
      console.error("buscarCongregacoes error", err);
      return { items: [], error: "Erro ao consultar o serviço de busca." };
    }
  });
