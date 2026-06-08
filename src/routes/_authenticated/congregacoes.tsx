import { createFileRoute } from "@tanstack/react-router";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/congregacoes")({
  component: CongregacoesPage,
});

type Cong = { id: string; nome: string; cidade: string|null; estado: string|null; regiao: string|null; endereco: string|null; observacoes: string|null };

function CongregacoesPage() {
  const qc = useQueryClient();
  const { canEdit, isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Cong | null>(null);
  const [open, setOpen] = useState(false);

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

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: String(fd.get("nome") ?? "").trim(),
      cidade: String(fd.get("cidade") ?? "") || null,
      estado: String(fd.get("estado") ?? "") || null,
      regiao: String(fd.get("regiao") ?? "") || null,
      endereco: String(fd.get("endereco") ?? "") || null,
      observacoes: String(fd.get("observacoes") ?? "") || null,
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
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} congregação</DialogTitle></DialogHeader>
              <form onSubmit={handleSave} className="space-y-3">
                <div><Label>Nome</Label><Input name="nome" defaultValue={editing?.nome} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cidade</Label><Input name="cidade" defaultValue={editing?.cidade ?? ""} /></div>
                  <div><Label>Estado</Label><Input name="estado" defaultValue={editing?.estado ?? ""} maxLength={2} /></div>
                </div>
                <div><Label>Região</Label><Input name="regiao" defaultValue={editing?.regiao ?? ""} /></div>
                <div><Label>Endereço</Label><Input name="endereco" defaultValue={editing?.endereco ?? ""} /></div>
                <div><Label>Observações</Label><Textarea name="observacoes" defaultValue={editing?.observacoes ?? ""} /></div>
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
