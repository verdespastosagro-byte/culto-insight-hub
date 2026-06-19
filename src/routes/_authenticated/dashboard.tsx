import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Building2,
  MessageSquareQuote,
  Newspaper,
  ArrowRight,
  MapPin,
  Users,
  Lock,
  Eye,
  Building,
} from "lucide-react";
import { InstallPWA } from "@/components/InstallPWA";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getPerfilPublico, listarFeed } from "@/lib/social.functions";
import { useAuth } from "@/hooks/useAuth";
import { primeirosDoisNomes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FundoAnimado, type EfeitoFundo } from "@/components/FundoAnimado";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const EFEITO_OPCOES: { value: EfeitoFundo; label: string }[] = [
  { value: "nenhum", label: "Nenhum" },
  { value: "chuva", label: "Chuva" },
  { value: "chuva_raio", label: "Chuva com raios" },
  { value: "neve", label: "Neve" },
];

function isEfeito(v: unknown): v is EfeitoFundo {
  return v === "nenhum" || v === "chuva" || v === "chuva_raio" || v === "neve";
}

function Dashboard() {
  const { user } = useAuth();

  const [efeito, setEfeito] = useState<EfeitoFundo>("nenhum");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    supabase
      .from("profiles")
      .select("fundo_animado")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        if (data && isEfeito(data.fundo_animado)) setEfeito(data.fundo_animado);
      });
    return () => {
      cancel = true;
    };
  }, [user]);

  async function escolherEfeito(novo: EfeitoFundo) {
    if (!user || novo === efeito) return;
    const anterior = efeito;
    setEfeito(novo);
    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({ fundo_animado: novo })
      .eq("id", user.id);
    setSalvando(false);
    if (error) {
      setEfeito(anterior);
      toast.error("Não foi possível salvar a preferência");
    } else {
      toast.success("Preferência salva");
    }
  }


  const fetchPerfil = useServerFn(getPerfilPublico);
  const perfilQ = useQuery({
    queryKey: ["dash-meu-perfil", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await fetchPerfil({ data: { userId: user!.id } })).perfil,
    staleTime: 5 * 60_000,
  });

  const stats = useQuery({
    queryKey: ["dash-stats"],
    queryFn: async () => {
      const [cultos, palavras, congregacoes] = await Promise.all([
        supabase.from("cultos").select("*", { count: "exact", head: true }),
        supabase.from("palavras").select("*", { count: "exact", head: true }),
        supabase.from("congregacoes").select("*", { count: "exact", head: true }),
      ]);
      return {
        cultos: cultos.count ?? 0,
        palavras: palavras.count ?? 0,
        congregacoes: congregacoes.count ?? 0,
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
    { label: "Palavras", value: stats.data?.palavras ?? 0, icon: MessageSquareQuote, color: "text-[color:var(--chart-4)]" },
  ];

  const perfil = perfilQ.data;

  return (
    <>
      <FundoAnimado efeito={efeito} />
      <div className="space-y-6">
        <InstallPWA className="mb-2" />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Fundo animado:</span>
          {EFEITO_OPCOES.map((op) => {
            const ativo = efeito === op.value;
            return (
              <button
                key={op.value}
                type="button"
                onClick={() => escolherEfeito(op.value)}
                disabled={salvando}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent",
                  salvando && "opacity-60",
                )}
              >
                {op.label}
              </button>
            );
          })}
        </div>



      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base" />
        </CardHeader>
        <CardContent>
          {perfilQ.isLoading || !perfil ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <Link
              to="/perfil/$userId"
              params={{ userId: perfil.user_id }}
              className="flex items-start gap-4 rounded-lg p-2 -m-2 transition-colors hover:bg-accent"
            >
              <Avatar className="h-16 w-16">
                {perfil.foto_url ? (
                  <AvatarImage src={perfil.foto_url} alt={perfil.nome} className="object-cover" />
                ) : null}
                <AvatarFallback className="text-lg">
                  {perfil.nome?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{perfil.nome}</p>
                {perfil.cargo && (
                  <p className="truncate text-xs text-muted-foreground">{perfil.cargo}</p>
                )}
                {perfil.minhaComum ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Building className="h-3 w-3" />
                    <span className="truncate">
                      {perfil.minhaComum.nome}
                      {perfil.minhaComum.cidade
                        ? ` — ${perfil.minhaComum.cidade}${perfil.minhaComum.uf ? "/" + perfil.minhaComum.uf : ""}`
                        : ""}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você ainda não definiu sua comum.{" "}
                    <Link to="/conta" className="text-primary hover:underline">
                      Definir
                    </Link>
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span>
                    <strong>{perfil.seguidores}</strong>{" "}
                    <span className="text-muted-foreground">
                      {perfil.seguidores === 1 ? "seguidor" : "seguidores"}
                    </span>
                  </span>
                  <span>
                    <strong>{perfil.seguindo}</strong>{" "}
                    <span className="text-muted-foreground">seguindo</span>
                  </span>
                  {perfil.totalCongregacoes != null && (
                    <span className="text-muted-foreground">
                      {perfil.totalCongregacoes} {perfil.totalCongregacoes === 1 ? "comum visitada" : "comuns visitadas"}
                    </span>
                  )}
                  {!perfil.publico && (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Lock className="h-3 w-3" /> Privado
                    </Badge>
                  )}
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
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

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/feed"
          className="group flex items-center gap-4 rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-accent"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Newspaper className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Feed da comunidade</p>
            <p className="text-xs text-muted-foreground">
              Veja e compartilhe publicações dos irmãos.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          to="/minhas-congregacoes"
          className="group flex items-center gap-4 rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-accent"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Minhas congregações</p>
            <p className="text-xs text-muted-foreground">
              Suas visitas, check-ins e histórico.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Mini-feed estilo Instagram */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Últimas do feed
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
    </>
  );
}
