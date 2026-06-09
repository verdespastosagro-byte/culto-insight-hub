import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { generateInsights } from "@/lib/insights.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCcw } from "lucide-react";
import { PlanGate } from "@/components/PlanGate";

export const Route = createFileRoute("/_authenticated/insights")({ component: Page });

function Page() {
  return (
    <PlanGate feature="ia">
      <InsightsContent />
    </PlanGate>
  );
}

function InsightsContent() {
  const fn = useServerFn(generateInsights);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["insights"],
    queryFn: () => fn(),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["insights"],
    queryFn: () => fn(),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Insights com IA</h2>
          <p className="text-sm text-muted-foreground">Análise automática dos seus registros.</p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline">
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="grid place-items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />Analisando seus dados...
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Stat title="Hinos mais chamados" items={data?.stats.hinos_mais_chamados.map((h) => ({ label: `Hino ${h.numero}`, value: `${h.vezes}×` })) ?? []} />
            <Stat title="Pregadores frequentes" items={data?.stats.pregadores_mais_frequentes.map((p) => ({ label: p.nome, value: `${p.vezes}×` })) ?? []} />
            <Stat title="Congregações ativas" items={data?.stats.congregacoes_mais_visitadas.map((c) => ({ label: c.nome, value: `${c.vezes}×` })) ?? []} />
          </div>

          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="text-base">Resumo gerado por IA</CardTitle></CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {data?.resumo}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados.</p> : (
          <ul className="space-y-1.5 text-sm">
            {items.slice(0, 5).map((i, k) => (
              <li key={k} className="flex items-center justify-between gap-2">
                <span className="truncate">{i.label}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{i.value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
