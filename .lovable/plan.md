
# Plano de Refinamento Premium

## Análise do Estado Atual

**Stack visual já existente:**
- Design system "Liquid Titanium" em `src/styles.css` (paleta oklch titânio/grafite/iridescente, gradientes oil-paint, utilitários `glass`, `glass-strong`, `titanium-surface`, `liquid-metal`, `text-iridescent`, `text-titanium`).
- Tipografia `Inter Tight` carregada via `__root.tsx`.
- Tema claro + escuro completos, shadcn/ui configurado com tokens semânticos.
- Animações disponíveis via `tw-animate-css` + keyframes próprios (`iridescent-shift`, `liquid-float`, `shimmer-sweep`).

**Rotas-chave:** `index`, `auth`, `pricing`, `onboarding`, e área autenticada (`dashboard`, `feed`, `cultos`, `agenda`, `conta`, `perfil`, etc.) sob `AppShell`.

**Inconsistências / oportunidades observadas:**
1. Os utilitários `liquid-float` e `shimmer-sweep` existem mas quase não são usados — falta camada de microanimação cinematográfica.
2. Cards, botões e modais usam shadcn padrão sem aproveitar `glass` / `titanium-surface` de forma sistemática.
3. Não há transição de página (route transition) — navegação parece "seca".
4. Faltam easings padronizados e duração mínima (0.6s, power3.out equivalente em CSS = `cubic-bezier(0.16, 1, 0.3, 1)`).
5. Headings sem hierarquia tipográfica fluida (`clamp()`); densidade pode ser melhorada com mais whitespace.
6. Hover states discretos demais — sem profundidade/elevação cinematográfica.

## Plano de Melhorias (sem reescrita)

### 1. Camada de motion padronizada (`src/styles.css`)
- Adicionar tokens de easing: `--ease-cinematic: cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-soft: cubic-bezier(0.4, 0, 0.2, 1)`.
- Adicionar tokens de duração: `--dur-micro: 200ms`, `--dur-base: 600ms`, `--dur-slow: 900ms`.
- Novos keyframes: `fade-rise` (translateY 16→0 + opacity), `reveal-blur` (blur 12→0), `sheen` (gradiente passando).
- Utilitários: `motion-rise`, `motion-blur-in`, `hover-lift` (translateY -2 + shadow), `pressable` (scale 0.98 no active).

### 2. Tipografia fluida e hierarquia (`styles.css` + alguns headings)
- Headings `h1`–`h3` com `font-size: clamp(...)` no `@layer base`.
- `font-feature-settings: "ss01", "cv11"` para Inter Tight (números proporcionais elegantes).

### 3. Refinos de superfície reutilizáveis
- Padronizar `Card` shadcn para usar `glass` em superfícies elevadas (variant CSS, sem quebrar API).
- Botão `primary` ganha leve `sheen` no hover (microinteração ≤ 200ms).
- Inputs com foco em `ring` iridescente sutil.

### 4. Transição de rotas
- Adicionar wrapper `<PageTransition>` em `__root.tsx` / `_authenticated/route.tsx` aplicando `motion-rise` na key do pathname (sem framework extra; só CSS + chave).

### 5. AppShell e sidebar
- Sidebar com `glass-strong` em vez de fundo opaco.
- Item ativo com barra iridescente fina à esquerda + leve `text-titanium`.
- Avatar/foto com anel iridescente sutil quando hover.

### 6. Landing (`index.tsx`) e Pricing
- Hero com headline em `clamp()` e `text-iridescent` sutil em palavra-chave.
- Sections com `motion-rise` ao entrar no viewport (IntersectionObserver mínimo, sem libs).
- Cards de pricing com `titanium-surface` + `hover-lift`.

### 7. Responsividade e performance
- Remover larguras/alturas fixas remanescentes; passar para `grid` + `clamp()`.
- `prefers-reduced-motion` desativa todas as animações cinematográficas.
- Lazy `loading="lazy"` em imagens não-críticas; manter `eager` apenas em LCP.

## Arquivos previstos para edição
- `src/styles.css` — tokens de motion, keyframes, utilitários, tipografia fluida.
- `src/routes/__root.tsx` — wrapper de transição de rota.
- `src/components/AppShell.tsx` — sidebar glass + active state refinado.
- `src/components/ui/{button,card,input}.tsx` — variantes premium (apenas adições, API preservada).
- `src/routes/index.tsx` e `src/routes/pricing.tsx` — hierarquia, reveal-on-scroll, hover-lift nos cards.
- 1 novo arquivo: `src/components/PageTransition.tsx` (reutilizável, ~30 linhas).

## Garantias
- Zero mudança de lógica de negócio, schema, auth ou edge functions.
- Nenhum componente shadcn removido; apenas refinamento de classes/variantes.
- `prefers-reduced-motion` respeitado.
- Mobile/tablet/desktop testados via `clamp()` e grid.

## Próximo passo
Aguardando sua aprovação para executar. Se quiser, posso também limitar o escopo a apenas 1 ou 2 itens (ex.: só motion + landing) antes de avançar no resto.
