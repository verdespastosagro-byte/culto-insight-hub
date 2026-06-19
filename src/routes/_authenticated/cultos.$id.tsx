import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, MessageSquareQuote, HandHelping, Pencil, History } from "lucide-react";
import { TIPOS_REUNIAO, formatDate } from "@/lib/constants";
import { ComentariosSection } from "@/components/ComentariosMural";

export const Route = createFileRoute("/_authenticated/cultos/$id")({
  component: CultoDetail,
});

function CultoDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  const canEdit = !!organizationId;

  const culto = useQuery({
    queryKey: ["culto", id],
    queryFn: async () => {
      const { data } = await supabase.from("cultos").select("*, congregacao:congregacoes(nome, cidade)").eq("id", id).maybeSingle();
      return data;
    },
  });
  const palavras = useQuery({ queryKey: ["culto-palavras", id], queryFn: async () => (await supabase.from("palavras").select("*").eq("culto_id", id)).data ?? [] });
  const atend = useQuery({ queryKey: ["culto-atend", id], queryFn: async () => (await supabase.from("atendimentos").select("*").eq("culto_id", id)).data ?? [] });
  const congs = useQuery({ queryKey: ["congs-list"], queryFn: async () => (await supabase.from("congregacoes").select("id, nome").order("nome")).data ?? [] });
  const audit = useQuery({ queryKey: ["culto-audit", id], queryFn: async () => (await supabase.from("cultos_audit").select("*").eq("culto_id", id).order("changed_at", { ascending: false })).data ?? [] });
  const [editOpen, setEditOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);

  const c = culto.data as any;

  if (culto.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!c) return <p className="text-sm text-muted-foreground">Culto não encontrado.</p>;

  async function del(table: string, rowId: string, key: string) {
    if (!confirm("Excluir?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", rowId);
    if (error) toast.error(error.message); else { toast.success("Excluído"); qc.invalidateQueries({ queryKey: [key, id] }); }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/cultos" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Culto de {formatDate(c.data)}</h2>
            <p className="text-sm text-muted-foreground">
              {TIPOS_REUNIAO[c.tipo]} {c.horario && `· ${c.horario.slice(0,5)}`} · {c.congregacao?.nome ?? c.cidade ?? "—"}
            </p>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Pencil className="mr-1 h-4 w-4" />Editar</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Editar culto</DialogTitle></DialogHeader>
                  <CultoEditForm culto={c} congs={congs.data ?? []} onSaved={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["culto", id] }); qc.invalidateQueries({ queryKey: ["culto-audit", id] }); qc.invalidateQueries({ queryKey: ["cultos"] }); }} />
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={histOpen} onOpenChange={setHistOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><History className="mr-1 h-4 w-4" />Histórico</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Histórico de alterações</DialogTitle></DialogHeader>
                <AuditList items={audit.data ?? []} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {c.observacoes && <p className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">{c.observacoes}</p>}
      </div>

      <Section
        title="Palavra" icon={MessageSquareQuote} canEdit={canEdit}
        empty="Nenhuma palavra registrada."
        items={palavras.data ?? []}
        renderItem={(p: any) => (
          <>
            <p className="font-semibold">{p.nome_irmao} {p.cargo && <span className="ml-2 text-xs font-normal text-muted-foreground">{p.cargo}</span>}</p>
            <p className="text-xs text-muted-foreground">{[p.congregacao_origem, p.cidade_origem].filter(Boolean).join(" · ")}</p>
            {p.tema && <p className="mt-1 text-sm"><strong>Tema:</strong> {p.tema}</p>}
            {p.texto_biblico && <p className="text-sm"><strong>Texto:</strong> {p.texto_biblico}</p>}
            {p.resumo && <p className="mt-1 text-sm">{p.resumo}</p>}
          </>
        )}
        onDelete={(rid) => del("palavras", rid, "culto-palavras")}
        form={(close) => <PalavraForm cultoId={id} onSaved={() => { close(); qc.invalidateQueries({ queryKey: ["culto-palavras", id] }); }} />}
      />

      <Section
        title="Atendimentos" icon={HandHelping} canEdit={canEdit}
        empty="Nenhum atendimento registrado."
        items={atend.data ?? []}
        renderItem={(a: any) => (
          <>
            <p className="font-semibold">{a.nome} {a.cargo && <span className="ml-2 text-xs font-normal text-muted-foreground">{a.cargo}</span>}</p>
            <p className="text-xs text-muted-foreground">{[a.congregacao_origem, a.cidade].filter(Boolean).join(" · ")}</p>
          </>
        )}
        onDelete={(rid) => del("atendimentos", rid, "culto-atend")}
        form={(close) => <AtendForm cultoId={id} onSaved={() => { close(); qc.invalidateQueries({ queryKey: ["culto-atend", id] }); }} />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comentários (visível para todo o sistema)</CardTitle>
        </CardHeader>
        <CardContent>
          <ComentariosSection alvoTipo="culto" alvoId={c.id} titulo="" />
        </CardContent>
      </Card>
    </div>
  );
}

type SectionProps = {
  title: string; icon: any; items: any[]; renderItem: (it: any) => any;
  onDelete: (id: string) => void; form: (close: () => void) => any; canEdit: boolean; empty: string;
};
function Section({ title, icon: Icon, items, renderItem, onDelete, form, canEdit, empty }: SectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><Icon className="h-4 w-4" />{title}</CardTitle>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Adicionar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
              {form(() => setOpen(false))}
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
          <ul className="divide-y divide-border">
            {items.map((it: any) => (
              <li key={it.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">{renderItem(it)}</div>
                {canEdit && <Button size="icon" variant="ghost" onClick={() => onDelete(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}


function PalavraForm({ cultoId, onSaved }: { cultoId: string; onSaved: () => void }) {
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const { error } = await supabase.from("palavras").insert({
        culto_id: cultoId,
        nome_irmao: String(fd.get("nome_irmao")).trim(),
        cargo: String(fd.get("cargo") || "") || null,
        congregacao_origem: String(fd.get("cong") || "") || null,
        cidade_origem: String(fd.get("cidade") || "") || null,
        texto_biblico: String(fd.get("texto") || "") || null,
        tema: String(fd.get("tema") || "") || null,
        resumo: String(fd.get("resumo") || "") || null,
      });
      if (error) toast.error(error.message); else { toast.success("Salvo"); onSaved(); }
    }} className="space-y-3 max-h-[70vh] overflow-y-auto">
      <div><Label>Irmão</Label><Input name="nome_irmao" required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Cargo</Label><Input name="cargo" /></div>
        <div><Label>Congregação</Label><Input name="cong" /></div>
      </div>
      <div><Label>Cidade de origem</Label><Input name="cidade" /></div>
      <div><Label>Texto bíblico</Label><Input name="texto" placeholder="Ex.: João 3:16" /></div>
      <div><Label>Tema</Label><Input name="tema" /></div>
      <div><Label>Resumo</Label><Textarea name="resumo" rows={4} /></div>
      <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
    </form>
  );
}

function AtendForm({ cultoId, onSaved }: { cultoId: string; onSaved: () => void }) {
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const { error } = await supabase.from("atendimentos").insert({
        culto_id: cultoId,
        nome: String(fd.get("nome")).trim(),
        cargo: String(fd.get("cargo") || "") || null,
        congregacao_origem: String(fd.get("cong") || "") || null,
        cidade: String(fd.get("cidade") || "") || null,
      });
      if (error) toast.error(error.message); else { toast.success("Salvo"); onSaved(); }
    }} className="space-y-3">
      <div><Label>Nome</Label><Input name="nome" required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Cargo</Label><Input name="cargo" /></div>
        <div><Label>Cidade</Label><Input name="cidade" /></div>
      </div>
      <div><Label>Congregação</Label><Input name="cong" /></div>
      <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
    </form>
  );
}


function CultoEditForm({ culto, congs, onSaved }: { culto: any; congs: { id: string; nome: string }[]; onSaved: () => void }) {
  const [data, setData] = useState(culto.data ?? "");
  const [horario, setHorario] = useState((culto.horario ?? "").slice(0, 5));
  const [tipo, setTipo] = useState(culto.tipo ?? "culto_oficial");
  const [congId, setCongId] = useState(culto.congregacao_id ?? "");
  const [obs, setObs] = useState(culto.observacoes ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      setSaving(true);
      const { error } = await supabase.from("cultos").update({
        data,
        horario: horario || null,
        tipo: tipo as any,
        congregacao_id: congId || null,
        observacoes: obs || null,
      }).eq("id", culto.id);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Culto atualizado"); onSaved();
    }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></div>
        <div><Label>Horário</Label><Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} /></div>
      </div>
      <div><Label>Tipo</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(TIPOS_REUNIAO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Congregação</Label>
        <Select value={congId} onValueChange={setCongId}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>{congs.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
      <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button></DialogFooter>
    </form>
  );
}

const FIELD_LABELS: Record<string, string> = {
  data: "Data", horario: "Horário", tipo: "Tipo", congregacao_id: "Congregação",
  cidade: "Cidade", participantes: "Participantes", observacoes: "Observações",
};
function formatVal(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}
function AuditList({ items }: { items: any[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>;
  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto">
      {items.map((a) => (
        <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold capitalize">{a.action === "insert" ? "Criado" : a.action === "update" ? "Editado" : "Excluído"}</span>
            <span className="text-xs text-muted-foreground">{new Date(a.changed_at).toLocaleString("pt-BR")}</span>
          </div>
          {a.action === "update" && a.changes && (
            <ul className="mt-2 space-y-1 text-xs">
              {Object.entries(a.changes as Record<string, { old: any; new: any }>).map(([k, diff]) => (
                <li key={k}>
                  <strong>{FIELD_LABELS[k] ?? k}:</strong>{" "}
                  <span className="text-muted-foreground line-through">{formatVal(diff.old)}</span>
                  {" → "}
                  <span>{formatVal(diff.new)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
