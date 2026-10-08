insert into public.app_runtime_state(app_key,schema_version,min_client_schema,release_id,updated_at)
values('finance',2026100802,2026100403,'2026.10.08-r57',now())
on conflict(app_key) do update
set schema_version=excluded.schema_version,
    min_client_schema=least(public.app_runtime_state.min_client_schema,excluded.min_client_schema),
    release_id=excluded.release_id,
    updated_at=excluded.updated_at;
