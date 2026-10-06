-- Finance 2.4.1 release marker. Schema remains 2026100504.

insert into public.app_runtime_state(app_key,schema_version,min_client_schema,release_id,updated_at)
values('finance',2026100504,2026100403,'2026.10.06-r25',now())
on conflict (app_key) do update
set release_id=excluded.release_id,
    schema_version=excluded.schema_version,
    min_client_schema=excluded.min_client_schema,
    updated_at=now();
