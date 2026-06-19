import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  User,
  Lock,
  Building2,
  Crown,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Camera,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePlanLimits, PLAN_LABELS } from "@/hooks/usePlanLimits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listarCidadesCcb, listarComunsPorCidade, definirMinhaComum } from "@/lib/social.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/conta")({
  component: ContaPage,
});

type Status = { type: "ok" | "err"; msg: string } | null;

function ContaPage() {
  const { user, profile, organization, orgRole, plan, planStatus, trialDaysLeft, refreshOrg } = useAuth();
  const { isTrialing, isExpired } = usePlanLimits();
  const queryClient = useQueryClient();

  const [nome, setNome] = useState(profile?.nome ?? "");
  const [cargo, setCargo] = useState(profile?.cargo ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<Status>(null);

  // ====== Minha comum (CCB) ======
  const fetchCidades = useServerFn(listarCidadesCcb);
  const fetchComuns = useServerFn(listarComunsPorCidade);
  const fetchDefinirComum = useServerFn(definirMinhaComum);
  const comumIdAtual = ((profile as { congregacao_ccb_id?: number | null } | null)?.congregacao_ccb_id) ?? null;
  const [comumSelecionada, setComumSelecionada] = useState<number | null>(comumIdAtual);
  const [cidadeBusca, setCidadeBusca] = useState("");
  const [cidadeAtual, setCidadeAtual] = useState<string | null>(null);
  const [ufAtual, setUfAtual] = useState<string | null>(null);
  const [savingComum, setSavingComum] = useState(false);
  const [comumStatus, setComumStatus] = useState<Status>(null);

  useEffect(() => {
    setComumSelecionada(((profile as { congregacao_ccb_id?: number | null } | null)?.congregacao_ccb_id) ?? null);
  }, [profile]);

  // Carrega cidade/uf atuais a partir da comum salva, na primeira renderização
  useEffect(() => {
    if (!comumIdAtual || cidadeAtual) return;
    (async () => {
      const { data } = await supabase
        .from("congregacoes_ccb")
        .select("city,uf")
        .eq("id", comumIdAtual)
        .maybeSingle();
      if (data) {
        setCidadeAtual(data.city ?? null);
        setUfAtual((data.uf ?? "").toUpperCase() || null);
        setCidadeBusca(data.city ?? "");
      }
    })();
  }, [comumIdAtual, cidadeAtual]);

  const cidadesQ = useQuery({
    queryKey: ["ccb-cidades", cidadeBusca],
    enabled: cidadeBusca.trim().length >= 2,
    queryFn: async () => (await fetchCidades({ data: { q: cidadeBusca.trim() } })).cidades,
    staleTime: 60_000,
  });

  const comunsQ = useQuery({
    queryKey: ["ccb-comuns", cidadeAtual, ufAtual],
    enabled: !!cidadeAtual && !!ufAtual,
    queryFn: async () =>
      (await fetchComuns({ data: { cidade: cidadeAtual!, uf: ufAtual! } })).comuns,
    staleTime: 60_000,
  });

  async function handleSalvarComum() {
    setSavingComum(true);
    setComumStatus(null);
    try {
      const r = await fetchDefinirComum({ data: { congregacao_ccb_id: comumSelecionada } });
      setComumStatus({
        type: "ok",
        msg: r.nome ? `Sua comum foi definida: ${r.nome}.` : "Sua comum foi removida do perfil.",
      });
      await refreshOrg();
    } catch (e) {
      setComumStatus({ type: "err", msg: e instanceof Error ? e.message : "Erro ao salvar" });
    } finally {
      setSavingComum(false);
    }
  }



  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);

  // ====== Foto de perfil ======
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoStatus, setFotoStatus] = useState<Status>(null);
  const [fotoPath, setFotoPath] = useState<string | null>((profile as any)?.foto_url ?? null);

  useEffect(() => {
    setFotoPath((profile as any)?.foto_url ?? null);
  }, [profile]);

  const { data: fotoUrl } = useQuery({
    queryKey: ["perfil-foto", fotoPath],
    enabled: !!fotoPath,
    queryFn: async () => {
      if (!fotoPath) return null;
      const { data } = await supabase.storage
        .from("perfil-fotos")
        .createSignedUrl(fotoPath, 60 * 60);
      return data?.signedUrl ?? null;
    },
    staleTime: 50 * 60 * 1000,
  });

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      setFotoStatus({ type: "err", msg: "Selecione uma imagem (jpg, png, webp)." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFotoStatus({ type: "err", msg: "A imagem deve ter no máximo 5 MB." });
      return;
    }
    setUploadingFoto(true);
    setFotoStatus(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("perfil-fotos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploadingFoto(false);
      setFotoStatus({ type: "err", msg: `Foto não enviada: ${upErr.message}` });
      return;
    }
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ foto_url: path } as any)
      .eq("id", user.id);
    setUploadingFoto(false);
    if (updErr) {
      setFotoStatus({ type: "err", msg: updErr.message });
      return;
    }
    setFotoPath(path);
    setFotoStatus({ type: "ok", msg: "Foto de perfil atualizada." });
    await refreshOrg();
  }

  // ====== Privacidade ======
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyStatus, setPrivacyStatus] = useState<Status>(null);
  const { data: privacy, refetch: refetchPrivacy } = useQuery({
    queryKey: ["profile-privacy", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profile_privacy")
        .select("user_id, perfil_publico")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? { user_id: user.id, perfil_publico: false };
    },
  });
  const perfilPublico = privacy?.perfil_publico ?? false;

  async function handleTogglePrivacy(value: boolean) {
    if (!user) return;
    setSavingPrivacy(true);
    setPrivacyStatus(null);
    const { error } = await supabase
      .from("profile_privacy")
      .upsert({ user_id: user.id, perfil_publico: value }, { onConflict: "user_id" });
    setSavingPrivacy(false);
    if (error) {
      setPrivacyStatus({ type: "err", msg: error.message });
    } else {
      setPrivacyStatus({
        type: "ok",
        msg: value ? "Seu perfil agora é público." : "Seu perfil agora é fechado.",
      });
      await refetchPrivacy();
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileStatus(null);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim(), cargo: cargo.trim() || null })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) {
      setProfileStatus({ type: "err", msg: error.message });
    } else {
      setProfileStatus({ type: "ok", msg: "Perfil atualizado com sucesso." });
      await refreshOrg();
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordStatus(null);
    if (newPassword.length < 8) {
      setPasswordStatus({ type: "err", msg: "A senha precisa ter pelo menos 8 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "err", msg: "As senhas não coincidem." });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordStatus({ type: "err", msg: error.message });
    } else {
      setPasswordStatus({ type: "ok", msg: "Senha alterada com sucesso." });
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  const planLabel = isTrialing ? "Trial" : PLAN_LABELS[plan];
  const planTone =
    isExpired ? "text-destructive"
    : isTrialing ? "text-amber-600 dark:text-amber-400"
    : plan === "free" ? "text-muted-foreground"
    : "text-primary";

  const orgRoleLabel: Record<string, string> = {
    owner: "Proprietário",
    admin: "Administrador",
    editor: "Editor",
    viewer: "Visualizador",
  };

  const iniciais = (nome || profile?.nome || user?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Minha conta</h2>
        <p className="text-sm text-muted-foreground">Gerencie seus dados pessoais, senha e plano.</p>
      </div>

      {/* Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Dados pessoais
          </CardTitle>
          <CardDescription>Atualize seu nome, foto e função na congregação.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Foto */}
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border bg-muted">
                {fotoUrl ? (
                  <img src={fotoUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                    {iniciais}
                  </div>
                )}
                {uploadingFoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFotoChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingFoto}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {fotoPath ? "Trocar foto" : "Enviar foto"}
                </Button>
                <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP, até 5 MB.</p>
              </div>
            </div>
            <StatusLine status={fotoStatus} />

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{user?.email ?? "—"}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo">Cargo</Label>
                <Input
                  id="cargo"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex.: Ancião, Cooperador, Diácono"
                  maxLength={120}
                />
              </div>
            </div>
            <StatusLine status={profileStatus} />
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Minha Comum (CCB) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Minha Comum
          </CardTitle>
          <CardDescription>
            Selecione a cidade e depois a comum (congregação CCB) à qual você pertence. Ela aparecerá no seu perfil público.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cidade-busca">Cidade</Label>
              <Input
                id="cidade-busca"
                value={cidadeBusca}
                onChange={(e) => {
                  setCidadeBusca(e.target.value);
                }}
                placeholder="Digite ao menos 2 letras"
                maxLength={120}
              />
              {cidadesQ.data && cidadesQ.data.length > 0 && (
                <Select
                  value={cidadeAtual && ufAtual ? `${cidadeAtual}__${ufAtual}` : ""}
                  onValueChange={(v) => {
                    const [c, u] = v.split("__");
                    setCidadeAtual(c);
                    setUfAtual(u);
                    setComumSelecionada(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {cidadesQ.data.map((c) => (
                      <SelectItem key={`${c.cidade}__${c.uf}`} value={`${c.cidade}__${c.uf}`}>
                        {c.cidade} / {c.uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {cidadesQ.isLoading && (
                <p className="text-xs text-muted-foreground">Buscando cidades…</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comum-select">Comum</Label>
              <Select
                value={comumSelecionada ? String(comumSelecionada) : ""}
                onValueChange={(v) => setComumSelecionada(v ? Number(v) : null)}
                disabled={!cidadeAtual || !ufAtual || comunsQ.isLoading}
              >
                <SelectTrigger id="comum-select">
                  <SelectValue
                    placeholder={
                      !cidadeAtual
                        ? "Escolha a cidade primeiro"
                        : comunsQ.isLoading
                          ? "Carregando comuns…"
                          : "Selecione a comum"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(comunsQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                      {c.bairro ? ` — ${c.bairro}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {comunsQ.data && comunsQ.data.length === 0 && cidadeAtual && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma comum encontrada nessa cidade.
                </p>
              )}
            </div>
          </div>

          <StatusLine status={comumStatus} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {comumSelecionada
                ? "Confirme para salvar."
                : "Você ainda não definiu uma comum."}
            </div>
            <div className="flex gap-2">
              {comumIdAtual && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={savingComum}
                  onClick={async () => {
                    setComumSelecionada(null);
                    setSavingComum(true);
                    try {
                      await fetchDefinirComum({ data: { congregacao_ccb_id: null } });
                      setComumStatus({ type: "ok", msg: "Comum removida do perfil." });
                      await refreshOrg();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Erro");
                    } finally {
                      setSavingComum(false);
                    }
                  }}
                >
                  Remover
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={savingComum || !comumSelecionada || comumSelecionada === comumIdAtual}
                onClick={handleSalvarComum}
              >
                {savingComum && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar comum
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Privacidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {perfilPublico ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Privacidade do perfil
          </CardTitle>
          <CardDescription>
            Você decide se outros irmãos podem ver suas visitas a outras comuns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {perfilPublico ? "Perfil público" : "Perfil fechado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {perfilPublico
                  ? "Outras pessoas autenticadas no app podem ver em quais congregações você fez check-in, quantas comuns diferentes você já visitou, e podem comentar nos seus check-ins."
                  : "Ninguém vê seus check-ins, suas congregações visitadas nem pode comentar nos seus check-ins. Você continua vendo tudo normalmente."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savingPrivacy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={perfilPublico}
                disabled={savingPrivacy || !user}
                onCheckedChange={handleTogglePrivacy}
                aria-label="Alternar perfil público"
              />
            </div>
          </div>
          <StatusLine status={privacyStatus} />
        </CardContent>
      </Card>

      {/* Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" /> Senha
          </CardTitle>
          <CardDescription>Use uma senha forte e única para esta conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <StatusLine status={passwordStatus} />
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" disabled={savingPassword || !newPassword}>
                {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Atualizar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Organização & Plano */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Organização
            </CardTitle>
            <CardDescription>Sua congregação no Culto Insight Hub.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Nome" value={organization?.name ?? "—"} />
            <Row
              label="Localização"
              value={
                organization?.cidade || organization?.estado
                  ? [organization?.cidade, organization?.estado].filter(Boolean).join(" / ")
                  : "—"
              }
            />
            <Row label="Seu papel" value={orgRole ? orgRoleLabel[orgRole] ?? orgRole : "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4" /> Plano
            </CardTitle>
            <CardDescription>Status da sua assinatura.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Plano atual" value={<span className={cn("font-semibold", planTone)}>{planLabel}</span>} />
            <Row label="Status" value={planStatus} />
            {isTrialing && (
              <Row
                label="Trial"
                value={
                  <span className="text-amber-600 dark:text-amber-400">
                    {trialDaysLeft} {trialDaysLeft === 1 ? "dia restante" : "dias restantes"}
                  </span>
                }
              />
            )}
            <Separator />
            <Button asChild className="w-full" variant={plan === "free" || isExpired ? "default" : "outline"}>
              <Link to="/pricing">{plan === "free" || isExpired ? "Ver planos" : "Gerenciar plano"}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  const Icon = status.type === "ok" ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        status.type === "ok"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{status.msg}</span>
    </div>
  );
}
