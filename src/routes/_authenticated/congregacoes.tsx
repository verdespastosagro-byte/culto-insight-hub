import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Trash2, Search, Loader2, MapPin } from "lucide-react";
import { listarCongregacoesPorCidade, buscarCidadesUf, type CongregacaoCidade, type CidadeOpcao } from "@/lib/ccb.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"] as const;

export const Route = createFileRoute("/_authenticated/congregacoes")({
  component: CongregacoesPage,
});

type Cong = { id: string; nome: string; cidade: string|null; estado: string|null; regiao: string|null; endereco: string|null; observacoes: string|null };

function CongregacoesPage() {
  const qc = useQueryClient();
  const { canEdit, isAdmin } = useAuth();
  const listar = useServerFn(listarCongregacoesPorCidade);
  const buscarCidades = useServerFn(buscarCidadesUf);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Cong | null>(null);
  const [open, setOpen] = useState(false);

  // Autocomplete de cidade
  const [cidadeOpcoes, setCidadeOpcoes] = useState<CidadeOpcao[]>([]);
  const [showCidadeOpcoes, setShowCidadeOpcoes] = useState(false);

  // Form state controlado p/ poder preencher ao escolher uma sugestão
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [regiao, setRegiao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Sugestões CCB da cidade
  const [sugestoes, setSugestoes] = useState<CongregacaoCidade[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [erroSug, setErroSug] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNome(editing?.nome ?? "");
    setCidade(editing?.cidade ?? "");
    setEstado(editing?.estado ?? "");
    setRegiao(editing?.regiao ?? "");
    setEndereco(editing?.endereco ?? "");
    setObservacoes(editing?.observacoes ?? "");
    setSugestoes([]);
    setErroSug(null);
  }, [open, editing]);

  // Busca sugestões quando cidade+UF estão preenchidos (debounced)
  useEffect(() => {
    if (!open) return;
    const c = cidade.trim();
    const uf = estado.trim();
    if (c.length < 3 || uf.length !== 2) {
      setSugestoes([]);
      setErroSug(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoadingSug(true);
      setErroSug(null);
      try {
        const resp = await listar({ data: { cidade: c, uf } });
        if (resp.error) {
          setErroSug(resp.error);
          setSugestoes([]);
        } else {
          setSugestoes(resp.items);
          if (!resp.items.length) setErroSug("Nenhuma congregação encontrada para esta cidade.");
        }
      } catch (e) {
        console.error(e);
        setErroSug("Erro ao consultar congregações.");
      } finally {
        setLoadingSug(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [cidade, estado, open, listar]);

  const { data, isLoading } = useQuery({
    queryKey: ["congregacoes"],
    queryFn: async () => {
      const { data } = await supabase.from("congregacoes").select("*").order("nome");
      return (data ?? []) as Cong[];
    },
  });

  const filtered = (data ?? []).filter((c) =>
    [c.nome, c.cidade, c.estado, c.regiao].some((v) => v?.toLowerCase().includes(q.toLowerCase()))
  );

  function escolherSugestao(s: CongregacaoCidade) {
    setEndereco(s.endereco);
    const partes: string[] = ["CCB"];
    if (s.bairro) partes.push(s.bairro);
    else partes.push(s.endereco.split(",")[0]);
    setNome(partes.join(" - "));
    if (s.bairro) setRegiao(s.bairro);
    if (s.horarios.length) {
      const obs = Object.entries(
        s.horarios.reduce<Record<string, string[]>>((acc, h) => {
          (acc[h.diaLabel] ||= []).push(h.hora);
          return acc;
        }, {}),
      )
        .map(([d, hs]) => `${d}: ${[...new Set(hs)].sort().join(", ")}`)
        .join(" | ");
      setObservacoes(obs);
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      nome: nome.trim(),
      cidade: cidade.trim() || null,
      estado: estado.trim() || null,
      regiao: regiao.trim() || null,
      endereco: endereco.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    if (!payload.nome) { toast.error("Nome obrigatório"); return; }
    const { error } = editing?.id
      ? await supabase.from("congregacoes").update(payload).eq("id", editing.id)
      : await supabase.from("congregacoes").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo!"); setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["congregacoes"] });
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta congregação?")) return;
    const { error } = await supabase.from("congregacoes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["congregacoes"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Congregações</h2>
          <p className="text-sm text-muted-foreground">Cadastro das congregações.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nova congregação</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} congregação</DialogTitle></DialogHeader>
              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <div><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: Vitória da Conquista" /></div>
                  <div><Label>UF</Label><Input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} className="w-20" placeholder="BA" /></div>
                </div>

                {/* Sugestões CCB */}
                {(loadingSug || sugestoes.length > 0 || erroSug) && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      Congregações em {cidade || "..."} / {estado || "--"}
                      {loadingSug && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                    {erroSug && !loadingSug && (
                      <p className="text-xs text-muted-foreground">{erroSug}</p>
                    )}
                    {sugestoes.length > 0 && (
                      <ul className="max-h-56 space-y-1 overflow-y-auto">
                        {sugestoes.map((s, i) => (
                          <li key={i}>
                            <button
                              type="button"
                              onClick={() => escolherSugestao(s)}
                              className={cn(
                                "w-full rounded-md border px-3 py-2 text-left text-xs transition",
                                endereco === s.endereco
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background hover:bg-muted",
                              )}
                            >
                              <p className="font-medium">{s.bairro ?? s.endereco.split(",")[0]}</p>
                              <p className="text-muted-foreground">{s.endereco}</p>
                              {s.horarios.length > 0 && (
                                <p className="mt-1 text-muted-foreground">
                                  {s.horarios.length} horário{s.horarios.length === 1 ? "" : "s"} cadastrados
                                </p>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
                <div><Label>Região / Bairro</Label><Input value={regiao} onChange={(e) => setRegiao(e.target.value)} /></div>
                <div><Label>Endereço</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
                <div><Label>Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
                <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="grid place-items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <Building2 className="h-10 w-10 opacity-40" />
          Nenhuma congregação cadastrada.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{c.nome}</h3>
                    <p className="text-xs text-muted-foreground">{[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"}</p>
                    {c.regiao && <p className="mt-1 text-xs text-muted-foreground">Região: {c.regiao}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  )}
                </div>
                {c.endereco && <p className="mt-3 text-xs text-muted-foreground">{c.endereco}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
