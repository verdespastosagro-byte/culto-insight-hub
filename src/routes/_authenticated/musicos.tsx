import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Mic2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/musicos")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { canEdit, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["musicos"],
    queryFn: async () => (await supabase.from("musicos").select("*, congregacao:congregacoes(nome)").order("nome")).data ?? [],
  });
  const { data: congs } = useQuery({
    queryKey: ["congs-list"],
    queryFn: async () => (await supabase.from("congregacoes").select("id, nome").order("nome")).data ?? [],
  });

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("musicos").insert({
      nome: String(fd.get("nome")).trim(),
      instrumento: String(fd.get("instrumento") || "") || null,
      congregacao_id: String(fd.get("cong") || "") || null,
      ativo: fd.get("ativo") === "on",
    });
    if (error) toast.error(error.message); else { toast.success("Salvo"); setOpen(false); qc.invalidateQueries({ queryKey: ["musicos"] }); }
  }

  async function toggle(id: string, ativo: boolean) {
    await supabase.from("musicos").update({ ativo: !ativo }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["musicos"] });
  }
  async function del(id: string) {
    if (!confirm("Excluir?")) return;
    await supabase.from("musicos").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["musicos"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Músicos</h2>
          <p className="text-sm text-muted-foreground">Cadastro e escala.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo músico</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo músico</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-3">
                <div><Label>Nome</Label><Input name="nome" required /></div>
                <div><Label>Instrumento</Label><Input name="instrumento" /></div>
                <div><Label>Congregação</Label>
                  <Select name="cong"><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{(congs ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2"><input type="checkbox" name="ativo" id="at" defaultChecked /><Label htmlFor="at">Ativo</Label></div>
                <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {(data ?? []).length === 0 ? (
        <Card><CardContent className="grid place-items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <Mic2 className="h-10 w-10 opacity-40" />Nenhum músico cadastrado.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((m: any) => (
            <Card key={m.id}><CardContent className="flex items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="font-semibold">{m.nome}</p>
                <p className="text-xs text-muted-foreground">{m.instrumento ?? "—"} · {m.congregacao?.nome ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && <Switch checked={m.ativo} onCheckedChange={() => toggle(m.id, m.ativo)} />}
                {isAdmin && <Button size="icon" variant="ghost" onClick={() => del(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
