import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOMENTOS_HINO, formatDate } from "@/lib/constants";
import { Music2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hinos")({ component: HinosPage });

function HinosPage() {
  const [numero, setNumero] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data } = useQuery({
    queryKey: ["all-hinos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hinos")
        .select("id, numero, titulo, momento, culto:cultos(id, data, congregacao:congregacoes(nome))")
        .order("numero");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((h: any) => {
      if (numero && !String(h.numero).includes(numero)) return false;
      const d = h.culto?.data;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [data, numero, from, to]);

  const ranking = useMemo(() => {
    const m = new Map<number, { numero: number; titulo: string|null; total: number }>();
    filtered.forEach((h: any) => {
      const r = m.get(h.numero) ?? { numero: h.numero, titulo: h.titulo, total: 0 };
      r.total++; m.set(h.numero, r);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Hinos</h2>
        <p className="text-sm text-muted-foreground">Histórico e estatísticas de hinos chamados.</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <div><Label>Número</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 5" /></div>
          <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Mais chamados ({filtered.length} ocorrências)</CardTitle></CardHeader>
          <CardContent>
            {ranking.length === 0 ? <p className="text-sm text-muted-foreground">Sem registros.</p> : (
              <ul className="space-y-2">
                {ranking.slice(0, 20).map((h) => (
                  <li key={h.numero} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <div><span className="font-semibold">Hino {h.numero}</span>{h.titulo && <span className="ml-2 text-xs text-muted-foreground">{h.titulo}</span>}</div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{h.total}×</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Music2 className="h-4 w-4" />Histórico detalhado</CardTitle></CardHeader>
          <CardContent>
            {filtered.length === 0 ? <p className="text-sm text-muted-foreground">Nada encontrado.</p> : (
              <ul className="max-h-[480px] divide-y divide-border overflow-y-auto">
                {filtered.map((h: any) => (
                  <li key={h.id} className="py-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Hino {h.numero}</span>
                      <span className="text-xs text-muted-foreground">{MOMENTOS_HINO[h.momento]}</span>
                    </div>
                    <Link to="/cultos/$id" params={{ id: h.culto?.id }} className="text-xs text-primary hover:underline">
                      {formatDate(h.culto?.data)} · {h.culto?.congregacao?.nome ?? "—"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
