import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useRef, useState } from "react";
import { formatDate, FUNCOES_VISITANTE } from "@/lib/constants";
import { Plus, Search, Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { gerarResumoPalavra } from "@/lib/palavras.functions";

export const Route = createFileRoute("/_authenticated/palavras")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { canEdit } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [congId, setCongId] = useState<string>("");
  const [cultoId, setCultoId] = useState<string>("");
  const [resumo, setResumo] = useState("");
  const [gerando, setGerando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const gerarResumo = useServerFn(gerarResumoPalavra);

  async function handleGerarResumo() {
    const fd = new FormData(formRef.current ?? undefined);
    const tema = String(fd.get("tema") || "").trim();
    const texto_biblico = String(fd.get("texto_biblico") || "").trim();
    const nome_irmao = String(fd.get("nome_irmao") || "").trim();
    if (!tema && !texto_biblico) {
      toast.error("Informe o tema ou o texto bíblico antes de gerar o resumo");
      return;
    }
    setGerando(true);
    try {
      const r = await gerarResumo({ data: { tema, texto_biblico, nome_irmao } });
      setResumo(r.resumo);
      toast.success("Resumo gerado");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar resumo");
    } finally {
      setGerando(false);
    }
  }

  const { data } = useQuery({
    queryKey: ["palavras-all"],
    queryFn: async () => (await supabase.from("palavras")
      .select("*, culto:cultos(id, data, congregacao:congregacoes(nome))")
      .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: congs } = useQuery({
    queryKey: ["congs-list"],
    queryFn: async () => (await supabase.from("congregacoes").select("id, nome, cidade").order("nome")).data ?? [],
  });

  const { data: cultos } = useQuery({
    queryKey: ["cultos-by-cong", congId],
    enabled: !!congId,
    queryFn: async () => (await supabase.from("cultos")
      .select("id, data, horario, tipo")
      .eq("congregacao_id", congId)
      .order("data", { ascending: false })
      .limit(100)).data ?? [],
  });

  const selectedCong = useMemo(() => (congs ?? []).find((c: any) => c.id === congId), [congs, congId]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cultoId) { toast.error("Selecione o culto"); return; }
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      culto_id: cultoId,
      nome_irmao: String(fd.get("nome_irmao") || "").trim(),
      cargo: String(fd.get("cargo") || "") || null,
      congregacao_origem: String(fd.get("congregacao_origem") || "") || (selectedCong?.nome ?? null),
      cidade_origem: String(fd.get("cidade_origem") || "") || (selectedCong?.cidade ?? null),
      texto_biblico: String(fd.get("texto_biblico") || "") || null,
      tema: String(fd.get("tema") || "") || null,
      resumo: String(fd.get("resumo") || "") || null,
    };
    if (!payload.nome_irmao) { toast.error("Informe o nome do irmão"); return; }
    const { error } = await supabase.from("palavras").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Palavra registrada");
    setOpen(false); setCongId(""); setCultoId("");
    qc.invalidateQueries({ queryKey: ["palavras-all"] });
  }

  const filt = (data ?? []).filter((p: any) =>
    [p.nome_irmao, p.tema, p.texto_biblico, p.congregacao_origem].some((v) => v?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Palavras pregadas</h2>
          <p className="text-sm text-muted-foreground">Histórico das mensagens.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setCongId(""); setCultoId(""); } }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova palavra</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar palavra</DialogTitle></DialogHeader>
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <Label>Igreja / Congregação</Label>
                  <Select value={congId} onValueChange={(v) => { setCongId(v); setCultoId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione a igreja..." /></SelectTrigger>
                    <SelectContent>
                      {(congs ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}{c.cidade ? ` · ${c.cidade}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Culto</Label>
                  <Select value={cultoId} onValueChange={setCultoId} disabled={!congId}>
                    <SelectTrigger><SelectValue placeholder={congId ? "Selecione o culto..." : "Escolha a igreja antes"} /></SelectTrigger>
                    <SelectContent>
                      {(cultos ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {formatDate(c.data)}{c.horario ? ` · ${c.horario.slice(0,5)}` : ""}
                        </SelectItem>
                      ))}
                      {congId && (cultos ?? []).length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum culto cadastrado nessa igreja.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Irmão que pregou</Label><Input name="nome_irmao" required placeholder="Nome completo" /></div>
                  <div>
                    <Label>Cargo</Label>
                    <Select name="cargo">
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FUNCOES_VISITANTE).map(([k, v]) => <SelectItem key={k} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Congregação de origem</Label><Input name="congregacao_origem" placeholder={selectedCong?.nome ?? ""} /></div>
                  <div><Label>Cidade de origem</Label><Input name="cidade_origem" placeholder={selectedCong?.cidade ?? ""} /></div>
                </div>
                <div><Label>Onde foi lido (texto bíblico)</Label><Input name="texto_biblico" placeholder="Ex.: Salmos 23" /></div>
                <div><Label>Tema</Label><Input name="tema" /></div>
                <div><Label>Resumo da mensagem</Label><Textarea name="resumo" rows={3} /></div>
                <DialogFooter><Button type="submit">Registrar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar irmão, tema, texto..." />
      </div>
      {filt.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma palavra registrada.</p> : (
        <div className="space-y-2">
          {filt.map((p: any) => (
            <Card key={p.id}><CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{p.nome_irmao} {p.cargo && <span className="ml-2 text-xs font-normal text-muted-foreground">{p.cargo}</span>}</p>
                  <p className="text-xs text-muted-foreground">{[p.congregacao_origem, p.cidade_origem].filter(Boolean).join(" · ") || "—"}</p>
                  {p.tema && <p className="mt-2 text-sm"><strong>Tema:</strong> {p.tema}</p>}
                  {p.texto_biblico && <p className="text-sm"><strong>Texto:</strong> {p.texto_biblico}</p>}
                  {p.resumo && <p className="mt-1 text-sm text-muted-foreground">{p.resumo}</p>}
                </div>
                {p.culto?.id && (
                  <Link to="/cultos/$id" params={{ id: p.culto.id }} className="shrink-0 text-xs text-primary hover:underline">
                    {formatDate(p.culto?.data)}
                  </Link>
                )}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
