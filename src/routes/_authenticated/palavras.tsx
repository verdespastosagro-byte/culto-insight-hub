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
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate, FUNCOES_VISITANTE } from "@/lib/constants";
import { Plus, Search, Sparkles, Loader2, Pencil, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { gerarResumoPalavra } from "@/lib/palavras.functions";

export const Route = createFileRoute("/_authenticated/palavras")({ component: Page });

type Palavra = {
  id: string;
  culto_id: string | null;
  nome_irmao: string;
  cargo: string | null;
  congregacao_origem: string | null;
  cidade_origem: string | null;
  texto_biblico: string | null;
  tema: string | null;
  resumo: string | null;
  culto?: { id: string; data: string; congregacao_id?: string | null; congregacao?: { nome: string } | null } | null;
};

function Page() {
  const qc = useQueryClient();
  const { canEdit, isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Palavra | null>(null);
  const [congId, setCongId] = useState<string>("");
  const [cultoId, setCultoId] = useState<string>("");

  // Campos controlados (para permitir edição e auto-preenchimento)
  const [nomeIrmao, setNomeIrmao] = useState("");
  const [cargo, setCargo] = useState<string>("");
  const [congOrigem, setCongOrigem] = useState("");
  const [cidadeOrigem, setCidadeOrigem] = useState("");
  const [textoBiblico, setTextoBiblico] = useState("");
  const [tema, setTema] = useState("");
  const [resumo, setResumo] = useState("");
  const [gerando, setGerando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const gerarResumo = useServerFn(gerarResumoPalavra);

  async function handleGerarResumo() {
    if (!tema.trim() && !textoBiblico.trim()) {
      toast.error("Informe o tema ou o texto bíblico antes de gerar o resumo");
      return;
    }
    setGerando(true);
    try {
      const r = await gerarResumo({ data: { tema: tema.trim(), texto_biblico: textoBiblico.trim(), nome_irmao: nomeIrmao.trim() } });
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
      .select("*, culto:cultos(id, data, congregacao_id, congregacao:congregacoes(nome))")
      .order("created_at", { ascending: false })).data ?? [] as Palavra[],
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

  // Ao escolher uma congregação, preenche origem/cidade se ainda vazios
  useEffect(() => {
    if (!selectedCong) return;
    setCongOrigem((v) => v || selectedCong.nome || "");
    setCidadeOrigem((v) => v || selectedCong.cidade || "");
  }, [selectedCong]);

  function resetForm() {
    setEditing(null);
    setCongId(""); setCultoId("");
    setNomeIrmao(""); setCargo("");
    setCongOrigem(""); setCidadeOrigem("");
    setTextoBiblico(""); setTema(""); setResumo("");
  }

  function abrirEdicao(p: Palavra) {
    setEditing(p);
    setCongId(p.culto?.congregacao_id ?? "");
    setCultoId(p.culto_id ?? "");
    setNomeIrmao(p.nome_irmao ?? "");
    setCargo(p.cargo ?? "");
    setCongOrigem(p.congregacao_origem ?? "");
    setCidadeOrigem(p.cidade_origem ?? "");
    setTextoBiblico(p.texto_biblico ?? "");
    setTema(p.tema ?? "");
    setResumo(p.resumo ?? "");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cultoId) { toast.error("Selecione o culto"); return; }
    if (!nomeIrmao.trim()) { toast.error("Informe o nome do irmão"); return; }
    const payload: any = {
      culto_id: cultoId,
      nome_irmao: nomeIrmao.trim(),
      cargo: cargo || null,
      congregacao_origem: congOrigem.trim() || null,
      cidade_origem: cidadeOrigem.trim() || null,
      texto_biblico: textoBiblico.trim() || null,
      tema: tema.trim() || null,
      resumo: resumo.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("palavras").update(payload).eq("id", editing.id)
      : await supabase.from("palavras").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Palavra atualizada" : "Palavra registrada");
    setOpen(false); resetForm();
    qc.invalidateQueries({ queryKey: ["palavras-all"] });
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta palavra?")) return;
    const { error } = await supabase.from("palavras").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída");
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
          <p className="text-sm text-muted-foreground">Histórico das mensagens. As congregações sugeridas vêm das que você já cadastrou.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild><Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" />Nova palavra</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar palavra" : "Registrar palavra"}</DialogTitle></DialogHeader>
              <form ref={formRef} onSubmit={handleSave} className="space-y-3">
                <div>
                  <Label>Igreja / Congregação</Label>
                  <Select value={congId} onValueChange={(v) => { setCongId(v); setCultoId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione entre as suas congregações..." /></SelectTrigger>
                    <SelectContent>
                      {(congs ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}{c.cidade ? ` · ${c.cidade}` : ""}</SelectItem>)}
                      {(congs ?? []).length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">Cadastre uma congregação primeiro em "Congregações".</div>
                      )}
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
                  <div><Label>Irmão que pregou</Label><Input value={nomeIrmao} onChange={(e) => setNomeIrmao(e.target.value)} required placeholder="Nome completo" /></div>
                  <div>
                    <Label>Cargo</Label>
                    <Select value={cargo} onValueChange={setCargo}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FUNCOES_VISITANTE).map(([k, v]) => <SelectItem key={k} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Congregação de origem</Label><Input value={congOrigem} onChange={(e) => setCongOrigem(e.target.value)} placeholder={selectedCong?.nome ?? ""} /></div>
                  <div><Label>Cidade de origem</Label><Input value={cidadeOrigem} onChange={(e) => setCidadeOrigem(e.target.value)} placeholder={selectedCong?.cidade ?? ""} /></div>
                </div>
                <div><Label>Onde foi lido (texto bíblico)</Label><Input value={textoBiblico} onChange={(e) => setTextoBiblico(e.target.value)} placeholder="Ex.: Salmos 23" /></div>
                <div><Label>Tema</Label><Input value={tema} onChange={(e) => setTema(e.target.value)} /></div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Resumo da mensagem</Label>
                    <Button type="button" size="sm" variant="outline" onClick={handleGerarResumo} disabled={gerando}>
                      {gerando ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                      Gerar com IA
                    </Button>
                  </div>
                  <Textarea rows={4} value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="Clique em 'Gerar com IA' após informar tema/texto, ou escreva manualmente." />
                </div>
                <DialogFooter><Button type="submit">{editing ? "Salvar alterações" : "Registrar"}</Button></DialogFooter>
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
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {p.culto?.id && (
                    <Link to="/cultos/$id" params={{ id: p.culto.id }} className="text-xs text-primary hover:underline">
                      {formatDate(p.culto?.data)}
                    </Link>
                  )}
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => abrirEdicao(p)}><Pencil className="h-4 w-4" /></Button>
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  )}
                </div>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
