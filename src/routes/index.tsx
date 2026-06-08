import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, Music, Users, BarChart3, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestão de Cultos CCB — Sistema Interno" },
      { name: "description", content: "Registre, organize e analise cultos, hinos, palavras e atendimentos da Congregação Cristã no Brasil." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  const features = [
    { icon: BookOpen, label: "Registro de cultos" },
    { icon: Music, label: "Histórico de hinos" },
    { icon: Users, label: "Pregadores e atendimentos" },
    { icon: Calendar, label: "Agenda de reuniões" },
    { icon: BarChart3, label: "Relatórios completos" },
    { icon: Sparkles, label: "Insights com IA" },
  ];

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Cultos CCB</span>
        </div>
        <Link to="/auth"><Button>Entrar</Button></Link>
      </header>

      <main className="container mx-auto px-6 pt-12 pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Sistema interno · CCB
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Gestão completa dos <span className="bg-gradient-to-r from-primary to-[var(--primary-glow)] bg-clip-text text-transparent">cultos</span> da sua congregação
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Registre cultos, hinos chamados, palavras pregadas, atendimentos e visitantes.
            Acompanhe estatísticas, gere relatórios e obtenha insights automáticos com IA.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth"><Button size="lg" className="shadow-[var(--shadow-elegant)]">Começar agora</Button></Link>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                <f.icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">{f.label}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
