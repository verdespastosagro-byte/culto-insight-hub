import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: OnboardingPage,
});

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading, profile, organization, organizationId, refreshOrg } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: perfil
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");

  // Step 2: organização
  const [orgName, setOrgName] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome ?? "");
      setCargo(profile.cargo ?? "");
      if (profile.onboarding_completed) {
        navigate({ to: "/dashboard" });
      }
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name ?? "");
      setCidade(organization.cidade ?? "");
      setEstado(organization.estado ?? "");
    }
  }, [organization]);

  if (loading || !user || !profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const steps = ["Seu perfil", "Sua congregação", "Tudo pronto"];
  const progress = ((step + 1) / steps.length) * 100;

  async function handleNext() {
    if (step === 0) {
      if (!nome.trim()) {
        toast.error("Informe seu nome");
        return;
      }
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({ nome: nome.trim(), cargo: cargo.trim() || null })
        .eq("id", user!.id);
      setSaving(false);
      if (error) {
        toast.error("Não foi possível salvar seu perfil");
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (!orgName.trim()) {
        toast.error("Informe o nome da congregação");
        return;
      }
      if (!organizationId) {
        toast.error("Organização não encontrada. Tente recarregar a página.");
        return;
      }
      setSaving(true);
      const { error } = await supabase
        .from("organizations")
        .update({
          name: orgName.trim(),
          cidade: cidade.trim() || null,
          estado: estado || null,
        })
        .eq("id", organizationId);
      setSaving(false);
      if (error) {
        toast.error("Não foi possível salvar a congregação");
        return;
      }
      await refreshOrg();
      setStep(2);
    } else {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user!.id);
      setSaving(false);
      if (error) {
        toast.error("Não foi possível concluir o onboarding");
        return;
      }
      toast.success("Bem-vindo! Vamos começar.");
      navigate({ to: "/dashboard" });
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Vamos configurar sua conta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Passo {step + 1} de {steps.length} · {steps[step]}
          </p>
          <Progress value={progress} className="mt-4" />
        </div>

        <Card>
          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle>Seu perfil</CardTitle>
                <CardDescription>Como podemos te chamar?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: João da Silva"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo na congregação (opcional)</Label>
                  <Input
                    id="cargo"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Ex.: Encarregado, Cooperador, Músico"
                    maxLength={80}
                  />
                </div>
              </CardContent>
            </>
          )}

          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Sua congregação</CardTitle>
                <CardDescription>Esses dados aparecem nos relatórios e na sua área.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Nome da congregação *</Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Ex.: CCB Vila Mariana"
                    maxLength={120}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex.: São Paulo"
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">UF</Label>
                    <Select value={estado} onValueChange={setEstado}>
                      <SelectTrigger id="estado">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BR.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Tudo pronto!
                </CardTitle>
                <CardDescription>
                  Sua organização está em período de teste gratuito de 14 dias com acesso completo
                  às funcionalidades.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Item text="Registre cultos, hinos e palavras" />
                <Item text="Convide cooperadores e encarregados" />
                <Item text="Use o Culto Inteligente com IA" />
                <Item text="Gere relatórios e insights" />
              </CardContent>
            </>
          )}

          <div className="flex items-center justify-between gap-3 p-6 pt-0">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0 || saving}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button type="button" onClick={handleNext} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step === steps.length - 1 ? (
                <>
                  Entrar no painel
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Item({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-primary">
        <Check className="h-3 w-3" />
      </div>
      <span>{text}</span>
    </div>
  );
}
