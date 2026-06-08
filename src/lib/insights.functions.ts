import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");

    const { supabase } = context;

    const [cultosR, hinosR, palavrasR, atendR, congR] = await Promise.all([
      supabase.from("cultos").select("data, tipo, cidade, congregacao_id, participantes"),
      supabase.from("hinos").select("numero, momento, culto_id"),
      supabase.from("palavras").select("nome_irmao, cargo, tema, congregacao_origem"),
      supabase.from("atendimentos").select("nome, cargo, congregacao_origem"),
      supabase.from("congregacoes").select("id, nome, cidade"),
    ]);

    const cultos = cultosR.data ?? [];
    const hinos = hinosR.data ?? [];
    const palavras = palavrasR.data ?? [];
    const atendimentos = atendR.data ?? [];
    const congs = congR.data ?? [];

    const hinoMap: Record<number, number> = {};
    hinos.forEach((h: any) => { hinoMap[h.numero] = (hinoMap[h.numero] ?? 0) + 1; });
    const topHinos = Object.entries(hinoMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([n, c]) => ({ numero: Number(n), vezes: c }));

    const pregMap: Record<string, number> = {};
    palavras.forEach((p: any) => { pregMap[p.nome_irmao] = (pregMap[p.nome_irmao] ?? 0) + 1; });
    const topPregadores = Object.entries(pregMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([nome, vezes]) => ({ nome, vezes }));

    const congMap: Record<string, number> = {};
    cultos.forEach((c: any) => {
      const name = congs.find((x: any) => x.id === c.congregacao_id)?.nome ?? c.cidade ?? "Desconhecida";
      congMap[name] = (congMap[name] ?? 0) + 1;
    });
    const topCongregacoes = Object.entries(congMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([nome, vezes]) => ({ nome, vezes }));

    const stats = {
      total_cultos: cultos.length,
      total_hinos: hinos.length,
      total_palavras: palavras.length,
      total_atendimentos: atendimentos.length,
      total_congregacoes: congs.length,
      hinos_mais_chamados: topHinos,
      pregadores_mais_frequentes: topPregadores,
      congregacoes_mais_visitadas: topCongregacoes,
    };

    if (cultos.length === 0) {
      return { stats, resumo: "Ainda não há registros suficientes para gerar insights. Registre cultos, hinos e palavras para receber análises automáticas." };
    }

    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const prompt = `Você é um assistente analítico para um sistema interno da Congregação Cristã no Brasil (CCB).
Com base nos dados agregados abaixo (JSON), produza um RESUMO conciso em português brasileiro com:

1. **Visão geral** — totais e tendências principais (2-3 linhas).
2. **Hinos** — quais hinos se destacam e padrões interessantes.
3. **Pregadores** — quem mais traz a Palavra.
4. **Congregações** — onde há mais atividade.
5. **Recomendações** — 2 sugestões práticas baseadas nos dados.

Use linguagem respeitosa e formal, com tom pastoral. Formate em markdown com títulos curtos (###) e listas curtas. Não invente dados que não estejam no JSON.

Dados:
\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\``;

    try {
      const { text } = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        prompt,
      });
      return { stats, resumo: text };
    } catch (e: any) {
      return { stats, resumo: `Não foi possível gerar o resumo automático no momento (${e?.message ?? "erro"}). Os números acima foram calculados a partir dos seus dados.` };
    }
  });
