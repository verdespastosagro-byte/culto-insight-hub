import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Download, Trash2, Search } from "lucide-react";
import { formatDateTime } from "@/lib/constants";
import { urlAudioAssinada, excluirCultoInteligente } from "@/lib/culto-inteligente.functions";

export const Route = createFileRoute("/_authenticated/culto-inteligente/historico")({
  component: Historico,
});

function Historico() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const getUrl = useServerFn(urlAudioAssinada);
  const excluir = useServerFn(excluirCultoInteligente);

  const { data: lista } = useQuery({
    queryKey: ["cultos-inteligentes", busca],
    queryFn: async () => {
      let q = supabase
        .from("cultos_inteligentes")
        .select("id, iniciado_em, encerrado_em, duracao_segundos, cidade_detectada, status, transcricao_texto, audio_path, culto_id, erro_mensagem")
        .order("iniciado_em", { ascending: false });
      if (busca.trim()) q = q.ilike("transcricao_texto", `%${busca.trim()}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  async function tocar(id: string) {
    try {
      const { url } = await getUrl({ data: { id } });
      setPlayingUrl(url);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function baixar(id: string) {
    try {
      const { url } = await getUrl({ data: { id } });
      window.open(url, "_blank");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function remover(id: string) {
    if (!confirm("Excluir esta gravação permanentemente?")) return;
    try {
      await excluir({ data: { id } });
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["cultos-inteligentes"] });
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link to="/culto-inteligente"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link></Button>
        <h2 className="text-xl font-semibold">Histórico de Cultos Inteligentes</h2>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar dentro da transcrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {playingUrl && (
        <Card><CardContent className="p-4"><audio src={playingUrl} controls autoPlay className="w-full" /></CardContent></Card>
      )}

      <div className="space-y-3">
        {lista?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma gravação encontrada.</p>}
        {lista?.map((c) => {
          const dur = c.duracao_segundos ? `${Math.floor(c.duracao_segundos / 60)}min` : "—";
          const snippet = busca && c.transcricao_texto
            ? extractSnippet(c.transcricao_texto, busca)
            : (c.transcricao_texto?.slice(0, 200) ?? "");
          return (
            <Card key={c.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{formatDateTime(c.iniciado_em)}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.cidade_detectada ?? "Local desconhecido"} • {dur}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    {c.culto_id && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/cultos/$id" params={{ id: c.culto_id }}>Ver culto</Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => tocar(c.id)} disabled={!c.audio_path} title="Reproduzir"><Play className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => baixar(c.id)} disabled={!c.audio_path} title="Baixar"><Download className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remover(c.id)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {snippet && <p className="rounded bg-muted/40 p-2 text-xs text-muted-foreground">{snippet}</p>}
                {c.erro_mensagem && <p className="text-xs text-destructive">⚠ {c.erro_mensagem}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    gravando: { label: "Gravando", variant: "destructive" },
    processando: { label: "Processando", variant: "secondary" },
    aguardando_revisao: { label: "Aguardando revisão", variant: "outline" },
    salvo: { label: "Salvo", variant: "default" },
    erro: { label: "Erro", variant: "destructive" },
  };
  const v = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

function extractSnippet(text: string, term: string) {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return text.slice(0, 200);
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + term.length + 100);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}
