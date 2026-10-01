-- Finance V2.2 – user-specific UI preferences.
-- Entitlements remain in user_module_access. These preferences only control the user's own UI.
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.preferences is
  'User-owned UI preferences such as hidden_modules and privacy_enabled. Never used as authorization.';
