import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ImagePlus, Send, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  listarFeed,
  criarPost,
  excluirPost,
  type FeedPostItem,
} from "@/lib/social.functions";
import { ComentariosSection } from "@/components/ComentariosMural";
import { toast } from "sonner";

const MAX_LEN = 2000;
const MAX_FOTO_MB = 5;

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

function inicial(nome?: string | null) {
  return nome?.trim()?.[0]?.toUpperCase() ?? "?";
}

function FeedPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const fetchFeed = useServerFn(listarFeed);
  const fetchCriar = useServerFn(criarPost);
  const fetchExcluir = useServerFn(excluirPost);

  const key = ["feed"];

  const q = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      fetchFeed({ data: { cursor: pageParam, limite: 15 } }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
  });


  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    if (!f) {
      setFoto(null);
      setPreview(null);
      return;
    }
    if (f.size > MAX_FOTO_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande (máx ${MAX_FOTO_MB}MB).`);
      return;
    }
    setFoto(f);
    setPreview(URL.createObjectURL(f));
  }

  async function publicar() {
    if (!user) return;
    const t = texto.trim();
    if (!t && !foto) {
      toast.error("Escreva algo ou anexe uma foto.");
      return;
    }
    setEnviando(true);
    try {
      let fotoPath: string | null = null;
      if (foto) {
        const ext = (foto.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("posts-fotos")
          .upload(path, foto, { contentType: foto.type || "image/jpeg", upsert: false });
        if (error) throw new Error(error.message);
        fotoPath = path;
      }
      await fetchCriar({ data: { texto: t, foto_path: fotoPath } });
      setTexto("");
      pickFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await qc.invalidateQueries({ queryKey: key });
      toast.success("Publicado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar");
    } finally {
      setEnviando(false);
    }
  }

  const mExcluir = useMutation({
    mutationFn: async (id: string) => fetchExcluir({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Post excluído");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  const posts: FeedPostItem[] = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Composer */}
      <Card className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback>{inicial(profile?.nome)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Textarea
              placeholder="No que você está pensando?"
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, MAX_LEN))}
              maxLength={MAX_LEN}
              rows={3}
              className="resize-none"
            />
            {preview && (
              <div className="relative mt-3 inline-block">
                <img src={preview} alt="" className="max-h-64 rounded-lg border" />
                <button
                  type="button"
                  onClick={() => { pickFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow"
                  aria-label="Remover foto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={enviando}
                >
                  <ImagePlus className="mr-2 h-4 w-4" /> Foto
                </Button>
                <span className="text-xs text-muted-foreground">{texto.length}/{MAX_LEN}</span>
              </div>
              <Button onClick={publicar} disabled={enviando || (!texto.trim() && !foto)} size="sm">
                {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Publicar
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Lista */}
      {q.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nada por aqui ainda. Seja o primeiro a publicar.
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onExcluir={() => mExcluir.mutate(p.id)}
              excluindo={mExcluir.isPending && mExcluir.variables === p.id}
            />
          ))}
          {q.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => q.fetchNextPage()}
                disabled={q.isFetchingNextPage}
              >
                {q.isFetchingNextPage ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</>
                ) : (
                  "Carregar mais"
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  onExcluir,
  excluindo,
}: {
  post: FeedPostItem;
  onExcluir: () => void;
  excluindo: boolean;
}) {
  const [confirmar, setConfirmar] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Link to="/perfil/$userId" params={{ userId: post.user_id }} className="shrink-0">
          <Avatar className="h-10 w-10">
            {post.autor_foto_url ? <AvatarImage src={post.autor_foto_url} alt={post.autor_nome} /> : null}
            <AvatarFallback>{inicial(post.autor_nome)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <Link
                to="/perfil/$userId"
                params={{ userId: post.user_id }}
                className="block truncate text-sm font-semibold hover:underline"
              >
                {post.autor_nome}
              </Link>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
            {post.is_own && (
              confirmar ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmar(false)} disabled={excluindo}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={onExcluir} disabled={excluindo}>
                    {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
                  </Button>
                </div>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmar(true)}
                  aria-label="Excluir post"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )
            )}
          </div>

          {post.texto && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{post.texto}</p>
          )}
          {post.foto_url && (
            <img
              src={post.foto_url}
              alt=""
              className="mt-3 max-h-[480px] w-full rounded-lg border object-cover"
            />
          )}

          <div className="mt-4 border-t pt-3">
            <ComentariosSection alvoTipo="post" alvoId={post.id} titulo="Comentários" />
          </div>
        </div>
      </div>
    </Card>
  );
}
