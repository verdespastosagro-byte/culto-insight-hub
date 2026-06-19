import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ArrowLeft, MapPin, Calendar as CalendarIcon, Users, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getCheckInDetalhe } from "@/lib/social.functions";
import { ComentariosMural } from "@/components/ComentariosMural";

export const Route = createFileRoute("/_authenticated/check-in/$checkInId")({
  component: CheckInDetalhePage,
});

function CheckInDetalhePage() {
  const { checkInId } = Route.useParams();
  const fn = useServerFn(getCheckInDetalhe);

  const q = useQuery({
    queryKey: ["check-in-detalhe", checkInId],
    queryFn: async () => fn({ data: { id: checkInId } }),
  });

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!q.data?.podeVer || !q.data.checkIn) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          to="/minhas-congregacoes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Card className="p-6 text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Este check-in é de um perfil privado e não pode ser visto.
          </p>
        </Card>
      </div>
    );
  }

  const ci = q.data.checkIn;
  const dataFmt = format(new Date(ci.data_culto + "T12:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/minhas-congregacoes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Minhas congregações
      </Link>

      {/* Cabeçalho do check-in */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Link
            to="/perfil/$userId"
            params={{ userId: ci.user_id }}
            className="shrink-0"
            aria-label={`Ver perfil de ${ci.autor_nome}`}
          >
            <Avatar className="h-12 w-12">
              {ci.autor_foto_url ? <AvatarImage src={ci.autor_foto_url} alt={ci.autor_nome} /> : null}
              <AvatarFallback>{ci.autor_nome?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <Link
                to="/perfil/$userId"
                params={{ userId: ci.user_id }}
                className="font-semibold hover:underline"
              >
                {ci.autor_nome}
              </Link>{" "}
              esteve em
            </p>
            <Link
              to="/comum/$congregacaoCcbId"
              params={{ congregacaoCcbId: String(ci.congregacao_ccb_id) }}
              className="text-base font-bold hover:underline"
            >
              {ci.congregacao_nome}
            </Link>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {ci.congregacao_cidade}{ci.congregacao_uf ? `/${ci.congregacao_uf}` : ""}
            </p>
            <p className="mt-2 flex items-center gap-1 text-sm">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              <span className="capitalize">{dataFmt}</span>
            </p>
            {ci.observacao && (
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-sm">
                {ci.observacao}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Companheiros do culto */}
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" /> Quem mais esteve nesse culto
          {q.data.companheiros.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{q.data.companheiros.length}</Badge>
          )}
        </h2>
        {q.data.companheiros.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma outra pessoa com perfil público registrou presença neste culto.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {q.data.companheiros.map((v) => (
              <li key={v.user_id}>
                <Link
                  to="/perfil/$userId"
                  params={{ userId: v.user_id }}
                  className="flex items-center gap-2 rounded-md border bg-card p-2 transition-colors hover:bg-accent"
                >
                  <Avatar className="h-8 w-8">
                    {v.foto_url ? <AvatarImage src={v.foto_url} alt={v.nome} /> : null}
                    <AvatarFallback className="text-xs">
                      {v.nome?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <p className="truncate text-xs font-medium">{v.nome}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Comentários do check-in */}
      <ComentariosMural tipo_alvo="check_in" alvo_id={ci.id} titulo="Comentários deste culto" />
    </div>
  );
}
