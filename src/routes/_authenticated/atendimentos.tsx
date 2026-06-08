import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { formatDate } from "@/lib/constants";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/atendimentos")({ component: Page });

function Page() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["atend-all"],
    queryFn: async () => (await supabase.from("atendimentos")
      .select("*, culto:cultos(id, data, congregacao:congregacoes(nome))")
      .order("created_at", { ascending: false })).data ?? [],
  });
  const filt = (data ?? []).filter((a: any) =>
    [a.nome, a.cargo, a.congregacao_origem, a.cidade].some((v) => v?.toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Atendimentos</h2>
        <p className="text-sm text-muted-foreground">Histórico completo.</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." />
      </div>
      {filt.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum atendimento registrado.</p> : (
        <div className="grid gap-2 md:grid-cols-2">
          {filt.map((a: any) => (
            <Card key={a.id}><CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{a.nome}</p>
                  <p className="text-xs text-muted-foreground">{a.cargo ?? ""} {a.congregacao_origem && `· ${a.congregacao_origem}`}</p>
                </div>
                <Link to="/cultos/$id" params={{ id: a.culto?.id }} className="text-xs text-primary hover:underline">{formatDate(a.culto?.data)}</Link>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
