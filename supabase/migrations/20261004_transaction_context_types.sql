alter table public.transaction_contexts
  drop constraint if exists transaction_contexts_context_type_check;

alter table public.transaction_contexts
  add constraint transaction_contexts_context_type_check
  check (context_type in ('trip','project','vehicle','life_event','family','work','other'));
