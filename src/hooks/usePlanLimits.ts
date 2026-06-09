import { useAuth, type OrgPlan } from "@/hooks/useAuth";

export type PlanFeature =
  | "ia"
  | "culto-inteligente"
  | "relatorio-avancado"
  | "multi-congregacao"
  | "membros-ilimitados";

const PLAN_RANK: Record<OrgPlan, number> = { free: 0, pro: 1, church: 2 };

export const PLAN_LABELS: Record<OrgPlan, string> = {
  free: "Free",
  pro: "Pro",
  church: "Church",
};

const FEATURE_MIN_PLAN: Record<PlanFeature, OrgPlan> = {
  ia: "pro",
  "culto-inteligente": "pro",
  "relatorio-avancado": "pro",
  "multi-congregacao": "pro",
  "membros-ilimitados": "church",
};

export const LIMITS: Record<OrgPlan, { cultosMes: number | null; congregacoes: number | null; cultoInteligenteMes: number | null; membros: number | null }> = {
  free: { cultosMes: 30, congregacoes: 1, cultoInteligenteMes: 0, membros: 1 },
  pro: { cultosMes: null, congregacoes: null, cultoInteligenteMes: 10, membros: 5 },
  church: { cultosMes: null, congregacoes: null, cultoInteligenteMes: null, membros: null },
};

export function usePlanLimits() {
  const { plan, planStatus, trialDaysLeft } = useAuth();

  // Durante trial, libera tudo como se fosse Pro
  const effective: OrgPlan = planStatus === "trialing" && trialDaysLeft > 0 ? "pro" : plan;
  const limits = LIMITS[effective];

  function hasFeature(f: PlanFeature) {
    return PLAN_RANK[effective] >= PLAN_RANK[FEATURE_MIN_PLAN[f]];
  }

  return {
    plan,
    effectivePlan: effective,
    planLabel: PLAN_LABELS[plan],
    isTrialing: planStatus === "trialing" && trialDaysLeft > 0,
    isExpired: planStatus === "expired" || (planStatus === "trialing" && trialDaysLeft === 0),
    limits,
    hasFeature,
    canUseIA: hasFeature("ia"),
    canUseCultoInteligente: hasFeature("culto-inteligente"),
    canUseRelatorioAvancado: hasFeature("relatorio-avancado"),
  };
}
