import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ImagePlus, Send, Trash2, X, Mic, Square } from "lucide-react";
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
import { primeirosDoisNomes } from "@/lib/utils";


const MAX_LEN = 2000;
const MAX_FOTO_MB = 5;
const MAX_AUDIO_MB = 10;
const MAX_AUDIO_SEG = 180; // 3 minutos

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

function inicial(nome?: string | null) {
  return nome?.trim()?.[0]?.toUpperCase() ?? "?";
}

function fmtDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function pickMime(): { mime: string; ext: string } {
  const candidates: Array<{ mime: string; ext: string }> = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  if (typeof MediaRecorder !== "undefined") {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    }
  }
  return { mime: "audio/webm", ext: "webm" };
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

  // ----- Áudio -----
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioExt, setAudioExt] = useState<string>("webm");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [dur, setDur] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const inicioRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      pararStream();
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pararStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

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

  function limparAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setDur(0);
  }

  async function iniciarGravacao() {
    if (gravando) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Seu navegador não permite gravar áudio.");
      return;
    }
    if (audioUrl) limparAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const { mime, ext } = pickMime();
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        pararStream();
        setGravando(false);
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (blob.size === 0) {
          toast.error("Áudio vazio.");
          return;
        }
        if (blob.size > MAX_AUDIO_MB * 1024 * 1024) {
          toast.error(`Áudio muito grande (máx ${MAX_AUDIO_MB}MB).`);
          return;
        }
        setAudioBlob(blob);
        setAudioExt(ext);
        setAudioUrl(URL.createObjectURL(blob));
      };
      recRef.current = rec;
      inicioRef.current = Date.now();
      setDur(0);
      rec.start();
      setGravando(true);
      timerRef.current = window.setInterval(() => {
        const d = Math.floor((Date.now() - inicioRef.current) / 1000);
        setDur(d);
        if (d >= MAX_AUDIO_SEG) {
          pararGravacao();
        }
      }, 250);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Permissão de microfone negada.");
      pararStream();
    }
  }

  function pararGravacao() {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else {
      pararStream();
      setGravando(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  async function publicar() {
    if (!user) return;
    const t = texto.trim();
    if (!t && !foto && !audioBlob) {
      toast.error("Escreva algo, anexe uma foto ou grave um áudio.");
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

      let audioPath: string | null = null;
      if (audioBlob) {
        const path = `${user.id}/${crypto.randomUUID()}.${audioExt}`;
        const { error } = await supabase.storage
          .from("posts-audios")
          .upload(path, audioBlob, { contentType: audioBlob.type || "audio/webm", upsert: false });
        if (error) throw new Error(error.message);
        audioPath = path;
      }

      await fetchCriar({ data: { texto: t, foto_path: fotoPath, audio_path: audioPath } });
      setTexto("");
      pickFile(null);
      limparAudio();
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

  const podePublicar = !enviando && !gravando && (!!texto.trim() || !!foto || !!audioBlob);

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
              placeholder="No que você está pensando? Compartilhe um testemunho ou peça oração."
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

            {/* Preview / estado de gravação de áudio */}
            {gravando && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
                </span>
                <span className="text-sm font-medium">Gravando... {fmtDur(dur)}</span>
                <span className="text-[10px] text-muted-foreground">máx {fmtDur(MAX_AUDIO_SEG)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="ml-auto gap-1"
                  onClick={pararGravacao}
                >
                  <Square className="h-3 w-3" /> Parar
                </Button>
              </div>
            )}

            {audioUrl && !gravando && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                <audio src={audioUrl} controls className="h-9 w-full" />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={limparAudio}
                  aria-label="Remover áudio"
                  disabled={enviando}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
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
                  disabled={enviando || gravando}
                >
                  <ImagePlus className="mr-2 h-4 w-4" /> Foto
                </Button>

                {gravando ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={pararGravacao}
                  >
                    <Square className="mr-2 h-4 w-4" /> Parar áudio
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={iniciarGravacao}
                    disabled={enviando || !!audioBlob}
                    title={audioBlob ? "Remova o áudio atual para gravar outro" : "Gravar áudio (testemunho ou pedido de oração)"}
                  >
                    <Mic className="mr-2 h-4 w-4" /> Áudio
                  </Button>
                )}

                <span className="text-xs text-muted-foreground">{texto.length}/{MAX_LEN}</span>
              </div>
              <Button onClick={publicar} disabled={!podePublicar} size="sm">
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
                {primeirosDoisNomes(post.autor_nome)}
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
          {post.audio_url && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <Mic className="h-4 w-4 shrink-0 text-primary" />
              <audio src={post.audio_url} controls preload="metadata" className="h-9 w-full" />
            </div>
          )}

          <div className="mt-4 border-t pt-3">
            <ComentariosSection alvoTipo="post" alvoId={post.id} titulo="Comentários" />
          </div>
        </div>
      </div>
    </Card>
  );
}
