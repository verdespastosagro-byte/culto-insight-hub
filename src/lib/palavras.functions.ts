import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  tema: z.string().max(500).optional().default(""),
  texto_biblico: z.string().max(500).optional().default(""),
  nome_irmao: z.string().max(200).optional().default(""),
});

export const gerarResumoPalavra = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    if (!data.tema && !data.texto_biblico) {
      throw new Error("Informe ao menos o tema ou o texto bíblico");
    }
    const gateway = createLovableAiGatewayProvider(key);
    const prompt = `Você é um auxiliar que redige resumos breves de mensagens pregadas em cultos da Congregação Cristã no Brasil (CCB).
Escreva um resumo edificante, reverente e fiel à Bíblia em português do Brasil, de 2 a 4 frases (máx. 80 palavras).
Não invente fatos sobre o pregador nem cite o nome do irmão. Não use emojis. Não inicie com "Resumo:".

Tema: ${data.tema || "(não informado)"}
Texto bíblico: ${data.texto_biblico || "(não informado)"}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });
    return { resumo: text.trim() };
  });
