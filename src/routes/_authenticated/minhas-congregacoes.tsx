import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search, Loader2, MapPin, CheckCircle2, CalendarIcon, Plus, ChevronDown, ChevronRight, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { buscarCongregacoesCcbTexto, type CongregacaoCcbResult } from "@/lib/ccb.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/minhas-congregacoes")({
  component: MinhasCongregacoesPage,
});

type Visitada = {
  congregacao_ccb_id: number;
  congregacao_nome: string | null;
  congregacao_cidade: string | null;
  congregacao_uf: string | null;
  total_visitas: number;
  primeira_visita: string;
  ultima_visita: string;
};

type CheckIn = {
  id: string;
  congregacao_ccb_id: number;
  data_culto: string;
  observacao: string | null;
  created_at: string;
};

function MinhasCongregacoesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const buscar = useServerFn(buscarCongregacoesCcbTexto);

  // ----- Busca de comuns -----
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<CongregacaoCcbResult[]>([]);
  const [buscando, setBuscando] = useState(false);

  async function fazerBusca(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBuscando(true);
    try {
      const { items } = await buscar({ data: { q: q.trim() } });
      setResultados(items);
      if (!items.length) toast.info("Nenhuma congregação encontrada.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao buscar.");
    } finally {
      setBuscando(false);
    }
  }

  // ----- Minhas visitadas (view) -----
  const visitadasQ = useQuery({
    queryKey: ["minhas-congregacoes-visitadas", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Visitada[]> => {
      const { data, error } = await supabase
        .from("v_minhas_congregacoes_visitadas")
        .select("*")
        .order("ultima_visita", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Visitada[];
    },
  });

  // ----- Todos os check-ins do usuário (datas detalhadas) -----
  const checkInsQ = useQuery({
    queryKey: ["meus-check-ins", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<CheckIn[]> => {
      const { data, error } = await supabase
        .from("check_ins")
        .select("id,congregacao_ccb_id,data_culto,observacao,created_at")
        .eq("user_id", user!.id)
        .order("data_culto", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CheckIn[];
    },
  });

  const checkInsPorComum = useMemo(() => {
    const m = new Map<number, CheckIn[]>();
    for (const c of checkInsQ.data ?? []) {
      const arr = m.get(c.congregacao_ccb_id) ?? [];
      arr.push(c);
      m.set(c.congregacao_ccb_id, arr);
    }
    return m;
  }, [checkInsQ.data]);

  // ----- Dialog de check-in -----
  const [alvo, setAlvo] = useState<CongregacaoCcbResult | null>(null);
  const [data, setData] = useState<Date | undefined>(new Date());
  const [obs, setObs] = useState("");
  const [aproximada, setAproximada] = useState(false);

  function abrirCheckIn(c: CongregacaoCcbResult) {
    setAlvo(c);
    setData(new Date());
    setObs("");
    setAproximada(false);
  }

  const criar = useMutation({
    mutationFn: async () => {
      if (!alvo || !data || !user) throw new Error("Dados incompletos");
      const obsFinal = aproximada
        ? `[Data aproximada] ${obs}`.trim()
        : obs.trim() || null;
      const { error } = await supabase.from("check_ins").insert({
        user_id: user.id,
        congregacao_ccb_id: alvo.id,
        data_culto: format(data, "yyyy-MM-dd"),
        observacao: obsFinal && obsFinal !== "" ? obsFinal : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Check-in registrado!");
      setAlvo(null);
      qc.invalidateQueries({ queryKey: ["minhas-congregacoes-visitadas"] });
      qc.invalidateQueries({ queryKey: ["meus-check-ins"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao registrar";
      if (msg.includes("check_ins_unique")) {
        toast.error("Você já registrou check-in nesta comum nessa data.");
      } else {
        toast.error(msg);
      }
    },
  });

  // ----- Expandir comum na lista -----
  const [expandida, setExpandida] = useState<number | null>(null);

  const totalComuns = visitadasQ.data?.length ?? 0;
  const totalVisitas = (visitadasQ.data ?? []).reduce((acc, v) => acc + Number(v.total_visitas), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minhas congregações</h1>
        <p className="text-sm text-muted-foreground">
          Registre as comuns onde você congregou e construa seu histórico.
        </p>
      </div>

      {/* Resumo */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Você já congregou em</p>
            <p className="text-3xl font-bold text-primary">
              {totalComuns} {totalComuns === 1 ? "congregação" : "congregações"} diferentes
            </p>
            <p className="text-xs text-muted-foreground">
              {totalVisitas} {totalVisitas === 1 ? "visita registrada" : "visitas registradas"} no total
            </p>
          </div>
          <Building2 className="h-12 w-12 text-primary/40" />
        </div>
      </Card>

      {/* Buscar nova comum */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Marcar presença em uma comum</h2>
        <form onSubmit={fazerBusca} className="flex gap-2">
          <Input
            placeholder="Buscar por nome, cidade, bairro ou endereço..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={buscando || q.trim().length < 2}>
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {resultados.length > 0 && (
          <ul className="mt-3 space-y-2">
            {resultados.map((c) => {
              const jaVisitou = checkInsPorComum.has(c.id);
              return (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 rounded-md border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{c.name || "Congregação"}</p>
                      {jaVisitou && (
                        <Badge variant="secondary" className="text-[10px]">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> já visitada
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      <MapPin className="mr-1 inline h-3 w-3" />
                      {[c.address, c.bairro, [c.cidade, c.uf].filter(Boolean).join("/")]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => abrirCheckIn(c)}>
                    <Plus className="mr-1 h-3 w-3" /> Congreguei aqui
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Minhas congregações */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Histórico</h2>
        {visitadasQ.isLoading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Carregando…
          </Card>
        ) : !visitadasQ.data?.length ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Você ainda não registrou nenhuma congregação. Use a busca acima.
          </Card>
        ) : (
          <ul className="space-y-2">
            {visitadasQ.data.map((v) => {
              const aberta = expandida === v.congregacao_ccb_id;
              const datas = checkInsPorComum.get(v.congregacao_ccb_id) ?? [];
              return (
                <li key={v.congregacao_ccb_id}>
                  <Card className="overflow-hidden p-0">
                    <button
                      type="button"
                      onClick={() => setExpandida(aberta ? null : v.congregacao_ccb_id)}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {v.congregacao_nome || "Congregação"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[v.congregacao_cidade, v.congregacao_uf].filter(Boolean).join("/")}
                          {" • "}
                          Você congregou aqui{" "}
                          <strong className="text-foreground">
                            {v.total_visitas} {Number(v.total_visitas) === 1 ? "vez" : "vezes"}
                          </strong>
                        </p>
                      </div>
                      {aberta ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {aberta && (
                      <div className="border-t bg-muted/20 px-4 py-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Datas
                        </p>
                        <ul className="space-y-1.5">
                          {datas.map((d) => (
                            <li key={d.id} className="text-xs">
                              <span className="font-medium">
                                {format(new Date(d.data_culto + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", {
                                  locale: ptBR,
                                })}
                              </span>
                              {d.observacao && (
                                <span className="text-muted-foreground"> — {d.observacao}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dialog: novo check-in */}
      <Dialog open={!!alvo} onOpenChange={(o) => !o && setAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar presença</DialogTitle>
            <DialogDescription>
              {alvo?.name} — {[alvo?.cidade, alvo?.uf].filter(Boolean).join("/")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Data do culto</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "mt-1 w-full justify-start text-left font-normal",
                      !data && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {data ? format(data, "PPP", { locale: ptBR }) : "Escolher data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data}
                    onSelect={setData}
                    initialFocus
                    locale={ptBR}
                    disabled={(d) => d > new Date() || d < new Date("2000-01-01")}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="aproximada"
                checked={aproximada}
                onCheckedChange={(c) => setAproximada(c === true)}
              />
              <div className="leading-tight">
                <Label htmlFor="aproximada" className="cursor-pointer text-sm">
                  Não lembro a data exata
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  A data escolhida será salva como aproximada (marcada nas observações).
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="obs">Observação (opcional)</Label>
              <Textarea
                id="obs"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Algo marcante daquele culto…"
                rows={3}
                maxLength={500}
                className="mt-1"
              />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">{obs.length}/500</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAlvo(null)} disabled={criar.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => criar.mutate()} disabled={!data || criar.isPending}>
              {criar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
