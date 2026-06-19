import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Search, Pencil, Ban, CheckCircle2, Trash2, ShieldAlert, Eye, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  adminListUsers, adminUpdateUser, adminSetBan, adminDeleteUser, adminSetPlan,
  adminSetRole, adminGetUserDetails,
} from "@/lib/admin.functions";
import { AdminPlansEditor } from "@/components/admin/AdminPlansEditor";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — Culto Insight Hub" }] }),
  component: AdminPage,
});

type AdminUser = Awaited<ReturnType<typeof adminListUsers>>[number];
type AppRole = "admin" | "encarregado" | "cooperador" | "usuario";

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin (acesso total)",
  encarregado: "Encarregado",
  cooperador: "Cooperador",
  usuario: "Usuário",
};

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [viewing, setViewing] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const list = useServerFn(adminListUsers);
  const update = useServerFn(adminUpdateUser);
  const ban = useServerFn(adminSetBan);
  const del = useServerFn(adminDeleteUser);
  const setPlan = useServerFn(adminSetPlan);
  const setRole = useServerFn(adminSetRole);
  const getDetails = useServerFn(adminGetUserDetails);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => list(),
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    if (!s) return data;
    return data.filter((u) =>
      (u.email ?? "").toLowerCase().includes(s) ||
      (u.profile?.nome ?? "").toLowerCase().includes(s) ||
      (u.organization?.name ?? "").toLowerCase().includes(s)
    );
  }, [data, q]);

  const mUpdate = useMutation({
    mutationFn: (v: { userId: string; nome?: string; email?: string }) => update({ data: v }),
    onSuccess: () => { toast.success("Usuário atualizado"); qc.invalidateQueries({ queryKey: ["admin-users"] }); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const mPlan = useMutation({
    mutationFn: (v: { orgId: string; plan: any; plan_status: any }) => setPlan({ data: v }),
    onSuccess: () => { toast.success("Plano atualizado"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const mRole = useMutation({
    mutationFn: (v: { userId: string; role: AppRole }) => setRole({ data: v }),
    onSuccess: () => { toast.success("Permissão atualizada"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const mBan = useMutation({
    mutationFn: (v: { userId: string; ban: boolean }) => ban({ data: v }),
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const mDel = useMutation({
    mutationFn: (v: { userId: string }) => del({ data: v }),
    onSuccess: () => { toast.success("Usuário excluído"); qc.invalidateQueries({ queryKey: ["admin-users"] }); setDeleting(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const detailsQuery = useQuery({
    queryKey: ["admin-user-details", viewing?.id],
    queryFn: () => getDetails({ data: { userId: viewing!.id } }),
    enabled: !!viewing,
  });

  if (loading || !isAdmin) {
    return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Administração</h2>
          <p className="text-sm text-muted-foreground">Gerencie todos os usuários da plataforma.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Usuários ({filtered.length})</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, e-mail, congregação..." className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2">
              {filtered.map((u) => {
                const isMe = u.id === user?.id;
                const isBanned = !!u.banned_until && new Date(u.banned_until) > new Date();
                return (
                  <div key={u.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{u.profile?.nome ?? "Sem nome"}</p>
                        {isMe && <Badge variant="secondary" className="text-[10px]">Você</Badge>}
                        {u.roles.includes("admin") && <Badge className="bg-primary/15 text-primary text-[10px]">Admin</Badge>}
                        {isBanned && <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      {u.organization && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {u.organization.name} · plano <strong className="uppercase">{u.organization.plan}</strong> ({u.organization.plan_status})
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={(u.roles[0] as AppRole) ?? "usuario"}
                        onValueChange={(v) => mRole.mutate({ userId: u.id, role: v as AppRole })}
                        disabled={isMe}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {u.organization && (
                        <Select
                          value={u.organization.plan}
                          onValueChange={(v) =>
                            mPlan.mutate({
                              orgId: u.organization!.id,
                              plan: v,
                              plan_status: v === "free" ? "active" : "active",
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="church">Church</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setViewing(u)} title="Ver detalhes">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(u)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isMe || mBan.isPending}
                        onClick={() => mBan.mutate({ userId: u.id, ban: !isBanned })}
                        title={isBanned ? "Desbloquear" : "Bloquear"}
                      >
                        {isBanned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={isMe}
                        onClick={() => setDeleting(u)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                  </div>
                );
              })}
              {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <AdminPlansEditor />



      {/* Editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Atualize o nome e e-mail.</DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                mUpdate.mutate({
                  userId: editing.id,
                  nome: String(fd.get("nome") ?? ""),
                  email: String(fd.get("email") ?? ""),
                });
              }}
            >
              <div className="space-y-1"><Label>Nome</Label><Input name="nome" defaultValue={editing.profile?.nome ?? ""} /></div>
              <div className="space-y-1"><Label>E-mail</Label><Input name="email" type="email" defaultValue={editing.email ?? ""} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button type="submit" disabled={mUpdate.isPending}>
                  {mUpdate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai apagar permanentemente <strong>{deleting?.email}</strong> e todos os dados associados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && mDel.mutate({ userId: deleting.id })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ver detalhes */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do usuário</DialogTitle>
            <DialogDescription>{viewing?.email}</DialogDescription>
          </DialogHeader>
          {detailsQuery.isLoading ? (
            <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : detailsQuery.data ? (
            <div className="space-y-3 text-sm">
              <Section title="Perfil">
                <Row k="Nome" v={detailsQuery.data.profile?.nome} />
                <Row k="Cargo" v={detailsQuery.data.profile?.cargo} />
                <Row k="Congregação" v={detailsQuery.data.profile?.congregacao} />
              </Section>
              <Section title="Conta">
                <Row k="E-mail" v={detailsQuery.data.auth?.email} />
                <Row k="Telefone" v={detailsQuery.data.auth?.phone} />
                <Row k="Provedor" v={detailsQuery.data.auth?.provider} />
                <Row k="Criada em" v={fmtDate(detailsQuery.data.auth?.created_at)} />
                <Row k="Último login" v={fmtDate(detailsQuery.data.auth?.last_sign_in_at)} />
                <Row k="Confirmada" v={fmtDate(detailsQuery.data.auth?.confirmed_at)} />
              </Section>
              <Section title="Permissões">
                <Row k="Roles" v={detailsQuery.data.roles.join(", ") || "—"} />
              </Section>
              {detailsQuery.data.member?.organization && (
                <Section title="Organização">
                  <Row k="Nome" v={detailsQuery.data.member.organization.name} />
                  <Row k="Papel" v={detailsQuery.data.member.role} />
                  <Row k="Plano" v={`${detailsQuery.data.member.organization.plan} (${detailsQuery.data.member.organization.plan_status})`} />
                  <Row k="Trial até" v={fmtDate(detailsQuery.data.member.organization.trial_ends_at)} />
                  <Row k="Cidade" v={detailsQuery.data.member.organization.cidade} />
                  <Row k="Estado" v={detailsQuery.data.member.organization.estado} />
                </Section>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v || "—"}</span>
    </div>
  );
}

function fmtDate(s?: string | null) {
  if (!s) return "";
  try { return new Date(s).toLocaleString("pt-BR"); } catch { return s; }
}

