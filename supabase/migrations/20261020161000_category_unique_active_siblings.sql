-- Deduplicate only genuinely unused category rows. Never delete history.
-- Referenced duplicates abort the partial unique index and therefore this migration,
-- rather than rewriting financial records or silently dropping relationships.
WITH ranked AS (
  SELECT c.id,
    row_number() OVER (
      PARTITION BY c.household_id,c.kind,coalesce(c.parent_id::text,''),lower(btrim(c.name))
      ORDER BY
        (SELECT count(*) FROM public.categories ch WHERE ch.parent_id=c.id) DESC,
        (SELECT count(*) FROM public.transactions t WHERE t.category_id=c.id) DESC,
        c.created_at ASC,c.id ASC
    ) AS rn
  FROM public.categories c
  WHERE c.is_archived=false
)
UPDATE public.categories c SET is_archived=true
FROM ranked r
WHERE c.id=r.id AND r.rn>1
  AND NOT EXISTS(SELECT 1 FROM public.categories ch WHERE ch.parent_id=c.id)
  AND NOT EXISTS(SELECT 1 FROM public.transactions t WHERE t.category_id=c.id)
  AND NOT EXISTS(SELECT 1 FROM public.merchants m WHERE m.default_category_id=c.id)
  AND NOT EXISTS(SELECT 1 FROM public.recurring_rules q WHERE q.category_id=c.id)
  AND NOT EXISTS(SELECT 1 FROM public.budgets q WHERE q.category_id=c.id)
  AND NOT EXISTS(SELECT 1 FROM public.bills q WHERE q.category_id=c.id)
  AND NOT EXISTS(SELECT 1 FROM public.contracts q WHERE q.category_id=c.id)
  AND NOT EXISTS(SELECT 1 FROM public.insurance_policies q WHERE q.category_id=c.id)
  AND NOT EXISTS(SELECT 1 FROM public.categorization_rules q WHERE q.category_id=c.id);

-- The NULL parent is a single logical root: one active sibling with a given name.
-- This also prevents concurrent country starter installations from creating duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS categories_unique_active_siblings_v1
ON public.categories (household_id,kind,coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(btrim(name)))
WHERE is_archived=false;
