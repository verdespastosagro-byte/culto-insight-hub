import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanLimits, type PlanFeature } from "@/hooks/usePlanLimits";

interface PlanGateProps {
  feature: PlanFeature;
  children: ReactNode;
  title?: string;
  description?: string;
}

export function PlanGate({ feature, children, title, description }: PlanGateProps) {
  const { hasFeature, planLabel } = usePlanLimits();

  if (hasFeature(feature)) return <>{children}</>;

  const defaults: Record<PlanFeature, { title: string; description: string }> = {
    ia: {
      title: "Insights com IA",
      description: "Análises automáticas dos seus cultos com IA. Disponível no plano Pro.",
    },
    "culto-inteligente": {
      title: "Culto Inteligente",
      description: "Grave o culto e a IA extrai hinos, palavra, atendimentos e visitantes. Disponível no plano Pro.",
    },
    "relatorio-avancado": {
      title: "Relatórios avançados",
      description: "Exportação em PDF e Excel com filtros avançados. Disponível no plano Pro.",
    },
    "multi-congregacao": {
      title: "Várias congregações",
      description: "O plano Free permite apenas 1 congregação. Faça upgrade para gerenciar quantas quiser.",
    },
    "membros-ilimitados": {
      title: "Membros ilimitados",
      description: "Convide quantos cooperadores quiser. Disponível no plano Church.",
    },
  };

  const f = defaults[feature];

  return (
    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
        <Lock className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold">{title ?? f.title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description ?? f.description}</p>
      <p className="mt-3 text-xs text-muted-foreground">Seu plano atual: <strong>{planLabel}</strong></p>
      <Button asChild className="mt-4">
        <Link to="/pricing">
          <Sparkles className="mr-2 h-4 w-4" /> Ver planos
        </Link>
      </Button>
    </div>
  );
}
