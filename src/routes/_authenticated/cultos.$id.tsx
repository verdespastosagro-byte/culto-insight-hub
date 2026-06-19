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
import { ArrowLeft, Plus, Trash2, Music2, MessageSquareQuote, HandHelping, UserPlus, Pencil, History } from "lucide-react";
import { MOMENTOS_HINO, TIPOS_REUNIAO, FUNCOES_VISITANTE, formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/cultos/$id")({
  component: CultoDetail,
});

function CultoDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { canEdit } = useAuth();

  const culto = useQuery({
    queryKey: ["culto", id],
    queryFn: async () => {
      const { data } = await supabase.from("cultos").select("*, congregacao:congregacoes(nome, cidade)").eq("id", id).maybeSingle();
      return data;
    },
  });
  const hinos = useQuery({ queryKey: ["culto-hinos", id], queryFn: async () => (await supabase.from("hinos").select("*").eq("culto_id", id).order("created_at")).data ?? [] });
  const palavras = useQuery({ queryKey: ["culto-palavras", id], queryFn: async () => (await supabase.from("palavras").select("*").eq("culto_id", id)).data ?? [] });
  const atend = useQuery({ queryKey: ["culto-atend", id], queryFn: async () => (await supabase.from("atendimentos").select("*").eq("culto_id", id)).data ?? [] });
  const vis = useQuery({ queryKey: ["culto-vis", id], queryFn: async () => (await supabase.from("visitantes").select("*").eq("culto_id", id)).data ?? [] });

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
        <h2 className="mt-2 text-2xl font-bold tracking-tight">Culto de {formatDate(c.data)}</h2>
        <p className="text-sm text-muted-foreground">
          {TIPOS_REUNIAO[c.tipo]} {c.horario && `· ${c.horario.slice(0,5)}`} · {c.congregacao?.nome ?? c.cidade ?? "—"}
        </p>
        {c.observacoes && <p className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">{c.observacoes}</p>}
      </div>

      <Section
        title="Hinos chamados" icon={Music2} canEdit={canEdit}
        empty="Nenhum hino registrado."
        items={hinos.data ?? []}
        renderItem={(h: any) => (
          <>
            <p className="font-semibold">Hino {h.numero} <span className="ml-2 text-xs font-normal text-muted-foreground">{MOMENTOS_HINO[h.momento]}</span></p>
            {h.titulo && <p className="text-xs text-muted-foreground">{h.titulo}</p>}
          </>
        )}
        onDelete={(rid) => del("hinos", rid, "culto-hinos")}
        form={(close) => <HinoForm cultoId={id} onSaved={() => { close(); qc.invalidateQueries({ queryKey: ["culto-hinos", id] }); }} />}
      />

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

      <Section
        title="Visitantes" icon={UserPlus} canEdit={canEdit}
        empty="Nenhum visitante registrado."
        items={vis.data ?? []}
        renderItem={(v: any) => (
          <>
            <p className="font-semibold">{v.nome} <span className="ml-2 text-xs font-normal text-muted-foreground">{FUNCOES_VISITANTE[v.funcao]}</span></p>
            <p className="text-xs text-muted-foreground">{[v.congregacao_origem, v.cidade].filter(Boolean).join(" · ")}</p>
          </>
        )}
        onDelete={(rid) => del("visitantes", rid, "culto-vis")}
        form={(close) => <VisitanteForm cultoId={id} onSaved={() => { close(); qc.invalidateQueries({ queryKey: ["culto-vis", id] }); }} />}
      />
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

function HinoForm({ cultoId, onSaved }: { cultoId: string; onSaved: () => void }) {
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const { error } = await supabase.from("hinos").insert({
        culto_id: cultoId,
        numero: Number(fd.get("numero")),
        titulo: String(fd.get("titulo") || "") || null,
        momento: String(fd.get("momento")) as any,
      });
      if (error) toast.error(error.message); else { toast.success("Hino adicionado"); onSaved(); }
    }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Número</Label><Input type="number" name="numero" required min={1} max={9999} /></div>
        <div><Label>Momento</Label>
          <Select name="momento" defaultValue="entrada">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(MOMENTOS_HINO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Título (opcional)</Label><Input name="titulo" /></div>
      <DialogFooter><Button type="submit">Adicionar</Button></DialogFooter>
    </form>
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

function VisitanteForm({ cultoId, onSaved }: { cultoId: string; onSaved: () => void }) {
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const { error } = await supabase.from("visitantes").insert({
        culto_id: cultoId,
        nome: String(fd.get("nome")).trim(),
        funcao: String(fd.get("funcao")) as any,
        congregacao_origem: String(fd.get("cong") || "") || null,
        cidade: String(fd.get("cidade") || "") || null,
      });
      if (error) toast.error(error.message); else { toast.success("Salvo"); onSaved(); }
    }} className="space-y-3">
      <div><Label>Nome</Label><Input name="nome" required /></div>
      <div><Label>Função</Label>
        <Select name="funcao" defaultValue="irmao">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(FUNCOES_VISITANTE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Congregação</Label><Input name="cong" /></div>
        <div><Label>Cidade</Label><Input name="cidade" /></div>
      </div>
      <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
    </form>
  );
}
