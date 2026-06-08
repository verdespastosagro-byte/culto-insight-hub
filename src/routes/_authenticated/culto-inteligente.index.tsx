import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Square, Loader2, Sparkles, Plus, Trash2, History, MapPin } from "lucide-react";
import { TIPOS_REUNIAO } from "@/lib/constants";
import { iniciarCulto, processarCulto, salvarCultoConfirmado, type ExtracaoCulto } from "@/lib/culto-inteligente.functions";

export const Route = createFileRoute("/_authenticated/culto-inteligente/")({
  component: CultoInteligentePage,
});

type Fase = "idle" | "gravando" | "processando" | "revisao" | "salvando";

function CultoInteligentePage() {
  const { user } = useAuth();
  const iniciar = useServerFn(iniciarCulto);
  const processar = useServerFn(processarCulto);
  const salvar = useServerFn(salvarCultoConfirmado);

  const [fase, setFase] = useState<Fase>("idle");
  const [registroId, setRegistroId] = useState<string | null>(null);
  const [duracao, setDuracao] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number; cidade?: string } | null>(null);
  const [transcricao, setTranscricao] = useState("");
  const [extracao, setExtracao] = useState<ExtracaoCulto | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form revisão
  const [fData, setFData] = useState("");
  const [fHorario, setFHorario] = useState("");
  const [fTipo, setFTipo] = useState("culto_oficial");
  const [fCongregacaoId, setFCongregacaoId] = useState<string>("");
  const [fCidade, setFCidade] = useState("");
  const [fParticipantes, setFParticipantes] = useState<string>("");
  const [fObservacoes, setFObservacoes] = useState("");
  const [fHinos, setFHinos] = useState<{ numero: string; momento: string }[]>([]);
  const [fPalavra, setFPalavra] = useState({ nome_irmao: "", cargo: "", congregacao_origem: "", cidade_origem: "", texto_biblico: "", tema: "", resumo: "" });
  const [fAtend, setFAtend] = useState<{ nome: string; cargo: string; congregacao_origem: string; cidade_origem: string }[]>([]);
  const [fVisit, setFVisit] = useState<{ nome: string; congregacao_origem: string; cidade_origem: string }[]>([]);

  const { data: congs } = useQuery({
    queryKey: ["congs-min"],
    queryFn: async () => {
      const { data } = await supabase.from("congregacoes").select("id, nome, cidade").order("nome");
      return data ?? [];
    },
  });

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function obterLocalizacao(): Promise<{ lat: number; lng: number; cidade?: string } | null> {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          let cidade: string | undefined;
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=pt-BR`);
            const j = await r.json();
            cidade = j?.address?.city || j?.address?.town || j?.address?.municipality || j?.address?.village;
          } catch { /* ignore */ }
          resolve({ lat, lng, cidade });
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 6000 }
      );
    });
  }

  async function handleIniciar() {
    try {
      const loc = await obterLocalizacao();
      setCoords(loc);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current = rec;

      const { id } = await iniciar({ data: {
        latitude: loc?.lat ?? null,
        longitude: loc?.lng ?? null,
        cidade: loc?.cidade ?? null,
      }});
      setRegistroId(id);

      rec.start(1000);
      startTimeRef.current = Date.now();
      setDuracao(0);
      timerRef.current = setInterval(() => {
        setDuracao(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      setFase("gravando");
      toast.success("Gravação iniciada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar gravação");
      setFase("idle");
    }
  }

  async function handleEncerrar() {
    const rec = mediaRecorderRef.current;
    if (!rec || !registroId) return;

    setFase("processando");
    if (timerRef.current) clearInterval(timerRef.current);
    const dur = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));

    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      rec.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());

    try {
      if (!user) throw new Error("Não autenticado");
      const path = `${user.id}/${registroId}.webm`;
      const up = await supabase.storage.from("cultos-audio").upload(path, blob, {
        contentType: blob.type || "audio/webm",
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);

      toast.info("Transcrevendo e analisando...");
      const res = await processar({ data: {
        id: registroId,
        audioPath: path,
        duracaoSegundos: dur,
        audioSizeBytes: blob.size,
        audioMime: blob.type || "audio/webm",
      }});

      setTranscricao(res.transcricao ?? "");
      const ex = res.extracao ?? null;
      setExtracao(ex);
      preencherFormulario(ex);
      setFase("revisao");
      toast.success("Relatório pronto para revisão");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao processar");
      setFase("idle");
    }
  }

  function preencherFormulario(ex: ExtracaoCulto | null) {
    const hoje = new Date();
    setFData(hoje.toISOString().slice(0, 10));
    setFHorario(`${String(hoje.getHours()).padStart(2, "0")}:${String(hoje.getMinutes()).padStart(2, "0")}`);
    setFTipo("culto_oficial");
    const congMatch = congs?.find((c) => c.nome.toLowerCase() === (ex?.congregacao_mencionada ?? "").toLowerCase());
    setFCongregacaoId(congMatch?.id ?? "");
    setFCidade(ex?.cidade_mencionada ?? coords?.cidade ?? congMatch?.cidade ?? "");
    setFParticipantes("");
    setFObservacoes(ex?.observacoes_ia ?? "");
    setFHinos((ex?.hinos_chamados ?? []).filter((h) => h.numero != null).map((h) => ({ numero: String(h.numero ?? ""), momento: h.momento ?? "outro" })));
    setFPalavra({
      nome_irmao: ex?.pregador?.nome ?? "",
      cargo: ex?.pregador?.cargo ?? "",
      congregacao_origem: ex?.pregador?.congregacao_origem ?? "",
      cidade_origem: "",
      texto_biblico: ex?.palavra?.texto_biblico ?? "",
      tema: ex?.palavra?.tema ?? "",
      resumo: ex?.palavra?.resumo ?? "",
    });
    setFAtend((ex?.atendimentos ?? []).map((a) => ({ nome: a.nome, cargo: a.cargo ?? "", congregacao_origem: a.congregacao_origem ?? "", cidade_origem: "" })));
    setFVisit((ex?.visitantes_mencionados ?? []).map((v) => ({ nome: v.nome, congregacao_origem: v.congregacao_origem ?? "", cidade_origem: v.cidade_origem ?? "" })));
  }

  async function handleSalvar() {
    if (!registroId) return;
    if (!fData || !fTipo) { toast.error("Data e tipo obrigatórios"); return; }
    setFase("salvando");
    try {
      const hinosValidos = fHinos
        .map((h) => ({ numero: parseInt(h.numero, 10), momento: h.momento }))
        .filter((h) => Number.isFinite(h.numero) && h.numero > 0);
      const palavraValida = fPalavra.nome_irmao.trim()
        ? { ...fPalavra, nome_irmao: fPalavra.nome_irmao.trim() }
        : null;
      const atendValidos = fAtend.filter((a) => a.nome.trim()).map((a) => ({ ...a, nome: a.nome.trim() }));
      const visitValidos = fVisit.filter((v) => v.nome.trim()).map((v) => ({ ...v, nome: v.nome.trim() }));

      await salvar({ data: {
        id: registroId,
        culto: {
          data: fData,
          horario: fHorario || null,
          tipo: fTipo,
          congregacao_id: fCongregacaoId || null,
          cidade: fCidade || null,
          participantes: fParticipantes ? parseInt(fParticipantes, 10) : null,
          observacoes: fObservacoes || null,
        },
        hinos: hinosValidos,
        palavra: palavraValida as never,
        atendimentos: atendValidos,
        visitantes: visitValidos,
      }});
      toast.success("Culto salvo com sucesso!");
      // reset
      setRegistroId(null);
      setExtracao(null);
      setTranscricao("");
      setFase("idle");
      setDuracao(0);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
      setFase("revisao");
    }
  }

  const minutos = Math.floor(duracao / 60);
  const segundos = duracao % 60;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Culto Inteligente</h2>
          <p className="text-sm text-muted-foreground">
            Grave o culto e a IA gera o relatório completo automaticamente.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/culto-inteligente/historico"><History className="mr-2 h-4 w-4" />Histórico</Link>
        </Button>
      </div>

      {fase === "idle" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-12">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-[var(--gradient-primary)] text-primary-foreground shadow-lg">
              <Mic className="h-14 w-14" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold">Pronto para iniciar</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A gravação começará e o sistema capturará data, horário e localização.
              </p>
            </div>
            <Button size="lg" onClick={handleIniciar} className="px-10">
              <Mic className="mr-2 h-5 w-5" /> Iniciar Culto
            </Button>
          </CardContent>
        </Card>
      )}

      {fase === "gravando" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-12">
            <div className="relative">
              <div className="grid h-32 w-32 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg">
                <Mic className="h-14 w-14 animate-pulse" />
              </div>
              <span className="absolute inset-0 animate-ping rounded-full bg-destructive/30" />
            </div>
            <div className="text-center">
              <p className="font-mono text-4xl tabular-nums">
                {String(minutos).padStart(2, "0")}:{String(segundos).padStart(2, "0")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Gravando...</p>
              {coords?.cidade && (
                <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {coords.cidade}
                </p>
              )}
            </div>
            <Button size="lg" variant="destructive" onClick={handleEncerrar} className="px-10">
              <Square className="mr-2 h-5 w-5" /> Encerrar Culto
            </Button>
          </CardContent>
        </Card>
      )}

      {fase === "processando" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Transcrevendo e analisando o culto...</p>
            <p className="text-sm text-muted-foreground">
              Isso pode levar alguns minutos dependendo da duração.
            </p>
          </CardContent>
        </Card>
      )}

      {(fase === "revisao" || fase === "salvando") && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Relatório gerado pela IA — revise antes de salvar
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Data"><Input type="date" value={fData} onChange={(e) => setFData(e.target.value)} /></Field>
              <Field label="Horário"><Input type="time" value={fHorario} onChange={(e) => setFHorario(e.target.value)} /></Field>
              <Field label="Tipo">
                <Select value={fTipo} onValueChange={setFTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPOS_REUNIAO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Congregação">
                <Select value={fCongregacaoId || "__none"} onValueChange={(v) => setFCongregacaoId(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Nenhuma —</SelectItem>
                    {congs?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cidade"><Input value={fCidade} onChange={(e) => setFCidade(e.target.value)} /></Field>
              <Field label="Participantes"><Input type="number" value={fParticipantes} onChange={(e) => setFParticipantes(e.target.value)} /></Field>
              <Field label="Observações" full>
                <Textarea rows={2} value={fObservacoes} onChange={(e) => setFObservacoes(e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Hinos chamados</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {fHinos.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="w-28" type="number" placeholder="Nº" value={h.numero}
                    onChange={(e) => setFHinos((arr) => arr.map((x, j) => j === i ? { ...x, numero: e.target.value } : x))} />
                  <Input placeholder="Momento (entrada/encerramento...)" value={h.momento}
                    onChange={(e) => setFHinos((arr) => arr.map((x, j) => j === i ? { ...x, momento: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" onClick={() => setFHinos((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setFHinos((a) => [...a, { numero: "", momento: "outro" }])}>
                <Plus className="mr-1 h-4 w-4" />Adicionar hino
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Palavra</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Pregador"><Input value={fPalavra.nome_irmao} onChange={(e) => setFPalavra({ ...fPalavra, nome_irmao: e.target.value })} /></Field>
              <Field label="Cargo"><Input value={fPalavra.cargo} onChange={(e) => setFPalavra({ ...fPalavra, cargo: e.target.value })} /></Field>
              <Field label="Congregação origem"><Input value={fPalavra.congregacao_origem} onChange={(e) => setFPalavra({ ...fPalavra, congregacao_origem: e.target.value })} /></Field>
              <Field label="Cidade origem"><Input value={fPalavra.cidade_origem} onChange={(e) => setFPalavra({ ...fPalavra, cidade_origem: e.target.value })} /></Field>
              <Field label="Texto bíblico" full><Input value={fPalavra.texto_biblico} onChange={(e) => setFPalavra({ ...fPalavra, texto_biblico: e.target.value })} /></Field>
              <Field label="Tema" full><Input value={fPalavra.tema} onChange={(e) => setFPalavra({ ...fPalavra, tema: e.target.value })} /></Field>
              <Field label="Resumo" full><Textarea rows={4} value={fPalavra.resumo} onChange={(e) => setFPalavra({ ...fPalavra, resumo: e.target.value })} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Atendimentos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {fAtend.map((a, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <Input placeholder="Nome" value={a.nome} onChange={(e) => setFAtend((arr) => arr.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                  <Input placeholder="Cargo" value={a.cargo} onChange={(e) => setFAtend((arr) => arr.map((x, j) => j === i ? { ...x, cargo: e.target.value } : x))} />
                  <Input placeholder="Congregação" value={a.congregacao_origem} onChange={(e) => setFAtend((arr) => arr.map((x, j) => j === i ? { ...x, congregacao_origem: e.target.value } : x))} />
                  <Input placeholder="Cidade" value={a.cidade_origem} onChange={(e) => setFAtend((arr) => arr.map((x, j) => j === i ? { ...x, cidade_origem: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" onClick={() => setFAtend((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setFAtend((a) => [...a, { nome: "", cargo: "", congregacao_origem: "", cidade_origem: "" }])}>
                <Plus className="mr-1 h-4 w-4" />Adicionar atendimento
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Visitantes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {fVisit.map((v, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <Input placeholder="Nome" value={v.nome} onChange={(e) => setFVisit((arr) => arr.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                  <Input placeholder="Congregação" value={v.congregacao_origem} onChange={(e) => setFVisit((arr) => arr.map((x, j) => j === i ? { ...x, congregacao_origem: e.target.value } : x))} />
                  <Input placeholder="Cidade" value={v.cidade_origem} onChange={(e) => setFVisit((arr) => arr.map((x, j) => j === i ? { ...x, cidade_origem: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" onClick={() => setFVisit((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setFVisit((a) => [...a, { nome: "", congregacao_origem: "", cidade_origem: "" }])}>
                <Plus className="mr-1 h-4 w-4" />Adicionar visitante
              </Button>
            </CardContent>
          </Card>

          {extracao?.palavras_chave?.length || extracao?.palavra?.versiculos_citados?.length ? (
            <Card>
              <CardHeader><CardTitle>Análise da IA</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {extracao?.palavra?.versiculos_citados?.length ? (
                  <p><strong>Versículos citados:</strong> {extracao.palavra.versiculos_citados.join(", ")}</p>
                ) : null}
                {extracao?.palavras_chave?.length ? (
                  <p><strong>Palavras-chave:</strong> {extracao.palavras_chave.join(", ")}</p>
                ) : null}
                {extracao?.palavra?.principais_ensinamentos?.length ? (
                  <div><strong>Principais ensinamentos:</strong>
                    <ul className="ml-4 list-disc">{extracao.palavra.principais_ensinamentos.map((e, i) => <li key={i}>{e}</li>)}</ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {transcricao && (
            <Card>
              <CardHeader><CardTitle>Transcrição completa</CardTitle></CardHeader>
              <CardContent>
                <Textarea readOnly rows={8} value={transcricao} className="font-mono text-xs" />
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setFase("idle"); setRegistroId(null); }}>Descartar</Button>
            <Button onClick={handleSalvar} disabled={fase === "salvando"}>
              {fase === "salvando" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar e salvar culto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
