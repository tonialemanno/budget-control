update public.app_runtime_state
set schema_version=2026100403,
    min_client_schema=2026100403,
    release_id='2026.10.04-r4',
    updated_at=now()
where app_key='finance';
