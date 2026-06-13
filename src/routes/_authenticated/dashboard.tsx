import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { BookOpen, Building2, MessageSquareQuote, HandHelping, Music2, TrendingUp } from "lucide-react";
import { InstallPWA } from "@/components/InstallPWA";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDate, TIPOS_REUNIAO } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const COLORS = ["hsl(210 90% 56%)", "hsl(180 70% 50%)", "hsl(155 60% 50%)", "hsl(40 90% 60%)", "hsl(280 65% 60%)"];

function Dashboard() {
  const stats = useQuery({
    queryKey: ["dash-stats"],
    queryFn: async () => {
      const [cultos, palavras, atendimentos, congregacoes, hinos] = await Promise.all([
        supabase.from("cultos").select("*", { count: "exact", head: true }),
        supabase.from("palavras").select("*", { count: "exact", head: true }),
        supabase.from("atendimentos").select("*", { count: "exact", head: true }),
        supabase.from("congregacoes").select("*", { count: "exact", head: true }),
        supabase.from("hinos").select("*", { count: "exact", head: true }),
      ]);
      return {
        cultos: cultos.count ?? 0,
        palavras: palavras.count ?? 0,
        atendimentos: atendimentos.count ?? 0,
        congregacoes: congregacoes.count ?? 0,
        hinos: hinos.count ?? 0,
      };
    },
  });

  const recentes = useQuery({
    queryKey: ["dash-recentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cultos")
        .select("id, data, tipo, cidade, congregacao:congregacoes(nome)")
        .order("data", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const proximos = useQuery({
    queryKey: ["dash-proximos"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("agenda").select("*").gte("data", today).order("data").limit(5);
      return data ?? [];
    },
  });

  const topHinos = useQuery({
    queryKey: ["dash-top-hinos"],
    queryFn: async () => {
      const { data } = await supabase.from("hinos").select("numero, titulo");
      const map = new Map<number, { numero: number; titulo: string | null; total: number }>();
      (data ?? []).forEach((h: any) => {
        const r = map.get(h.numero) ?? { numero: h.numero, titulo: h.titulo, total: 0 };
        r.total++; map.set(h.numero, r);
      });
      return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
    },
  });

  const cultosPorMes = useQuery({
    queryKey: ["dash-mes"],
    queryFn: async () => {
      const { data } = await supabase.from("cultos").select("data");
      const months: Record<string, number> = {};
      (data ?? []).forEach((c: any) => {
        const k = c.data.slice(0, 7);
        months[k] = (months[k] ?? 0) + 1;
      });
      return Object.entries(months).sort().slice(-6).map(([k, v]) => {
        const [y, m] = k.split("-");
        return { mes: `${m}/${y.slice(2)}`, total: v };
      });
    },
  });

  const tipoDist = useQuery({
    queryKey: ["dash-tipo"],
    queryFn: async () => {
      const { data } = await supabase.from("cultos").select("tipo");
      const map: Record<string, number> = {};
      (data ?? []).forEach((c: any) => { map[c.tipo] = (map[c.tipo] ?? 0) + 1; });
      return Object.entries(map).map(([k, v]) => ({ name: TIPOS_REUNIAO[k] ?? k, value: v }));
    },
  });

  const cards = [
    { label: "Cultos registrados", value: stats.data?.cultos ?? 0, icon: BookOpen, color: "text-primary" },
    { label: "Congregações", value: stats.data?.congregacoes ?? 0, icon: Building2, color: "text-[color:var(--chart-2)]" },
    { label: "Hinos chamados", value: stats.data?.hinos ?? 0, icon: Music2, color: "text-[color:var(--chart-3)]" },
    { label: "Palavras", value: stats.data?.palavras ?? 0, icon: MessageSquareQuote, color: "text-[color:var(--chart-4)]" },
    { label: "Atendimentos", value: stats.data?.atendimentos ?? 0, icon: HandHelping, color: "text-[color:var(--chart-5)]" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Visão geral</h2>
        <p className="text-sm text-muted-foreground">Resumo do sistema de gestão de cultos.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="shadow-[var(--shadow-card)]">
            <CardContent className="p-4">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <p className="mt-3 text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader><CardTitle className="text-base">Cultos por mês</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={cultosPorMes.data ?? []}>
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader><CardTitle className="text-base">Tipos de reunião</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={tipoDist.data ?? []} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                  {(tipoDist.data ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-[var(--shadow-card)]">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Hinos mais chamados</CardTitle></CardHeader>
          <CardContent>
            {(topHinos.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem registros ainda.</p>
            ) : (
              <ul className="space-y-2">
                {(topHinos.data ?? []).map((h) => (
                  <li key={h.numero} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <div>
                      <span className="font-semibold">Hino {h.numero}</span>
                      {h.titulo && <span className="ml-2 text-sm text-muted-foreground">{h.titulo}</span>}
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{h.total}×</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader><CardTitle className="text-base">Próximas reuniões</CardTitle></CardHeader>
          <CardContent>
            {(proximos.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma reunião agendada.</p>
            ) : (
              <ul className="space-y-2">
                {(proximos.data ?? []).map((p: any) => (
                  <li key={p.id} className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">{formatDate(p.data)} {p.horario && `· ${p.horario.slice(0,5)}`}</p>
                    <p className="text-xs text-muted-foreground">{TIPOS_REUNIAO[p.tipo] ?? p.tipo} · {p.local ?? "—"}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader><CardTitle className="text-base">Últimos cultos</CardTitle></CardHeader>
        <CardContent>
          {(recentes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum culto registrado ainda. <Link to="/cultos" className="text-primary underline">Adicionar o primeiro</Link>.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(recentes.data ?? []).map((c: any) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{formatDate(c.data)} — {TIPOS_REUNIAO[c.tipo] ?? c.tipo}</p>
                    <p className="text-xs text-muted-foreground">{c.congregacao?.nome ?? c.cidade ?? "—"}</p>
                  </div>
                  <Link to="/cultos/$id" params={{ id: c.id }} className="text-sm text-primary hover:underline">Abrir</Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
