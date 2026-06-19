import { useState } from "react";
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
import { listarComentarios, criarComentario, excluirComentario } from "@/lib/social.functions";
import { toast } from "sonner";

function inicial(nome: string) {
  return nome?.trim()?.[0]?.toUpperCase() ?? "?";
}

export function ComentariosMural({
  tipo_alvo,
  alvo_id,
  titulo = "Comentários",
}: {
  tipo_alvo: "check_in" | "congregacao_ccb";
  alvo_id: string;
  titulo?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listar = useServerFn(listarComentarios);
  const criar = useServerFn(criarComentario);
  const excluir = useServerFn(excluirComentario);

  const key = ["comentarios", tipo_alvo, alvo_id];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await listar({ data: { tipo_alvo, alvo_id } })).items,
  });

  const [texto, setTexto] = useState("");

  const enviar = useMutation({
    mutationFn: async () => {
      const t = texto.trim();
      if (!t) return;
      await criar({ data: { tipo_alvo, alvo_id, texto: t } });
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

  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" /> {titulo}
        {q.data && <span className="text-xs text-muted-foreground">({q.data.length})</span>}
      </h2>

      <div className="mb-4 flex gap-2">
        <Textarea
          placeholder="Escreva um comentário..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={1000}
          className="min-h-[60px] flex-1"
        />
        <Button
          onClick={() => enviar.mutate()}
          disabled={enviar.isPending || !texto.trim()}
          size="icon"
          className="h-auto"
        >
          {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !q.data?.length ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Seja o primeiro a comentar.
        </p>
      ) : (
        <ul className="space-y-3">
          {q.data.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                {c.autor_foto_url ? <AvatarImage src={c.autor_foto_url} alt={c.autor_nome} /> : null}
                <AvatarFallback className="text-xs">{inicial(c.autor_nome)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 rounded-md bg-muted/50 p-2">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium">{c.autor_nome}</p>
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
