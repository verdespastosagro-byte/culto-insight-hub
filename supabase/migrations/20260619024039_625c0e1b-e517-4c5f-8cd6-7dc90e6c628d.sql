
-- 1) Dedup por endereço (organization_id + lower(endereco))
WITH ranked AS (
  SELECT id, organization_id, lower(endereco) AS k,
         row_number() OVER (PARTITION BY organization_id, lower(endereco) ORDER BY created_at ASC) AS rn,
         first_value(id) OVER (PARTITION BY organization_id, lower(endereco) ORDER BY created_at ASC) AS keep_id
  FROM public.congregacoes
  WHERE endereco IS NOT NULL AND length(trim(endereco)) > 0
),
dups AS (SELECT id, keep_id FROM ranked WHERE rn > 1)
UPDATE public.cultos c SET congregacao_id = d.keep_id
FROM dups d WHERE c.congregacao_id = d.id;

WITH ranked AS (
  SELECT id, organization_id, lower(endereco) AS k,
         row_number() OVER (PARTITION BY organization_id, lower(endereco) ORDER BY created_at ASC) AS rn
  FROM public.congregacoes
  WHERE endereco IS NOT NULL AND length(trim(endereco)) > 0
)
DELETE FROM public.congregacoes WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Dedup por nome+cidade
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY organization_id, lower(nome), lower(coalesce(cidade,'')) ORDER BY created_at ASC) AS rn,
         first_value(id) OVER (PARTITION BY organization_id, lower(nome), lower(coalesce(cidade,'')) ORDER BY created_at ASC) AS keep_id
  FROM public.congregacoes
),
dups AS (SELECT id, keep_id FROM ranked WHERE rn > 1)
UPDATE public.cultos c SET congregacao_id = d.keep_id
FROM dups d WHERE c.congregacao_id = d.id;

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY organization_id, lower(nome), lower(coalesce(cidade,'')) ORDER BY created_at ASC) AS rn
  FROM public.congregacoes
)
DELETE FROM public.congregacoes WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) Índices únicos para impedir duplicação futura
CREATE UNIQUE INDEX IF NOT EXISTS congregacoes_unique_endereco
  ON public.congregacoes (organization_id, lower(endereco))
  WHERE endereco IS NOT NULL AND length(trim(endereco)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS congregacoes_unique_nome_cidade
  ON public.congregacoes (organization_id, lower(nome), lower(coalesce(cidade,'')));
