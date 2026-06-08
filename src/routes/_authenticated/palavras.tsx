import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { formatDate } from "@/lib/constants";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/palavras")({ component: Page });

function Page() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["palavras-all"],
    queryFn: async () => (await supabase.from("palavras")
      .select("*, culto:cultos(id, data, congregacao:congregacoes(nome))")
      .order("created_at", { ascending: false })).data ?? [],
  });
  const filt = (data ?? []).filter((p: any) =>
    [p.nome_irmao, p.tema, p.texto_biblico, p.congregacao_origem].some((v) => v?.toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Palavras pregadas</h2>
        <p className="text-sm text-muted-foreground">Histórico das mensagens.</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar irmão, tema, texto..." />
      </div>
      {filt.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma palavra registrada.</p> : (
        <div className="space-y-2">
          {filt.map((p: any) => (
            <Card key={p.id}><CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{p.nome_irmao} {p.cargo && <span className="ml-2 text-xs font-normal text-muted-foreground">{p.cargo}</span>}</p>
                  <p className="text-xs text-muted-foreground">{[p.congregacao_origem, p.cidade_origem].filter(Boolean).join(" · ") || "—"}</p>
                  {p.tema && <p className="mt-2 text-sm"><strong>Tema:</strong> {p.tema}</p>}
                  {p.texto_biblico && <p className="text-sm"><strong>Texto:</strong> {p.texto_biblico}</p>}
                  {p.resumo && <p className="mt-1 text-sm text-muted-foreground">{p.resumo}</p>}
                </div>
                <Link to="/cultos/$id" params={{ id: p.culto?.id }} className="shrink-0 text-xs text-primary hover:underline">
                  {formatDate(p.culto?.data)}
                </Link>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
