import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { TIPOS_REUNIAO, formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/cultos/")({
  component: CultosList,
});

function CultosList() {
  const qc = useQueryClient();
  const { canEdit } = useAuth();
  const [open, setOpen] = useState(false);
  const [congregacaoId, setCongregacaoId] = useState("");

  const { data: cultos } = useQuery({
    queryKey: ["cultos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cultos")
        .select("id, data, horario, tipo, cidade, participantes, congregacao:congregacoes(nome)")
        .order("data", { ascending: false });
      return data ?? [];
    },
  });

  const { data: congs } = useQuery({
    queryKey: ["congs-list"],
    queryFn: async () => {
      const { data } = await supabase.from("congregacoes").select("id, nome").order("nome");
      return data ?? [];
    },
  });

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      data: String(fd.get("data")),
      horario: String(fd.get("horario") || "") || null,
      tipo: String(fd.get("tipo")),
      congregacao_id: congregacaoId || null,
      observacoes: String(fd.get("observacoes") || "") || null,
    };
    const { error } = await supabase.from("cultos").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Culto registrado"); setOpen(false); setCongregacaoId("");
    qc.invalidateQueries({ queryKey: ["cultos"] });
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este culto e todos os hinos/palavras associados?")) return;
    const { error } = await supabase.from("cultos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["cultos"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cultos</h2>
          <p className="text-sm text-muted-foreground">Histórico e registro de cultos.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo culto</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar culto</DialogTitle></DialogHeader>
              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data</Label><Input type="date" name="data" required defaultValue={new Date().toISOString().slice(0,10)} /></div>
                  <div><Label>Horário</Label><Input type="time" name="horario" /></div>
                </div>
                <div><Label>Tipo</Label>
                  <Select name="tipo" defaultValue="culto_oficial">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPOS_REUNIAO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Congregação</Label>
                  <Select value={congregacaoId} onValueChange={setCongregacaoId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(congs ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Observações</Label><Textarea name="observacoes" /></div>
                <DialogFooter><Button type="submit">Registrar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(cultos ?? []).length === 0 ? (
        <Card><CardContent className="grid place-items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <BookOpen className="h-10 w-10 opacity-40" />Nenhum culto registrado ainda.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {(cultos ?? []).map((c: any) => (
            <Card key={c.id} className="shadow-[var(--shadow-card)]">
              <CardContent className="flex items-center justify-between p-4">
                <Link to="/cultos/$id" params={{ id: c.id }} className="flex-1 min-w-0">
                  <p className="font-semibold">{formatDate(c.data)} {c.horario && `· ${c.horario.slice(0,5)}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {TIPOS_REUNIAO[c.tipo]} · {c.congregacao?.nome ?? c.cidade ?? "—"} {c.participantes && `· ${c.participantes} pessoas`}
                  </p>
                </Link>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
