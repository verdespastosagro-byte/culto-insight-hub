O prompt cobre ~10 grandes blocos e mexe em praticamente toda a base. Fazer tudo de uma vez em um turno só vira um Frankenstein quebrado. Proponho 4 fases entregáveis, nesta ordem. Cada fase termina com o app funcionando e testável.

## Fase 1 — Fundação multi-tenant + planos (esta entrega)

Sem isso, nada do resto faz sentido (cobrar sem isolar dados = vazamento + processo). É também onde está o problema de segurança que já levantamos.

**Banco (1 migração):**
- `organizations` (id, name, slug, plan enum free|pro|church, plan_status enum trialing|active|past_due|cancelled|expired, trial_ends_at, stripe_customer_id, stripe_subscription_id, created_at, updated_at).
- `organization_members` (id, organization_id, user_id, role enum owner|admin|editor|viewer, invited_by, created_at), unique (org_id, user_id).
- `organization_invites` (id, organization_id, email, role, token, expires_at, accepted_at, invited_by).
- Coluna `organization_id uuid` em: `cultos, congregacoes, hinos, palavras, atendimentos, visitantes, musicos, agenda, escalas, cultos_inteligentes`. Backfill: cria 1 org "Migração" e atribui registros existentes + membros existentes a ela (preserva dados atuais).
- Coluna `onboarding_completed boolean default false` em `profiles`.
- Function `public.get_user_org_id(_user_id uuid) returns uuid` SECURITY DEFINER stable.
- Function `public.is_org_member(_org_id uuid, _user_id uuid) returns boolean` e `public.has_org_role(_org_id, _user_id, _role)` SECURITY DEFINER.
- Trigger em `auth.users` (extensão do `handle_new_user` existente): cria org com nome "<nome> (Congregação)", insere o usuário como `owner`, marca `plan='free'`, `plan_status='trialing'`, `trial_ends_at = now()+14 days`.
- **Reescrita completa das policies** de todas as tabelas listadas: SELECT/INSERT/UPDATE/DELETE filtram por `organization_id = get_user_org_id(auth.uid())`. Mantém distinção viewer/editor/admin via `has_org_role`. Resolve as duas findings de segurança abertas (profiles + tabelas operacionais).
- Policy de `profiles`: usuário vê o próprio + membros da mesma org (sem email para não-admins via view `public.profiles_public`).

**Server functions:**
- `getCurrentOrganization()` — devolve org + role + plan + trialDaysLeft.
- `updateOrganization({name, cidade, estado, timezone})` (owner/admin).
- `inviteMember({email, role})` (owner/admin) — cria invite token.
- `acceptInvite({token})`.
- `removeMember({userId})` (owner/admin).
- `listMembers()`.

**Frontend:**
- `useAuth` ganha `organization, organizationId, plan, planStatus, trialDaysLeft, isOwner, canManageOrg`.
- Hook `usePlanLimits()` com `canAddCongregacao, canAddCulto, canUseIA, canUseCultoInteligente, cultoInteligenteUsedThisMonth` consultando contagens via server fn.
- `<PlanGate feature="ia"|"culto-inteligente"|"relatorio-avancado">` que renderiza paywall ou children.
- `<UpgradeModal>` reutilizável.
- Badge do plano + dias de trial na sidebar; banner global "trial termina em X dias" quando `trialDaysLeft <= 7`.
- Aplicar gates em: Insights IA (PRO+), Culto Inteligente (PRO+ com contador mensal), Relatórios PDF/Excel (PRO+).

## Fase 2 — Onboarding, configurações, sidebar, telas de auth (próxima entrega)

- Onboarding wizard 3 passos (`/onboarding`) com redirect automático quando `onboarding_completed=false`.
- `/configuracoes` com abas Minha conta · Organização · Membros · Plano (esta última ainda sem Stripe — placeholder "em breve" até a Fase 4).
- Reset de senha decente: rota `/esqueci-senha` + tela `/reset-password` funcional.
- Sidebar agrupada (Gestão / Registros / Inteligência / Administração).
- 404 amigável.

## Fase 3 — Landing comercial + páginas legais

- Reescrita de `src/routes/index.tsx`: hero, prova social, funcionalidades (6 cards), destaque Culto Inteligente, pricing (3 cards), FAQ, footer.
- `/pricing` reutilizando o bloco de planos.
- `/termos` e `/privacidade` (conteúdo genérico LGPD/SaaS BR).
- Checkbox de aceite no `/auth` cadastro.
- Meta tags comerciais por rota; favicon conferido.

## Fase 4 — Cobrança Stripe

Requer plano **Pro** da Lovable e ativação dos Pagamentos pela Lovable (Stripe seamless). Eu rodo o check de elegibilidade, ativo o Stripe, crio os produtos (Pro R$47/mês, Church R$127/mês), implemento `/account` com portal, webhook que sincroniza `organizations.plan` e `plan_status`, banner de trial expirado, downgrade automático para Free quando assinatura cai.

Pode-se rodar a Fase 4 antes da 2/3 se a prioridade for cobrar — mas o normal é deixar para o fim para não cobrar de um produto ainda inacabado.

## Polish (transversal, aplicado ao longo das fases)

- Empty states com ícone+CTA nas listas que tocarmos.
- Skeletons substituindo `null` no carregamento.
- Tradução de erros comuns do Supabase em um helper `traduzErro()`.

## Decisão necessária

Confirmo que vou **começar pela Fase 1 agora** (migração + reescrita de RLS + planos/gates + trigger de signup). É a entrega mais pesada e arriscada porque mexe nas policies de todas as tabelas. As Fases 2–4 seguem em entregas separadas, conforme você for aprovando.

Posso seguir?