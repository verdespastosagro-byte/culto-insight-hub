import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

// ============ Schema para extração estruturada ============
const ExtracaoSchema = z.object({
  congregacao_mencionada: z.string().nullable().optional(),
  cidade_mencionada: z.string().nullable().optional(),
  pregador: z.object({
    nome: z.string().nullable().optional(),
    cargo: z.string().nullable().optional(),
    congregacao_origem: z.string().nullable().optional(),
  }).optional(),
  hinos_chamados: z.array(z.object({
    numero: z.number().nullable().optional(),
    momento: z.string().nullable().optional(),
  })).default([]),
  atendimentos: z.array(z.object({
    nome: z.string(),
    cargo: z.string().nullable().optional(),
    congregacao_origem: z.string().nullable().optional(),
  })).default([]),
  visitantes_mencionados: z.array(z.object({
    nome: z.string(),
    congregacao_origem: z.string().nullable().optional(),
    cidade_origem: z.string().nullable().optional(),
  })).default([]),
  palavra: z.object({
    texto_biblico: z.string().nullable().optional(),
    tema: z.string().nullable().optional(),
    resumo: z.string().nullable().optional(),
    principais_ensinamentos: z.array(z.string()).default([]),
    versiculos_citados: z.array(z.string()).default([]),
  }).optional(),
  palavras_chave: z.array(z.string()).default([]),
  observacoes_ia: z.string().nullable().optional(),
});

export type ExtracaoCulto = z.infer<typeof ExtracaoSchema>;

// ============ Iniciar culto (cria registro) ============
export const iniciarCulto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { latitude?: number | null; longitude?: number | null; cidade?: string | null; congregacao_id?: string | null }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("cultos_inteligentes")
      .insert({
        user_id: userId,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        cidade_detectada: data.cidade ?? null,
        congregacao_id: data.congregacao_id ?? null,
        status: "gravando",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

// ============ Processar áudio (transcrever + extrair) ============
export const processarCulto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; audioPath: string; duracaoSegundos: number; audioSizeBytes: number; audioMime: string }) =>
    z.object({
      id: z.string().uuid(),
      audioPath: z.string().min(1),
      duracaoSegundos: z.number().int().min(1).max(60 * 60 * 8),
      audioSizeBytes: z.number().int().min(1),
      audioMime: z.string().min(1),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verifica posse
    const { data: existing, error: getErr } = await supabase
      .from("cultos_inteligentes")
      .select("id, user_id")
      .eq("id", data.id)
      .single();
    if (getErr || !existing) throw new Error("Registro não encontrado");
    if (existing.user_id !== userId) throw new Error("Sem permissão");

    await supabase
      .from("cultos_inteligentes")
      .update({
        status: "processando",
        audio_path: data.audioPath,
        audio_size_bytes: data.audioSizeBytes,
        audio_mime: data.audioMime,
        duracao_segundos: data.duracaoSegundos,
        encerrado_em: new Date().toISOString(),
      })
      .eq("id", data.id);

    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!elevenKey) {
      await supabase.from("cultos_inteligentes")
        .update({ status: "erro", erro_mensagem: "ELEVENLABS_API_KEY ausente" })
        .eq("id", data.id);
      throw new Error("ElevenLabs não conectado");
    }
    if (!lovableKey) {
      await supabase.from("cultos_inteligentes")
        .update({ status: "erro", erro_mensagem: "LOVABLE_API_KEY ausente" })
        .eq("id", data.id);
      throw new Error("LOVABLE_API_KEY ausente");
    }

    // Baixa áudio do Storage usando service role para evitar problemas de header
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("cultos-audio")
      .download(data.audioPath);
    if (dlErr || !file) {
      await supabase.from("cultos_inteligentes")
        .update({ status: "erro", erro_mensagem: `Falha ao ler áudio: ${dlErr?.message ?? "arquivo vazio"}` })
        .eq("id", data.id);
      throw new Error("Falha ao baixar áudio");
    }

    // ===== Transcrição ElevenLabs Scribe v2 =====
    let transcricaoTexto = "";
    let transcricaoJson: unknown = null;
    try {
      const fd = new FormData();
      fd.append("file", file, "culto.webm");
      fd.append("model_id", "scribe_v2");
      fd.append("language_code", "por");
      fd.append("diarize", "true");
      fd.append("tag_audio_events", "true");

      const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": elevenKey },
        body: fd,
      });
      if (!resp.ok) {
        const errTxt = await resp.text();
        throw new Error(`Transcrição falhou (${resp.status}): ${errTxt.slice(0, 300)}`);
      }
      const j = await resp.json();
      transcricaoJson = j;
      transcricaoTexto = String(j?.text ?? "");
    } catch (e: any) {
      await supabase.from("cultos_inteligentes")
        .update({ status: "erro", erro_mensagem: e?.message ?? "Erro transcrição" })
        .eq("id", data.id);
      throw e;
    }

    // ===== Extração estruturada via Gemini =====
    let extracao: ExtracaoCulto;
    try {
      const provider = createLovableAiGatewayProvider(lovableKey);
      const prompt = `Você é um assistente que analisa transcrições de cultos da Congregação Cristã no Brasil (CCB).
Extraia da transcrição abaixo, em PT-BR, somente o que está claramente presente — NUNCA invente nomes, números de hino, versículos ou cargos.

Regras:
- Hinos: identifique citações como "hino número 123", "hino 45", "vamos cantar o 200". Liste apenas os que foram chamados.
- Pregador: o irmão que trouxe a palavra/mensagem principal. Use o nome próprio se mencionado.
- Atendimentos: irmãos que oraram pelos enfermos / fizeram atendimento.
- Visitantes: pessoas mencionadas como visitantes, de outra congregação ou cidade.
- Versículos: somente referências bíblicas explícitas (ex.: "João 3:16", "Salmos 23").
- Se algo não estiver claro, deixe nulo ou lista vazia.
- "momento" do hino: abertura, oração, ofertório, encerramento, palavra ou desconhecido.

Transcrição:
"""
${transcricaoTexto.slice(0, 25000)}
"""`;

      const { experimental_output } = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        prompt,
        experimental_output: Output.object({ schema: ExtracaoSchema }),
      });
      extracao = experimental_output as ExtracaoCulto;
    } catch (e: any) {
      // Não falha tudo se a extração quebrar — guarda transcrição e marca aviso
      await supabase.from("cultos_inteligentes")
        .update({
          status: "aguardando_revisao",
          transcricao_texto: transcricaoTexto,
          transcricao_json: transcricaoJson as never,
          erro_mensagem: `Extração IA falhou: ${e?.message ?? "erro"}`,
        })
        .eq("id", data.id);
      return { transcricao: transcricaoTexto, extracao: emptyExtracao(), aviso: e?.message ?? "Extração falhou" };
    }

    await supabase.from("cultos_inteligentes")
      .update({
        status: "aguardando_revisao",
        transcricao_texto: transcricaoTexto,
        transcricao_json: transcricaoJson as never,
        extracao_json: extracao as never,
        erro_mensagem: null,
      })
      .eq("id", data.id);

    return { transcricao: transcricaoTexto, extracao };
  });

function emptyExtracao(): ExtracaoCulto {
  return {
    hinos_chamados: [],
    atendimentos: [],
    visitantes_mencionados: [],
    palavras_chave: [],
  };
}

// ============ Salvar culto confirmado (cria registros nas tabelas) ============
const SalvarSchema = z.object({
  id: z.string().uuid(),
  culto: z.object({
    data: z.string().min(1),
    horario: z.string().nullable().optional(),
    tipo: z.string().min(1),
    congregacao_id: z.string().uuid().nullable().optional(),
    cidade: z.string().nullable().optional(),
    participantes: z.number().int().nullable().optional(),
    observacoes: z.string().nullable().optional(),
  }),
  hinos: z.array(z.object({
    numero: z.number().int().min(1).max(1000),
    momento: z.string().nullable().optional(),
  })).default([]),
  palavra: z.object({
    nome_irmao: z.string().min(1),
    cargo: z.string().nullable().optional(),
    congregacao_origem: z.string().nullable().optional(),
    cidade_origem: z.string().nullable().optional(),
    texto_biblico: z.string().nullable().optional(),
    tema: z.string().nullable().optional(),
    resumo: z.string().nullable().optional(),
  }).nullable().optional(),
  atendimentos: z.array(z.object({
    nome: z.string().min(1),
    cargo: z.string().nullable().optional(),
    congregacao_origem: z.string().nullable().optional(),
    cidade_origem: z.string().nullable().optional(),
    observacoes: z.string().nullable().optional(),
  })).default([]),
  visitantes: z.array(z.object({
    nome: z.string().min(1),
    congregacao_origem: z.string().nullable().optional(),
    cidade_origem: z.string().nullable().optional(),
    observacoes: z.string().nullable().optional(),
  })).default([]),
});

export const salvarCultoConfirmado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SalvarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ci, error: ciErr } = await supabase
      .from("cultos_inteligentes")
      .select("id, user_id")
      .eq("id", data.id)
      .single();
    if (ciErr || !ci) throw new Error("Registro não encontrado");
    if (ci.user_id !== userId) throw new Error("Sem permissão");

    const { data: novoCulto, error: cErr } = await supabase
      .from("cultos")
      .insert({
        data: data.culto.data,
        horario: data.culto.horario ?? null,
        tipo: data.culto.tipo as never,
        congregacao_id: data.culto.congregacao_id ?? null,
        cidade: data.culto.cidade ?? null,
        participantes: data.culto.participantes ?? null,
        observacoes: data.culto.observacoes ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (cErr || !novoCulto) throw new Error(cErr?.message ?? "Falha ao criar culto");

    const cultoId = novoCulto.id as string;

    if (data.hinos.length) {
      const rows = data.hinos.map((h) => ({
        culto_id: cultoId,
        numero: h.numero,
        momento: (h.momento ?? "desconhecido") as never,
      }));
      const r = await supabase.from("hinos").insert(rows);
      if (r.error) throw new Error(r.error.message);
    }

    if (data.palavra && data.palavra.nome_irmao) {
      const r = await supabase.from("palavras").insert({
        culto_id: cultoId,
        nome_irmao: data.palavra.nome_irmao,
        cargo: data.palavra.cargo ?? null,
        congregacao_origem: data.palavra.congregacao_origem ?? null,
        cidade_origem: data.palavra.cidade_origem ?? null,
        texto_biblico: data.palavra.texto_biblico ?? null,
        tema: data.palavra.tema ?? null,
        resumo: data.palavra.resumo ?? null,
      });
      if (r.error) throw new Error(r.error.message);
    }

    if (data.atendimentos.length) {
      const rows = data.atendimentos.map((a) => ({
        culto_id: cultoId,
        nome: a.nome,
        cargo: a.cargo ?? null,
        congregacao_origem: a.congregacao_origem ?? null,
        cidade: a.cidade_origem ?? null,
        observacoes: a.observacoes ?? null,
      }));
      const r = await supabase.from("atendimentos").insert(rows);
      if (r.error) throw new Error(r.error.message);
    }

    if (data.visitantes.length) {
      const rows = data.visitantes.map((v) => ({
        culto_id: cultoId,
        nome: v.nome,
        congregacao_origem: v.congregacao_origem ?? null,
        cidade: v.cidade_origem ?? null,
      }));
      const r = await supabase.from("visitantes").insert(rows);
      if (r.error) throw new Error(r.error.message);
    }

    await supabase.from("cultos_inteligentes")
      .update({ status: "salvo", culto_id: cultoId })
      .eq("id", data.id);

    return { cultoId };
  });

// ============ URL assinada para player/download ============
export const urlAudioAssinada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("cultos_inteligentes")
      .select("user_id, audio_path")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Não encontrado");
    if (row.user_id !== userId) throw new Error("Sem permissão");
    if (!row.audio_path) throw new Error("Sem áudio");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("cultos-audio")
      .createSignedUrl(row.audio_path, 60 * 60);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Falha ao assinar URL");
    return { url: signed.signedUrl };
  });

// ============ Excluir gravação ============
export const excluirCultoInteligente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("cultos_inteligentes")
      .select("user_id, audio_path")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Não encontrado");
    if (row.user_id !== userId) throw new Error("Sem permissão");

    if (row.audio_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("cultos-audio").remove([row.audio_path]);
    }
    const { error: dErr } = await supabase.from("cultos_inteligentes").delete().eq("id", data.id);
    if (dErr) throw new Error(dErr.message);
    return { ok: true };
  });
