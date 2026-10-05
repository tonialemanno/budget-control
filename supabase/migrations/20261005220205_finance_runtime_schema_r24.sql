-- Release guard for Finance 2.4.0. Additive schema remains backwards-compatible with 2026100403 clients.

insert into public.app_runtime_state(app_key,schema_version,min_client_schema,release_id,updated_at)
values('finance',2026100504,2026100403,'2026.10.05-r24',now())
on conflict (app_key) do update
set schema_version=excluded.schema_version,
    min_client_schema=excluded.min_client_schema,
    release_id=excluded.release_id,
    updated_at=now();
