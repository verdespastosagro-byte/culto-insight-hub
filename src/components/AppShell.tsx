import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
  LayoutDashboard, Building2, BookOpen, Music2, MessageSquareQuote,
  UserPlus, Calendar, BarChart3, Sparkles, LogOut, Menu, X, Radio, AlertTriangle, UserCircle, MapPin, ShieldAlert, CheckCircle2, Newspaper, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePlanLimits, PLAN_LABELS } from "@/hooks/usePlanLimits";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Gestão",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/congregacoes", label: "Congregações", icon: Building2 },
      { to: "/cultos", label: "Cultos", icon: BookOpen },
      { to: "/agenda", label: "Agenda", icon: Calendar },
    ],
  },
  {
    label: "Registros",
    items: [
      { to: "/palavras", label: "Palavras", icon: MessageSquareQuote },
      { to: "/ccb-perto-de-mim", label: "CCB perto de mim", icon: MapPin },
      { to: "/minhas-congregacoes", label: "Minhas congregações", icon: CheckCircle2 },
      { to: "/feed", label: "Feed", icon: Newspaper },
      { to: "/mensagens", label: "Mensagens", icon: MessageCircle },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { to: "/culto-inteligente", label: "Culto Inteligente", icon: Radio },
      { to: "/insights", label: "Insights IA", icon: Sparkles },
    ],
  },
  {
    label: "Administração",
    items: [
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
];

const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

const ADMIN_ITEM: NavItem = { to: "/admin", label: "Administração", icon: ShieldAlert };

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile, organization, plan, signOut, trialDaysLeft, isAdmin } = useAuth();
  const { isTrialing, isExpired } = usePlanLimits();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const groups: NavGroup[] = isAdmin
    ? [...NAV_GROUPS, { label: "Plataforma", items: [ADMIN_ITEM] }]
    : NAV_GROUPS;

  async function handleLogout() {
    await signOut();
    navigate({ to: "/auth" });
  }

  const planBadgeClass =
    isExpired ? "bg-destructive/15 text-destructive border-destructive/30"
    : isTrialing ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    : plan === "pro" ? "bg-primary/15 text-primary border-primary/30"
    : plan === "church" ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
    : "bg-muted text-muted-foreground border-border";

  const planLabel = isTrialing ? "TRIAL" : PLAN_LABELS[plan].toUpperCase();

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col transform glass-strong border-r border-sidebar-border text-sidebar-foreground transition-transform duration-[600ms] [transition-timing-function:var(--ease-cinematic)] lg:relative lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-primary-foreground shadow-sm"
              style={{ background: "var(--gradient-primary, hsl(var(--primary)))", backgroundColor: "hsl(var(--primary))" }}
            >
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Culto Insight Hub</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate max-w-[140px]">
                {organization?.name ?? "Gestão de cultos"}
              </p>
            </div>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {groups.map((g) => (
            <div key={g.label} className="mb-4">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const active = pathname === it.to || pathname.startsWith(it.to + "/");
                  return (
                    <Link
                      key={it.to}
                      to={it.to as "/dashboard"}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium pressable transition-colors duration-200",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                          style={{ background: "var(--gradient-iridescent)" }}
                        />
                      )}
                      <it.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="m-3 rounded-xl border border-sidebar-border bg-card/60 p-3">
          <Link
            to="/conta"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md -m-1 p-1 hover:bg-sidebar-accent/60"
          >
            {profile?.foto_url ? (
              <img
                src={profile.foto_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover border border-sidebar-border shrink-0"
              />
            ) : (
              <UserCircle className="h-8 w-8 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.nome ?? "Usuário"}</p>
              <p className="truncate text-[10px] text-muted-foreground">Minha conta</p>
            </div>
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide", planBadgeClass)}>
              {planLabel}
            </span>
            {isTrialing && (
              <span className="text-[10px] text-amber-700 dark:text-amber-300">{trialDaysLeft}d restantes</span>
            )}
          </div>
          {plan === "free" && !isTrialing && (
            <Link to="/pricing" className="mt-2 block text-xs font-medium text-primary hover:underline">
              Fazer upgrade →
            </Link>
          )}
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {isTrialing && trialDaysLeft <= 7 && (
          <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 lg:px-6">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">Seu trial gratuito termina em <strong>{trialDaysLeft} {trialDaysLeft === 1 ? "dia" : "dias"}</strong>.</span>
            <Link to="/pricing" className="font-medium underline-offset-2 hover:underline">Ver planos</Link>
          </div>
        )}
        {isExpired && (
          <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive lg:px-6">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">Seu trial gratuito acabou. Algumas funcionalidades estão limitadas.</span>
            <Link to="/pricing" className="font-medium underline-offset-2 hover:underline">Assinar agora</Link>
          </div>
        )}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/60 bg-background/60 px-4 backdrop-blur-xl saturate-150 lg:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <h1 className="text-base font-semibold tracking-tight">{ALL_ITEMS.find((n) => pathname.startsWith(n.to))?.label ?? "Culto Insight Hub"}</h1>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
