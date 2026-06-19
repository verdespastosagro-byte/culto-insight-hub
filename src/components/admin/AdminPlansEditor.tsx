import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type PlanCfg = {
  plan: string;
  label: string;
  description: string;
  price_label: string;
  period_label: string;
  cta_label: string;
  features: string[];
  highlight: boolean;
  sort_order: number;
};

export function AdminPlansEditor() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-plan-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_configs")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PlanCfg[];
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4" /> Planos e valores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          (data ?? []).map((p) => <PlanCard key={p.plan} initial={p} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-plan-configs"] })} />)
        )}
      </CardContent>
    </Card>
  );
}

function PlanCard({ initial, onSaved }: { initial: PlanCfg; onSaved: () => void }) {
  const [p, setP] = useState<PlanCfg>(initial);
  const [newFeat, setNewFeat] = useState("");

  useEffect(() => setP(initial), [initial]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("plan_configs")
        .update({
          label: p.label,
          description: p.description,
          price_label: p.price_label,
          period_label: p.period_label,
          cta_label: p.cta_label,
          features: p.features,
          highlight: p.highlight,
          sort_order: p.sort_order,
        })
        .eq("plan", p.plan);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`Plano ${p.label} atualizado`); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  function addFeat() {
    const v = newFeat.trim();
    if (!v) return;
    setP({ ...p, features: [...p.features, v] });
    setNewFeat("");
  }
  function removeFeat(i: number) {
    setP({ ...p, features: p.features.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="uppercase">{p.plan}</Badge>
          {p.highlight && <Badge className="bg-primary/15 text-primary">Destaque</Badge>}
        </div>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
          Salvar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Nome exibido</Label>
          <Input value={p.label} onChange={(e) => setP({ ...p, label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Botão (CTA)</Label>
          <Input value={p.cta_label} onChange={(e) => setP({ ...p, cta_label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Preço</Label>
          <Input value={p.price_label} onChange={(e) => setP({ ...p, price_label: e.target.value })} placeholder="R$ 47" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Período</Label>
          <Input value={p.period_label} onChange={(e) => setP({ ...p, period_label: e.target.value })} placeholder="/mês" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Descrição</Label>
          <Textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} rows={2} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-2">
          <Label className="text-xs">Destacar (mais popular)</Label>
          <Switch checked={p.highlight} onCheckedChange={(v) => setP({ ...p, highlight: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ordem</Label>
          <Input type="number" value={p.sort_order} onChange={(e) => setP({ ...p, sort_order: Number(e.target.value) || 0 })} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label className="text-xs">Recursos do plano</Label>
        <div className="space-y-1">
          {p.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1">
              <Input
                value={f}
                onChange={(e) => {
                  const arr = [...p.features];
                  arr[i] = e.target.value;
                  setP({ ...p, features: arr });
                }}
                className="h-7 border-0 bg-transparent text-sm focus-visible:ring-0"
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFeat(i)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newFeat}
            onChange={(e) => setNewFeat(e.target.value)}
            placeholder="Novo recurso..."
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeat())}
          />
          <Button size="sm" variant="outline" onClick={addFeat}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </div>
  );
}
