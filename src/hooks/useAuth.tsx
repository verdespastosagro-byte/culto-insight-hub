import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "encarregado" | "cooperador" | "usuario";
export type OrgRole = "owner" | "admin" | "editor" | "viewer";
export type OrgPlan = "free" | "pro" | "church";
export type OrgPlanStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";

interface Profile {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  congregacao: string | null;
  onboarding_completed?: boolean;
}

interface Organization {
  id: string;
  name: string;
  plan: OrgPlan;
  plan_status: OrgPlanStatus;
  trial_ends_at: string;
  cidade: string | null;
  estado: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  organization: Organization | null;
  organizationId: string | null;
  orgRole: OrgRole | null;
  plan: OrgPlan;
  planStatus: OrgPlanStatus;
  trialDaysLeft: number;
  isOwner: boolean;
  canManageOrg: boolean;
  loading: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshOrg: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgRole, setOrgRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadAll(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
        setOrganization(null);
        setOrgRole(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadAll(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadAll(uid: string) {
    const [{ data: p }, { data: r }, { data: m }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase
        .from("organization_members")
        .select("role, organization:organizations(id, name, plan, plan_status, trial_ends_at, cidade, estado)")
        .eq("user_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    setProfile(p as Profile | null);
    setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
    if (m?.organization) {
      setOrganization(m.organization as unknown as Organization);
      setOrgRole(m.role as OrgRole);
    } else {
      setOrganization(null);
      setOrgRole(null);
    }
  }

  async function refreshOrg() {
    if (user) await loadAll(user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const isAdmin = roles.includes("admin");
  const canEdit = isAdmin || roles.includes("encarregado") || roles.includes("cooperador");
  const isOwner = orgRole === "owner";
  const canManageOrg = orgRole === "owner" || orgRole === "admin";
  const plan: OrgPlan = organization?.plan ?? "free";
  const planStatus: OrgPlanStatus = organization?.plan_status ?? "trialing";
  const trialDaysLeft = organization?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(organization.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <Ctx.Provider value={{
      user, session, profile, roles, loading, canEdit, isAdmin, signOut,
      organization, organizationId: organization?.id ?? null, orgRole,
      plan, planStatus, trialDaysLeft, isOwner, canManageOrg, refreshOrg,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
