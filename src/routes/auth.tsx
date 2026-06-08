import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Cultos CCB" }] }),
  component: AuthPage,
});

const emailSchema = z.string().email("E-mail inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo de 6 caracteres").max(72);
const nameSchema = z.string().min(2, "Informe seu nome").max(120);

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    try {
      emailSchema.parse(email); passwordSchema.parse(password);
    } catch (err: any) { toast.error(err.errors?.[0]?.message ?? "Dados inválidos"); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bem-vindo!");
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") ?? "");
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    try { nameSchema.parse(nome); emailSchema.parse(email); passwordSchema.parse(password); }
    catch (err: any) { toast.error(err.errors?.[0]?.message ?? "Dados inválidos"); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nome }, emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada! Você já pode entrar.");
  }

  async function handleReset() {
    const email = prompt("Informe seu e-mail para redefinição de senha:");
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("E-mail de redefinição enviado.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--gradient-soft)] px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Cultos CCB</span>
        </Link>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>Acesse o sistema</CardTitle>
            <CardDescription>Entre com sua conta ou cadastre-se.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label htmlFor="email">E-mail</Label>
                    <Input id="email" name="email" type="email" autoComplete="email" required /></div>
                  <div className="space-y-2"><Label htmlFor="password">Senha</Label>
                    <Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Entrar
                  </Button>
                  <button type="button" onClick={handleReset} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground">
                    Esqueci minha senha
                  </button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label htmlFor="nome">Nome completo</Label>
                    <Input id="nome" name="nome" required /></div>
                  <div className="space-y-2"><Label htmlFor="email2">E-mail</Label>
                    <Input id="email2" name="email" type="email" autoComplete="email" required /></div>
                  <div className="space-y-2"><Label htmlFor="password2">Senha</Label>
                    <Input id="password2" name="password" type="password" autoComplete="new-password" required minLength={6} /></div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
