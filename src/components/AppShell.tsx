import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
  LayoutDashboard, Building2, BookOpen, Music2, MessageSquareQuote,
  HandHelping, UserPlus, Mic2, Calendar, BarChart3, Sparkles, LogOut, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/congregacoes", label: "Congregações", icon: Building2 },
  { to: "/cultos", label: "Cultos", icon: BookOpen },
  { to: "/hinos", label: "Hinos", icon: Music2 },
  { to: "/palavras", label: "Palavras", icon: MessageSquareQuote },
  { to: "/atendimentos", label: "Atendimentos", icon: HandHelping },
  { to: "/visitantes", label: "Visitantes", icon: UserPlus },
  { to: "/musicos", label: "Músicos", icon: Mic2 },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/insights", label: "Insights IA", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function handleLogout() {
    await signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:relative lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gradient-primary)] text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Cultos CCB</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gestão interna</p>
            </div>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-sidebar-border bg-card/60 p-3">
          <p className="truncate text-sm font-medium">{profile?.nome ?? "Usuário"}</p>
          <p className="truncate text-xs text-muted-foreground">{roles.join(", ") || "usuario"}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <h1 className="text-base font-semibold">{NAV.find((n) => pathname.startsWith(n.to))?.label ?? "Cultos CCB"}</h1>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
