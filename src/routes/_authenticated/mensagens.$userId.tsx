import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptConversation,
  declineConversation,
  getConversationWith,
  listMessages,
  markRead,
  sendMessage,
  type Message,
} from "@/lib/messages";

export const Route = createFileRoute("/_authenticated/mensagens/$userId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const meId = user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const otherQ = useQuery({
    queryKey: ["profile-mini", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, foto_url")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60_000,
  });

  const convQ = useQuery({
    queryKey: ["conversation-with", meId, userId],
    queryFn: () => getConversationWith(meId!, userId),
    enabled: !!meId,
  });

  const conv = convQ.data;
  const convId = conv?.id;

  const msgsQ = useQuery({
    queryKey: ["messages", convId],
    queryFn: () => listMessages(convId!),
    enabled: !!convId,
  });

  // realtime + read marker
  useEffect(() => {
    if (!convId) return;
    markRead(convId).then(() => qc.invalidateQueries({ queryKey: ["conversations", meId] }));
    const ch = supabase
      .channel(`conv-${convId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          qc.setQueryData<Message[]>(["messages", convId], (prev) => {
            const m = payload.new as Message;
            if (prev?.some((x) => x.id === m.id)) return prev;
            return [...(prev ?? []), m];
          });
          markRead(convId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [convId, meId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgsQ.data?.length]);

  const isPending = conv?.status === "pending";
  const iAmRequester = conv?.requested_by === meId;
  const awaitingMyAnswer = isPending && !iAmRequester;
  const awaitingTheirAnswer = isPending && iAmRequester;

  const mSend = useMutation({
    mutationFn: () => sendMessage(userId, draft.trim()),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["conversation-with", meId, userId] });
      qc.invalidateQueries({ queryKey: ["messages", convId] });
      qc.invalidateQueries({ queryKey: ["conversations", meId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao enviar"),
  });

  const mAccept = useMutation({
    mutationFn: () => acceptConversation(convId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation-with", meId, userId] });
      qc.invalidateQueries({ queryKey: ["conversations", meId] });
    },
  });

  const mDecline = useMutation({
    mutationFn: () => declineConversation(convId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", meId] });
      navigate({ to: "/mensagens" });
    },
  });

  const other = otherQ.data;
  const canType = !awaitingTheirAnswer || (msgsQ.data?.length ?? 0) === 0;

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="md:hidden"
        >
          <Link to="/mensagens"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Link
          to="/perfil/$userId"
          params={{ userId }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <Avatar className="h-9 w-9 shrink-0">
            {other?.foto_url ? <AvatarImage src={other.foto_url} /> : null}
            <AvatarFallback>{other?.nome?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{other?.nome ?? "Usuário"}</p>
            {isPending && (
              <p className="text-[10px] text-muted-foreground">
                {iAmRequester ? "Solicitação enviada — aguardando resposta" : "Solicitação de mensagem"}
              </p>
            )}
          </div>
        </Link>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {msgsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (msgsQ.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {iAmRequester
              ? "Envie a primeira mensagem. Ela aparecerá como solicitação até a pessoa aceitar."
              : "Sem mensagens ainda."}
          </p>
        ) : (
          (msgsQ.data ?? []).map((m) => (
            <Bubble key={m.id} m={m} mine={m.sender_id === meId} />
          ))
        )}
      </div>

      {awaitingMyAnswer && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-3 text-sm">
          <span>Essa pessoa quer te enviar uma mensagem.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => mDecline.mutate()} disabled={mDecline.isPending}>
              <X className="mr-1 h-4 w-4" /> Recusar
            </Button>
            <Button size="sm" onClick={() => mAccept.mutate()} disabled={mAccept.isPending}>
              <Check className="mr-1 h-4 w-4" /> Aceitar
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim() || mSend.isPending) return;
          if (!canType) {
            toast.info("Aguarde a pessoa aceitar sua solicitação.");
            return;
          }
          mSend.mutate();
        }}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
          placeholder={
            awaitingMyAnswer
              ? "Aceite a solicitação para responder…"
              : awaitingTheirAnswer && (msgsQ.data?.length ?? 0) > 0
              ? "Aguardando aceitação…"
              : "Escreva uma mensagem…"
          }
          rows={1}
          disabled={awaitingMyAnswer || (awaitingTheirAnswer && (msgsQ.data?.length ?? 0) > 0)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
            }
          }}
          className="min-h-[42px] resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim() || mSend.isPending || awaitingMyAnswer}
        >
          {mSend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </Card>
  );
}

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  const time = useMemo(
    () => new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [m.created_at],
  );
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          mine
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <p className={cn("mt-1 text-[10px] opacity-70", mine ? "text-right" : "text-left")}>{time}</p>
      </div>
    </div>
  );
}
