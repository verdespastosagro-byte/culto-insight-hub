import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, UserPlus, UserCheck, Loader2, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toggleSeguir, type Visitante } from "@/lib/social.functions";
import { primeirosDoisNomes, cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  titulo?: string;
  visitantes: Visitante[];
  vazioMsg?: string;
  /** chave da query que lista esses visitantes, pra invalidar depois do follow */
  invalidateKey?: unknown[];
};

export function QuemEsteveAquiCarousel({
  titulo = "Quem esteve aqui",
  visitantes,
  vazioMsg = "Ninguém com perfil público registrou check-in aqui ainda.",
  invalidateKey,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" /> {titulo}
          {visitantes.length > 0 && (
            <span className="text-xs text-muted-foreground">({visitantes.length})</span>
          )}
        </h2>
        {visitantes.length > 3 && (
          <div className="hidden gap-1 sm:flex">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => scrollBy(-1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => scrollBy(1)} aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {visitantes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{vazioMsg}</p>
      ) : (
        <div
          ref={scrollerRef}
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:thin]"
        >
          {visitantes.map((v) => (
            <CartaoVisitante key={v.user_id} visitante={v} invalidateKey={invalidateKey} />
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoVisitante({
  visitante,
  invalidateKey,
}: {
  visitante: Visitante;
  invalidateKey?: unknown[];
}) {
  const qc = useQueryClient();
  const fetchSeguir = useServerFn(toggleSeguir);
  const [otimista, setOtimista] = useState<boolean | null>(null);

  const seguindo = otimista ?? !!visitante.euSigo;

  const m = useMutation({
    mutationFn: async (seguir: boolean) => fetchSeguir({ data: { userId: visitante.user_id, seguir } }),
    onMutate: (seguir) => setOtimista(seguir),
    onError: (e) => {
      setOtimista(null);
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    },
    onSuccess: () => {
      if (invalidateKey) qc.invalidateQueries({ queryKey: invalidateKey });
      qc.invalidateQueries({ queryKey: ["perfil-publico", visitante.user_id] });
    },
  });

  return (
    <div className="flex w-[136px] shrink-0 snap-start flex-col items-center gap-2 rounded-lg border bg-background/60 p-3 transition-shadow hover:shadow-md">
      <Link
        to="/perfil/$userId"
        params={{ userId: visitante.user_id }}
        className="block"
        aria-label={`Ver perfil de ${visitante.nome}`}
      >
        <Avatar className="h-20 w-20 rounded-full ring-2 ring-primary/20 transition-transform hover:scale-105">
          {visitante.foto_url ? (
            <AvatarImage
              src={visitante.foto_url}
              alt={visitante.nome}
              className="rounded-full object-cover"
            />
          ) : null}
          <AvatarFallback className="rounded-full text-lg">
            {visitante.nome?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
      </Link>
      <Link
        to="/perfil/$userId"
        params={{ userId: visitante.user_id }}
        className="line-clamp-2 max-w-full text-center text-xs font-medium leading-tight hover:underline"
        title={visitante.nome}
      >
        {primeirosDoisNomes(visitante.nome)}
      </Link>

      {visitante.ehProprio ? (
        <span className="text-[10px] text-muted-foreground">você</span>
      ) : (
        <Button
          size="sm"
          variant={seguindo ? "outline" : "default"}
          className={cn("h-7 w-full gap-1 px-2 text-[11px]")}
          onClick={() => m.mutate(!seguindo)}
          disabled={m.isPending}
        >
          {m.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : seguindo ? (
            <>
              <UserCheck className="h-3 w-3" /> Seguindo
            </>
          ) : (
            <>
              <UserPlus className="h-3 w-3" /> Seguir
            </>
          )}
        </Button>
      )}
    </div>
  );
}
