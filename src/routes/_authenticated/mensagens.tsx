import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Inbox, Mail, MessageCircle, Search, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { listConversations, searchFollowers, type Conversation } from "@/lib/messages";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/mensagens")({
  component: MensagensLayout,
});

function MensagensLayout() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const meId = user?.id;
  const matchRoute = useMatchRoute();
  const onDetail = matchRoute({ to: "/mensagens/$userId" });
  const [tab, setTab] = useState<"conversas" | "solicitacoes">("conversas");

  const q = useQuery({
    queryKey: ["conversations", meId],
    queryFn: () => listConversations(meId!),
    enabled: !!meId,
    staleTime: 15_000,
  });

  // realtime invalidate
  useEffect(() => {
    if (!meId) return;
    const ch = supabase
      .channel(`conv-list-${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations", meId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations", meId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [meId, qc]);

  const convs = q.data ?? [];
  const aceitas = convs.filter(
    (c) => c.status === "accepted" || c.requested_by === meId,
  );
  const solicitacoes = convs.filter(
    (c) => c.status === "pending" && c.requested_by !== meId,
  );

  const list = tab === "conversas" ? aceitas : solicitacoes;

  return (
    <div className="mx-auto grid h-[calc(100vh-8rem)] max-w-5xl grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
      <aside className={cn("flex flex-col", onDetail && "hidden md:flex")}>
        <div className="mb-3 flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <h1 className="text-lg font-bold tracking-tight">Mensagens</h1>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg glass p-1 text-xs font-medium">
          <button
            onClick={() => setTab("conversas")}
            className={cn(
              "rounded-md py-1.5 transition-colors",
              tab === "conversas" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Conversas
          </button>
          <button
            onClick={() => setTab("solicitacoes")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors",
              tab === "solicitacoes" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Solicitações
            {solicitacoes.length > 0 && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                {solicitacoes.length}
              </Badge>
            )}
          </button>
        </div>

        <Card className="min-h-0 flex-1 overflow-y-auto p-1">
          {q.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
          ) : list.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-40" />
              {tab === "conversas" ? "Nenhuma conversa ainda." : "Sem solicitações."}
            </div>
          ) : (
            <ul className="flex flex-col">
              {list.map((c) => (
                <ConversationRow key={c.id} c={c} />
              ))}
            </ul>
          )}
        </Card>
      </aside>

      <section className={cn("min-h-0", !onDetail && "hidden md:block")}>
        <Outlet />
        {!onDetail && (
          <Card className="flex h-full items-center justify-center p-10 text-center text-sm text-muted-foreground">
            <div>
              <Mail className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Selecione uma conversa.
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

function ConversationRow({ c }: { c: Conversation }) {
  return (
    <li>
      <Link
        to="/mensagens/$userId"
        params={{ userId: c.other.id }}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/60"
        activeProps={{ className: "bg-accent" }}
      >
        <Avatar className="h-10 w-10 shrink-0">
          {c.other.foto_url ? <AvatarImage src={c.other.foto_url} /> : null}
          <AvatarFallback>{c.other.nome?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{c.other.nome ?? "Usuário"}</p>
            {c.last_message && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(c.last_message.created_at), { addSuffix: false, locale: ptBR })}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {c.status === "pending" ? "Solicitação · " : ""}
            {c.last_message?.body ?? "—"}
          </p>
        </div>
        {c.unread > 0 && (
          <Badge className="h-5 px-1.5 text-[10px]">{c.unread}</Badge>
        )}
      </Link>
    </li>
  );
}
