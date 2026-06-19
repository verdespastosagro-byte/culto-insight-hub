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
import { Building2, Plus, Pencil, Trash2, Search, Loader2, MapPin, Camera, X as XIcon } from "lucide-react";
import { listarCongregacoesPorCidade, buscarCidadesUf, type CongregacaoCidade, type CidadeOpcao } from "@/lib/ccb.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"] as const;

export const Route = createFileRoute("/_authenticated/congregacoes")({
  component: CongregacoesPage,
});

type Cong = { id: string; nome: string; cidade: string|null; estado: string|null; regiao: string|null; endereco: string|null; observacoes: string|null; foto_url: string|null };
type CultoRow = { id: string; data: string; tipo: string; congregacao_id: string | null };
type Filtro = "todas" | "hoje" | "semana" | "rjm";

function norm(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findDuplicada(
  existentes: Cong[],
  p: { nome: string; cidade: string | null; endereco: string | null },
) {
  const enderecoN = norm(p.endereco);
  const nomeN = norm(p.nome);
  const cidadeN = norm(p.cidade);
  return existentes.find((c) => {
    if (enderecoN && norm(c.endereco) === enderecoN) return true;
    if (nomeN && norm(c.nome) === nomeN && cidadeN && norm(c.cidade) === cidadeN) return true;
    return false;
  });
}

function CongregacoesPage() {
  const qc = useQueryClient();
  const { canEdit, isAdmin } = useAuth();
  const listar = useServerFn(listarCongregacoesPorCidade);
  const buscarCidades = useServerFn(buscarCidadesUf);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
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
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoExistente, setFotoExistente] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Visita: data + horário escolhido
  const [dataVisita, setDataVisita] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [horarioVisita, setHorarioVisita] = useState<string>("");
  const [sugestaoSelecionada, setSugestaoSelecionada] = useState<CongregacaoCidade | null>(null);

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
    setFotoFile(null);
    setFotoPreview(null);
    setFotoExistente(editing?.foto_url ?? null);
    setSugestoes([]);
    setErroSug(null);
    setHorarioVisita("");
    setSugestaoSelecionada(null);
    setDataVisita(new Date().toISOString().slice(0, 10));
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

  // Autocomplete cidade
  useEffect(() => {
    if (!open) return;
    const c = cidade.trim();
    if (c.length < 2) {
      setCidadeOpcoes([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const resp = await buscarCidades({ data: { q: c } });
        setCidadeOpcoes(resp.items);
      } catch (e) {
        console.error(e);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [cidade, open, buscarCidades]);

  const { data, isLoading } = useQuery({
    queryKey: ["congregacoes"],
    queryFn: async () => {
      const { data } = await supabase.from("congregacoes").select("*").order("nome");
      return (data ?? []) as Cong[];
    },
  });

  const { data: cultos } = useQuery({
    queryKey: ["cultos-resumo"],
    queryFn: async () => {
      const { data } = await supabase.from("cultos").select("id, data, tipo, congregacao_id");
      return (data ?? []) as CultoRow[];
    },
  });

  // Mapa: congregacao_id -> stats
  const statsPorCong = (() => {
    const m = new Map<string, { total: number; ultima: string | null; tipos: Set<string>; datas: Set<string> }>();
    (cultos ?? []).forEach((c) => {
      if (!c.congregacao_id) return;
      const cur = m.get(c.congregacao_id) ?? { total: 0, ultima: null, tipos: new Set<string>(), datas: new Set<string>() };
      cur.total += 1;
      if (!cur.ultima || c.data > cur.ultima) cur.ultima = c.data;
      cur.tipos.add(c.tipo);
      cur.datas.add(c.data);
      m.set(c.congregacao_id, cur);
    });
    return m;
  })();

  const hojeISO = new Date().toISOString().slice(0, 10);
  const seteDiasAtras = (() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  const filtered = (data ?? [])
    .filter((c) =>
      [c.nome, c.cidade, c.estado, c.regiao].some((v) => v?.toLowerCase().includes(q.toLowerCase()))
    )
    .filter((c) => {
      if (filtro === "todas") return true;
      const s = statsPorCong.get(c.id);
      if (!s) return false;
      if (filtro === "hoje") return s.datas.has(hojeISO);
      if (filtro === "semana") return Array.from(s.datas).some((d) => d >= seteDiasAtras);
      if (filtro === "rjm") return s.tipos.has("rjm");
      return true;
    })
    .sort((a, b) => (statsPorCong.get(b.id)?.total ?? 0) - (statsPorCong.get(a.id)?.total ?? 0));

  function escolherSugestao(s: CongregacaoCidade) {
    setEndereco(s.endereco);
    const partes: string[] = ["CCB"];
    if (s.bairro) partes.push(s.bairro);
    else partes.push(s.endereco.split(",")[0]);
    setNome(partes.join(" - "));
    if (s.bairro) setRegiao(s.bairro);
    setSugestaoSelecionada(s);
    setHorarioVisita("");
  }

  function formatarDataBR(iso: string) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  // Atualiza observações automaticamente ao mudar data ou horário escolhido
  useEffect(() => {
    if (!horarioVisita || !dataVisita) return;
    const linha = `Visitei em ${formatarDataBR(dataVisita)} • ${horarioVisita}`;
    setObservacoes((prev) => {
      const limpo = (prev ?? "")
        .split("\n")
        .filter((l) => !/^Visitei em /i.test(l.trim()))
        .join("\n")
        .trim();
      return limpo ? `${linha}\n${limpo}` : linha;
    });
  }, [dataVisita, horarioVisita]);


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

    let congId = editing?.id ?? null;

    if (!editing) {
      // Dedupe: procura uma congregação existente pelo mesmo endereço (ou nome+cidade)
      const igual = findDuplicada(data ?? [], payload);
      if (igual) {
        congId = igual.id;
        toast.info(`"${igual.nome}" já está cadastrada — vou apenas registrar sua visita.`);
      } else {
        const { data: ins, error } = await supabase.from("congregacoes").insert(payload).select("id").single();
        if (error) {
          // Caso o índice único do banco rejeite, faz fallback usando a duplicada
          if (/duplicate|unique/i.test(error.message)) {
            toast.info("Essa congregação já existe — registrando sua visita.");
            const { data: existe } = await supabase
              .from("congregacoes")
              .select("id,nome")
              .ilike("endereco", payload.endereco ?? "")
              .limit(1)
              .maybeSingle();
            if (existe?.id) congId = existe.id;
            else { toast.error(error.message); return; }
          } else {
            toast.error(error.message); return;
          }
        } else {
          congId = ins!.id as string;
        }
      }
    } else {
      const { error } = await supabase.from("congregacoes").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
    }

    // Upload de foto (opcional)
    if (congId && fotoFile) {
      setUploadingFoto(true);
      const ext = fotoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${congId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("congregacoes-fotos")
        .upload(path, fotoFile, { upsert: true, contentType: fotoFile.type });
      setUploadingFoto(false);
      if (upErr) {
        toast.error(`Foto não enviada: ${upErr.message}`);
      } else {
        const { error: updErr } = await supabase
          .from("congregacoes")
          .update({ foto_url: path })
          .eq("id", congId);
        if (updErr) toast.error(updErr.message);
      }
    }

    // Se um horário foi escolhido, registra a visita como um culto
    if (!editing && congId && horarioVisita && dataVisita) {
      const isRjm = /RJM/i.test(horarioVisita);
      const horaMatch = horarioVisita.match(/(\d{2}):(\d{2})/);
      const horario = horaMatch ? `${horaMatch[1]}:${horaMatch[2]}` : null;
      const { error: ce } = await supabase.from("cultos").insert({
        data: dataVisita,
        horario,
        tipo: (isRjm ? "rjm" : "culto_oficial") as never,
        congregacao_id: congId,
        cidade: payload.cidade,
      });
      if (ce) toast.error(`Visita não registrada: ${ce.message}`);
      else toast.success("Visita registrada!");
    } else {
      toast.success("Salvo!");
    }

    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["congregacoes"] });
    qc.invalidateQueries({ queryKey: ["cultos-resumo"] });
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
          <h2 className="text-2xl font-bold tracking-tight">Congregações que congreguei</h2>
          <p className="text-sm text-muted-foreground">
            Registre aqui cada congregação em que você participou de um culto. Se já tiver cadastrado uma congregação, não precisa cadastrar de novo — basta registrar a nova visita pelo botão de edição ou registrando o culto pelo mesmo endereço.
          </p>
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
                  <div className="relative">
                    <Label>Cidade</Label>
                    <Input
                      value={cidade}
                      onChange={(e) => { setCidade(e.target.value); setShowCidadeOpcoes(true); }}
                      onFocus={() => setShowCidadeOpcoes(true)}
                      onBlur={() => setTimeout(() => setShowCidadeOpcoes(false), 150)}
                      placeholder="Ex: Vitória da Conquista"
                      autoComplete="off"
                    />
                    {showCidadeOpcoes && cidadeOpcoes.length > 0 && (
                      <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                        {cidadeOpcoes.map((op, i) => (
                          <li key={`${op.cidade}-${op.uf}-${i}`}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setCidade(op.cidade);
                                setEstado(op.uf);
                                setShowCidadeOpcoes(false);
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                            >
                              <span>{op.cidade}</span>
                              <span className="text-xs text-muted-foreground">{op.uf}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Select value={estado} onValueChange={setEstado}>
                      <SelectTrigger className="w-24"><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
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

                <div className="rounded-md border border-dashed bg-primary/5 p-3 space-y-2">
                  <Label className="text-xs font-semibold">Registrar visita</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
                    <Input
                      type="date"
                      value={dataVisita}
                      onChange={(e) => setDataVisita(e.target.value)}
                    />
                    {sugestaoSelecionada && sugestaoSelecionada.horarios.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {sugestaoSelecionada.horarios.map((h, i) => {
                          const label = `${h.diaLabel} às ${h.hora}${h.tipo === "rjm" ? " (RJM)" : ""}`;
                          const ativo = horarioVisita === label;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setHorarioVisita(label)}
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-xs transition",
                                ativo
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background hover:bg-muted",
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="self-center text-xs text-muted-foreground">
                        Escolha uma congregação acima para selecionar o horário do culto que você participou.
                      </p>
                    )}
                  </div>
                </div>

                <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
                <div><Label>Região / Bairro</Label><Input value={regiao} onChange={(e) => setRegiao(e.target.value)} /></div>
                <div><Label>Endereço</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
                <div><Label>Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> Foto da congregação</Label>
                  {(fotoPreview || fotoExistente) && (
                    <div className="relative inline-block">
                      {fotoPreview ? (
                        <img src={fotoPreview} alt="Prévia" className="h-32 w-32 rounded-md object-cover border" />
                      ) : (
                        <CongFoto path={fotoExistente!} className="h-32 w-32 rounded-md object-cover border" />
                      )}
                      <button
                        type="button"
                        onClick={() => { setFotoFile(null); setFotoPreview(null); setFotoExistente(null); }}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow"
                        aria-label="Remover foto"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFotoFile(f);
                      setFotoPreview(f ? URL.createObjectURL(f) : null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Tire ou anexe uma foto da igreja que você visitou.</p>
                </div>

                <DialogFooter><Button type="submit" disabled={uploadingFoto}>{uploadingFoto ? "Enviando foto..." : "Salvar"}</Button></DialogFooter>


              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            { id: "todas", label: "Todas" },
            { id: "hoje", label: "Visitei hoje" },
            { id: "semana", label: "Últimos 7 dias" },
            { id: "rjm", label: "Com RJM" },
          ] as { id: Filtro; label: string }[]).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                filtro === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="grid place-items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <Building2 className="h-10 w-10 opacity-40" />
          Nenhuma congregação encontrada.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const s = statsPorCong.get(c.id);
            return (
              <Card key={c.id} className="overflow-hidden shadow-[var(--shadow-card)]">
                {c.foto_url && (
                  <CongFoto path={c.foto_url} className="h-36 w-full object-cover" />
                )}
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
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      (s?.total ?? 0) > 0
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground",
                    )}>
                      {s?.total ?? 0} {(s?.total ?? 0) === 1 ? "visita" : "visitas"}
                    </span>
                    {s?.tipos.has("rjm") && (
                      <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300">RJM</span>
                    )}
                    {s?.ultima && (
                      <span className="text-[11px] text-muted-foreground">Última: {formatarDataBR(s.ultima)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CongFoto({ path, className }: { path: string; className?: string }) {
  const { data: url } = useQuery({
    queryKey: ["cong-foto", path],
    queryFn: async () => {
      const { data } = await supabase.storage
        .from("congregacoes-fotos")
        .createSignedUrl(path, 60 * 60);
      return data?.signedUrl ?? null;
    },
    staleTime: 50 * 60 * 1000,
  });
  if (!url) return <div className={cn("bg-muted animate-pulse", className)} />;
  return <img src={url} alt="Foto da congregação" className={className} loading="lazy" />;
}
