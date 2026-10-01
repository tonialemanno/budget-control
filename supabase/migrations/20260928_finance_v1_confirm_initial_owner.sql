-- One-time bootstrap for the initial Finance V1 owner created during setup.
-- This does not disable normal authentication rules for later users.
update auth.users
set
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where id = (
  select user_id
  from public.app_admins
  where role = 'owner'
  order by created_at asc
  limit 1
);
