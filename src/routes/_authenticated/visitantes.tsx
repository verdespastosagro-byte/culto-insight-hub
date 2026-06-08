import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, FUNCOES_VISITANTE } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/visitantes")({ component: Page });

function Page() {
  const { data } = useQuery({
    queryKey: ["visit-all"],
    queryFn: async () => (await supabase.from("visitantes")
      .select("*, culto:cultos(id, data)").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Visitantes</h2>
        <p className="text-sm text-muted-foreground">Histórico de visitas recebidas. Adicione visitantes ao abrir um culto.</p>
      </div>
      {(data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum visitante registrado.</p> : (
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((v: any) => (
            <Card key={v.id}><CardContent className="p-4">
              <p className="font-semibold">{v.nome}</p>
              <p className="text-xs text-muted-foreground">{FUNCOES_VISITANTE[v.funcao]} · {[v.congregacao_origem, v.cidade].filter(Boolean).join(" / ") || "—"}</p>
              {v.culto && <Link to="/cultos/$id" params={{ id: v.culto.id }} className="mt-2 inline-block text-xs text-primary hover:underline">Culto de {formatDate(v.culto.data)}</Link>}
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
