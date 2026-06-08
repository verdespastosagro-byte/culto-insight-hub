import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Trash2 } from "lucide-react";
import { TIPOS_REUNIAO, formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/agenda")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { canEdit } = useAuth();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["agenda"],
    queryFn: async () => (await supabase.from("agenda").select("*").order("data")).data ?? [],
  });

  const today = new Date().toISOString().slice(0, 10);
  const proximos = (data ?? []).filter((a: any) => a.data >= today);
  const passados = (data ?? []).filter((a: any) => a.data < today).reverse();

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("agenda").insert({
      data: String(fd.get("data")),
      horario: String(fd.get("horario") || "") || null,
      local: String(fd.get("local") || "") || null,
      responsavel: String(fd.get("resp") || "") || null,
      tipo: String(fd.get("tipo")) as any,
      observacoes: String(fd.get("obs") || "") || null,
    });
    if (error) toast.error(error.message); else { toast.success("Agendado"); setOpen(false); qc.invalidateQueries({ queryKey: ["agenda"] }); }
  }
  async function del(id: string) {
    if (!confirm("Excluir?")) return;
    await supabase.from("agenda").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["agenda"] });
  }

  function List({ items }: { items: any[] }) {
    if (items.length === 0) return <p className="text-sm text-muted-foreground">Nada por aqui.</p>;
    return (
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((a) => (
          <Card key={a.id}><CardContent className="flex items-start justify-between gap-2 p-4">
            <div>
              <p className="font-semibold">{formatDate(a.data)} {a.horario && `· ${a.horario.slice(0,5)}`}</p>
              <p className="text-xs text-muted-foreground">{TIPOS_REUNIAO[a.tipo]} · {a.local ?? "—"}</p>
              {a.responsavel && <p className="text-xs">Responsável: {a.responsavel}</p>}
              {a.observacoes && <p className="mt-1 text-xs text-muted-foreground">{a.observacoes}</p>}
            </div>
            {canEdit && <Button size="icon" variant="ghost" onClick={() => del(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          </CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agenda de reuniões</h2>
          <p className="text-sm text-muted-foreground">Programe reuniões e cultos especiais.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova reunião</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Agendar reunião</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data</Label><Input type="date" name="data" required /></div>
                  <div><Label>Horário</Label><Input type="time" name="horario" /></div>
                </div>
                <div><Label>Tipo</Label>
                  <Select name="tipo" defaultValue="culto_oficial"><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TIPOS_REUNIAO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Local</Label><Input name="local" /></div>
                <div><Label>Responsável</Label><Input name="resp" /></div>
                <div><Label>Observações</Label><Textarea name="obs" /></div>
                <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />Próximas</h3>
        <List items={proximos} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Anteriores</h3>
        <List items={passados.slice(0, 20)} />
      </div>
    </div>
  );
}
