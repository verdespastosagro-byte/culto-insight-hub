import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, MapPin, Users, ArrowLeft, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getComumDetalhe, listarVisitantesRecentesComum } from "@/lib/social.functions";
import { ComentariosMural } from "@/components/ComentariosMural";

export const Route = createFileRoute("/_authenticated/comum/$congregacaoCcbId")({
  component: ComumDetalhePage,
});

function ComumDetalhePage() {
  const { congregacaoCcbId } = Route.useParams();
  const idNum = Number(congregacaoCcbId);

  const detalhe = useServerFn(getComumDetalhe);
  const visitantes = useServerFn(listarVisitantesRecentesComum);

  const detalheQ = useQuery({
    queryKey: ["comum", idNum],
    queryFn: async () => (await detalhe({ data: { id: idNum } })).comum,
  });

  const visQ = useQuery({
    queryKey: ["comum-visitantes", idNum],
    queryFn: async () => visitantes({ data: { id: idNum, limite: 30 } }),
  });

  if (detalheQ.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detalheQ.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/minhas-congregacoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Congregação não encontrada.
        </Card>
      </div>
    );
  }

  const c = detalheQ.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/minhas-congregacoes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Minhas congregações
      </Link>

      {/* Cabeçalho */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Building2 className="h-10 w-10 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight">{c.name}</h1>
            <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {c.address}
                {c.bairro ? `, ${c.bairro}` : ""}
                {c.cidade ? ` — ${c.cidade}` : ""}
                {c.uf ? `/${c.uf}` : ""}
              </span>
            </p>
            <div className="mt-3">
              <Badge variant="secondary" className="text-xs">
                <Users className="mr-1 h-3 w-3" />
                {c.totalVisitas} {c.totalVisitas === 1 ? "visita registrada" : "visitas registradas"} desde o início
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Visitantes recentes */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Quem esteve aqui</h2>
        {visQ.isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {visQ.data?.publicos.length ? (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {visQ.data.publicos.map((v) => (
                  <li key={v.user_id} className="flex items-center gap-2 rounded-md border bg-card p-2">
                    <Avatar className="h-8 w-8">
                      {v.foto_url ? <AvatarImage src={v.foto_url} alt={v.nome} /> : null}
                      <AvatarFallback className="text-xs">
                        {v.nome?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{v.nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(v.data_culto + "T12:00:00"), "dd/MM/yy", { locale: ptBR })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ninguém com perfil público registrou check-in aqui ainda.
              </p>
            )}
            {visQ.data && visQ.data.totalPrivados > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                +{visQ.data.totalPrivados}{" "}
                {visQ.data.totalPrivados === 1 ? "pessoa" : "pessoas"} com perfil privado também{" "}
                {visQ.data.totalPrivados === 1 ? "esteve" : "estiveram"} aqui.
              </p>
            )}
          </>
        )}
      </Card>

      {/* Mural fixo da congregação */}
      <ComentariosMural
        tipo_alvo="congregacao_ccb"
        alvo_id={String(c.id)}
        titulo="Mural da congregação"
      />
    </div>
  );
}
