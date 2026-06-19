
# Plano: Mensagens diretas (DM) com solicitações

## Comportamento

- **Seguidores mútuos** (ambos se seguem): conversa aberta, mensagens vão direto para a caixa de entrada do destinatário.
- **Não-mútuos**: a primeira mensagem entra como **solicitação** e fica em uma aba "Solicitações". O destinatário pode **aceitar** (vira conversa normal) ou **recusar** (remove).
- Cada conversa exibe histórico, status de leitura simples (`read_at`), e nova mensagem em tempo real (Realtime).

## Schema (migração)

**`conversations`** — uma linha por par de usuários (canônico `user_a < user_b`):
- `user_a uuid`, `user_b uuid` (ordenados), `last_message_at timestamptz`
- `status text check in ('pending','accepted')` — `pending` = solicitação; vira `accepted` quando aceito ou quando ambos se seguem
- `requested_by uuid` — quem mandou a primeira mensagem (para o outro decidir)
- `accepted_at timestamptz null`
- UNIQUE (user_a, user_b)

**`messages`**:
- `id uuid pk`, `conversation_id uuid fk`, `sender_id uuid`, `body text` (1..2000 chars), `created_at`, `read_at timestamptz null`

**Função `public.is_mutual_follow(a uuid, b uuid)`** SECURITY DEFINER — retorna `true` se ambos se seguem.

**RLS:**
- `conversations`: SELECT/UPDATE permitido se `auth.uid() in (user_a, user_b)`. INSERT via RPC.
- `messages`: SELECT se participante da conversa. INSERT se participante E (`conversations.status='accepted'` OU é a primeira mensagem da conversa pendente OU `is_mutual_follow`).

**RPC `send_direct_message(to_user uuid, body text)`** (SECURITY DEFINER):
1. Valida `body` (1..2000), `to_user != auth.uid()`.
2. `get_or_create_conversation(auth.uid(), to_user)` — cria com `status='accepted'` se mútuo, senão `pending` com `requested_by=auth.uid()`.
3. Bloqueia se já existe pendente e quem está enviando **não** é o `requested_by` original (precisa aceitar antes).
4. Insere mensagem, atualiza `last_message_at`.

**RPC `accept_conversation(conv_id uuid)`** e `decline_conversation(conv_id uuid)`.

**GRANTs:** SELECT/UPDATE em `conversations` e `messages` para `authenticated`; ALL para `service_role`. EXECUTE nas RPCs para `authenticated`.

## Frontend

- **Nova rota** `src/routes/_authenticated/mensagens.tsx` (lista de conversas + abas "Conversas" / "Solicitações") e `src/routes/_authenticated/mensagens.$userId.tsx` (thread com input).
- **Item no menu lateral** `AppShell.tsx` (grupo "Registros") com ícone `MessageCircle` e contador de não lidas/solicitações.
- **Botão "Enviar mensagem"** em `perfil.$userId.tsx`: vai para `/mensagens/{userId}` se mútuo, ou abre um modal "Enviar solicitação" se não.
- Realtime: subscription do Supabase em `messages` filtrando pela conversa aberta.
- Validação Zod (`body` máx. 2000) no client e RPC.

## Arquivos
- 1 migração (tabelas + RLS + RPCs + GRANTs + função `is_mutual_follow`).
- `src/lib/messages.ts` — wrappers de query/mutation.
- `src/routes/_authenticated/mensagens.tsx`, `mensagens.$userId.tsx` (novos).
- `src/components/AppShell.tsx` — item de menu.
- `src/routes/_authenticated/perfil.$userId.tsx` — botão de mensagem.

## Garantias
- Sem mudanças em outras tabelas.
- RLS estrita; só participantes leem/escrevem.
- Solicitação não permite spam: enquanto pendente, só o iniciador pode mandar (1) mensagem inicial; respostas só após aceitar.

## Próximo passo
Aprovar para eu rodar a migração e implementar o frontend.
