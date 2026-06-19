import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Planos e preços — Culto Insight Hub" },
      { name: "description", content: "Planos a partir de R$ 47/mês. 14 dias de trial gratuito, sem cartão." },
    ],
  }),
});

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

function PricingPage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["plan_configs"],
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="font-semibold">Culto Insight Hub</Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Planos simples, sem surpresa</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Todos os planos pagos incluem 14 dias de trial grátis. Sem cartão de crédito para começar.
          </p>
        </div>

        {isLoading ? (
          <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-3">
            {(plans ?? []).map((p) => (
              <div
                key={p.plan}
                className={`relative rounded-2xl border bg-card p-6 shadow-sm ${
                  p.highlight ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Mais popular
                  </div>
                )}
                <h3 className="text-lg font-semibold">{p.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">{p.price_label}</span>
                  <span className="text-sm text-muted-foreground">{p.period_label}</span>
                </div>
                <Button asChild className="mt-6 w-full" variant={p.highlight ? "default" : "outline"}>
                  <Link to="/auth">{p.cta_label}</Link>
                </Button>
                <ul className="mt-6 space-y-3">
                  {(p.features ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
