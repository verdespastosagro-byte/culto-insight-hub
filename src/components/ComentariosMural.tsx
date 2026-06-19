import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Send, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { listarComentarios, criarComentario, excluirComentario } from "@/lib/social.functions";
import { toast } from "sonner";
import { primeirosDoisNomes } from "@/lib/utils";


const MAX_LEN = 1000;

function inicial(nome: string) {
  return nome?.trim()?.[0]?.toUpperCase() ?? "?";
}

export type ComentariosSectionProps = {
  alvoTipo: "check_in" | "congregacao_ccb" | "post" | "culto";
  alvoId: string;
  titulo?: string;
};

export function ComentariosSection({ alvoTipo, alvoId, titulo = "Comentários" }: ComentariosSectionProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listar = useServerFn(listarComentarios);
  const criar = useServerFn(criarComentario);
  const excluir = useServerFn(excluirComentario);

  const key = ["comentarios", alvoTipo, alvoId];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await listar({ data: { tipo_alvo: alvoTipo, alvo_id: alvoId } })).items,
  });

  const [texto, setTexto] = useState("");

  // Realtime: invalida o cache quando há mudança no alvo
  useEffect(() => {
    const channel = supabase
      .channel(`comentarios:${alvoTipo}:${alvoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comentarios",
          filter: `alvo_id=eq.${alvoId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { tipo_alvo?: string } | undefined;
          if (row?.tipo_alvo && row.tipo_alvo !== alvoTipo) return;
          qc.invalidateQueries({ queryKey: key });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvoTipo, alvoId]);

  const enviar = useMutation({
    mutationFn: async () => {
      const t = texto.trim();
      if (!t) return;
      await criar({ data: { tipo_alvo: alvoTipo, alvo_id: alvoId, texto: t } });
    },
    onSuccess: () => {
      setTexto("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao comentar"),
  });

  const apagar = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  const restantes = MAX_LEN - texto.length;
  const proximo = restantes <= 100;

  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" /> {titulo}
        {q.data && <span className="text-xs text-muted-foreground">({q.data.length})</span>}
      </h2>

      <div className="mb-4 space-y-1">
        <div className="flex gap-2">
          <Textarea
            placeholder="Escreva um comentário..."
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, MAX_LEN))}
            maxLength={MAX_LEN}
            className="min-h-[60px] flex-1"
          />
          <Button
            onClick={() => enviar.mutate()}
            disabled={enviar.isPending || !texto.trim()}
            size="icon"
            className="h-auto"
            aria-label="Enviar comentário"
          >
            {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p
          className={`text-right text-[10px] ${
            proximo ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {texto.length}/{MAX_LEN}
        </p>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !q.data?.length ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Seja o primeiro a comentar aqui.
        </p>
      ) : (
        <ul className="space-y-3">
          {q.data.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Link
                to="/perfil/$userId"
                params={{ userId: c.user_id }}
                className="shrink-0"
                aria-label={`Ver perfil de ${c.autor_nome}`}
              >
                <Avatar className="h-8 w-8">
                  {c.autor_foto_url ? <AvatarImage src={c.autor_foto_url} alt={c.autor_nome} /> : null}
                  <AvatarFallback className="text-xs">{inicial(c.autor_nome)}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="min-w-0 flex-1 rounded-md bg-muted/50 p-2">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <Link
                    to="/perfil/$userId"
                    params={{ userId: c.user_id }}
                    className="truncate text-xs font-medium hover:underline"
                  >
                    {c.autor_nome}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    {user?.id === c.user_id && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Excluir este comentário?")) apagar.mutate(c.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{c.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Compatibilidade com o nome usado na Fase 4
export function ComentariosMural(props: {
  tipo_alvo: "check_in" | "congregacao_ccb" | "post" | "culto";
  alvo_id: string;
  titulo?: string;
}) {
  return <ComentariosSection alvoTipo={props.tipo_alvo} alvoId={props.alvo_id} titulo={props.titulo} />;
}
