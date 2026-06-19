import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookOpen, Building2, MessageSquareQuote, Music2, Newspaper, ArrowRight } from "lucide-react";
import { InstallPWA } from "@/components/InstallPWA";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listarFeed } from "@/lib/social.functions";
import { primeirosDoisNomes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const stats = useQuery({
    queryKey: ["dash-stats"],
    queryFn: async () => {
      const [cultos, palavras, congregacoes, hinos] = await Promise.all([
        supabase.from("cultos").select("*", { count: "exact", head: true }),
        supabase.from("palavras").select("*", { count: "exact", head: true }),
        supabase.from("congregacoes").select("*", { count: "exact", head: true }),
        supabase.from("hinos").select("*", { count: "exact", head: true }),
      ]);
      return {
        cultos: cultos.count ?? 0,
        palavras: palavras.count ?? 0,
        congregacoes: congregacoes.count ?? 0,
        hinos: hinos.count ?? 0,
      };
    },
  });


  const fetchFeed = useServerFn(listarFeed);
  const feed = useQuery({
    queryKey: ["dash-feed-mini"],
    queryFn: async () => fetchFeed({ data: { limite: 5 } }),
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
  });

  const cards = [
    { label: "Cultos registrados", value: stats.data?.cultos ?? 0, icon: BookOpen, color: "text-primary" },
    { label: "Congregações", value: stats.data?.congregacoes ?? 0, icon: Building2, color: "text-[color:var(--chart-2)]" },
    { label: "Hinos chamados", value: stats.data?.hinos ?? 0, icon: Music2, color: "text-[color:var(--chart-3)]" },
    { label: "Palavras", value: stats.data?.palavras ?? 0, icon: MessageSquareQuote, color: "text-[color:var(--chart-4)]" },
  ];


  return (
    <div className="space-y-6">
      <InstallPWA className="mb-2" />
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Visão geral</h2>
        <p className="text-sm text-muted-foreground">Resumo do sistema de gestão de cultos.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

      {/* Mini-feed estilo Instagram */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4" /> Feed da comunidade
          </CardTitle>
          <Link
            to="/feed"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Ver tudo <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {feed.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando publicações...</p>
          ) : !feed.data?.items.length ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há publicações.{" "}
              <Link to="/feed" className="text-primary hover:underline">
                Seja o primeiro a postar
              </Link>.
            </p>
          ) : (
            <ul className="space-y-4">
              {feed.data.items.map((p) => (
                <li key={p.id} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <Link to="/perfil/$userId" params={{ userId: p.user_id }} className="shrink-0">
                      <Avatar className="h-9 w-9">
                        {p.autor_foto_url ? (
                          <AvatarImage src={p.autor_foto_url} alt={p.autor_nome} className="rounded-full object-cover" />
                        ) : null}
                        <AvatarFallback>{p.autor_nome?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <Link
                          to="/perfil/$userId"
                          params={{ userId: p.user_id }}
                          className="truncate text-sm font-semibold hover:underline"
                        >
                          {primeirosDoisNomes(p.autor_nome)}
                        </Link>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      {p.texto && (
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm">
                          {p.texto}
                        </p>
                      )}
                      {p.foto_url && (
                        <img
                          src={p.foto_url}
                          alt=""
                          className="mt-2 max-h-80 w-full rounded-md border object-cover"
                          loading="lazy"
                        />
                      )}
                      {p.audio_url && (
                        <audio
                          src={p.audio_url}
                          controls
                          preload="metadata"
                          className="mt-2 h-9 w-full"
                        />
                      )}

                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>



    </div>
  );
}
