import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Users, ArrowLeft, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getComumDetalhe, listarVisitantesRecentesComum } from "@/lib/social.functions";
import { ComentariosMural } from "@/components/ComentariosMural";
import { QuemEsteveAquiCarousel } from "@/components/QuemEsteveAquiCarousel";


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
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
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

      {/* Visitantes recentes — carrossel estilo Netflix */}
      {visQ.isLoading ? (
        <Card className="p-4">
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          <QuemEsteveAquiCarousel
            visitantes={visQ.data?.publicos ?? []}
            invalidateKey={["comum-visitantes", idNum]}
          />
          {visQ.data && visQ.data.totalPrivados > 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              +{visQ.data.totalPrivados}{" "}
              {visQ.data.totalPrivados === 1 ? "pessoa" : "pessoas"} com perfil privado também{" "}
              {visQ.data.totalPrivados === 1 ? "esteve" : "estiveram"} aqui.
            </p>
          )}
        </div>
      )}


      {/* Mural fixo da congregação */}
      <ComentariosMural
        tipo_alvo="congregacao_ccb"
        alvo_id={String(c.id)}
        titulo="Mural da congregação"
      />
    </div>
  );
}
