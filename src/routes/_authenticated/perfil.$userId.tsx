import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  ArrowLeft,
  Lock,
  MapPin,
  Users,
  UserPlus,
  UserCheck,
  Building2,
  Image as ImageIcon,
  MessageCircle,
  Navigation,
  ChevronDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPerfilPublico, toggleSeguir, type MinhaComum } from "@/lib/social.functions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil/$userId")({
  component: PerfilPublicoPage,
});


function PerfilPublicoPage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchPerfil = useServerFn(getPerfilPublico);
  const fetchSeguir = useServerFn(toggleSeguir);

  const key = ["perfil-publico", userId];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await fetchPerfil({ data: { userId } })).perfil,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });


  const mSeguir = useMutation({
    mutationFn: async (seguir: boolean) => fetchSeguir({ data: { userId, seguir } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const perfil = q.data;
  if (!perfil) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink />
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Perfil não encontrado.
        </Card>
      </div>
    );
  }

  const ehProprio = perfil.user_id === user?.id;
  const podeVerConteudo = ehProprio || perfil.publico;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink />

      {/* Cabeçalho */}
      <Card className="p-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20">
            {perfil.foto_url ? <AvatarImage src={perfil.foto_url} alt={perfil.nome} /> : null}
            <AvatarFallback className="text-xl">
              {perfil.nome?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{perfil.nome}</h1>
            {perfil.cargo && (
              <p className="text-sm text-muted-foreground">{perfil.cargo}</p>
            )}
            {podeVerConteudo && perfil.totalCongregacoes != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Já congregou em{" "}
                <span className="font-semibold text-foreground">
                  {perfil.totalCongregacoes}
                </span>{" "}
                {perfil.totalCongregacoes === 1 ? "comum" : "comuns"} diferente
                {perfil.totalCongregacoes === 1 ? "" : "s"}.
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
              {!perfil.publico && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Lock className="h-3 w-3" /> Perfil privado
                </Badge>
              )}
            </div>
          </div>
          {!ehProprio && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => mSeguir.mutate(!perfil.euSigo)}
                disabled={mSeguir.isPending}
                variant={perfil.euSigo ? "outline" : "default"}
                size="sm"
                className="gap-2"
              >
                {mSeguir.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : perfil.euSigo ? (
                  <UserCheck className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {perfil.euSigo ? "Seguindo" : "Seguir"}
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link to="/mensagens/$userId" params={{ userId: perfil.user_id }}>
                  <MessageCircle className="h-4 w-4" /> Mensagem
                </Link>
              </Button>
            </div>
          )}
        </div>
      </Card>

      {!podeVerConteudo ? (
        <Card className="p-6 text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Este perfil é privado.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Só o próprio dono pode ver as congregações visitadas e os posts.
          </p>
        </Card>
      ) : (
        <>
          {/* Congregações visitadas */}
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4" /> Congregações visitadas
              {perfil.congregacoes.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {perfil.congregacoes.length}
                </Badge>
              )}
            </h2>
            {perfil.congregacoes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ainda não há registros de check-in.
              </p>
            ) : (
              <ul className="space-y-2">
                {perfil.congregacoes.map((c) => (
                  <li key={c.congregacao_ccb_id}>
                    <Link
                      to="/comum/$congregacaoCcbId"
                      params={{ congregacaoCcbId: String(c.congregacao_ccb_id) }}
                      className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.nome}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {c.cidade ?? "—"}
                          {c.uf ? `/${c.uf}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="text-[10px]">
                          {c.qtd_visitas}{" "}
                          {c.qtd_visitas === 1 ? "visita" : "visitas"}
                        </Badge>
                        {c.ultima_visita && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            última{" "}
                            {format(
                              new Date(c.ultima_visita + "T12:00:00"),
                              "dd/MM/yyyy",
                              { locale: ptBR },
                            )}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Feed de posts */}
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" /> Posts recentes
              {perfil.posts.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {perfil.posts.length}
                </Badge>
              )}
            </h2>
            {perfil.posts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {ehProprio
                  ? "Você ainda não publicou nada."
                  : "Esta pessoa ainda não publicou nada."}
              </p>
            ) : (
              <ul className="space-y-3">
                {perfil.posts.map((p) => (
                  <li key={p.id} className="rounded-md border bg-card p-3">
                    <p className="mb-2 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(p.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                    {p.texto && (
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {p.texto}
                      </p>
                    )}
                    {p.foto_url && (
                      <div className="mt-2 overflow-hidden rounded-md border">
                        <img
                          src={p.foto_url}
                          alt="Foto do post"
                          className="h-auto w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    {p.audio_url && (
                      <audio
                        src={p.audio_url}
                        controls
                        preload="metadata"
                        className="mt-2 h-9 w-full"
                      />
                    )}
                    {!p.texto && !p.foto_url && !p.audio_url && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ImageIcon className="h-3 w-3" /> Post sem conteúdo
                      </p>
                    )}

                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/dashboard"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
    >
      <ArrowLeft className="h-4 w-4" /> Voltar
    </Link>
  );
}
