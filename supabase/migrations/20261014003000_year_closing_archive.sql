-- R91: Household year closing. Historical transactions stay in place; no balance-anchor reset.
create table if not exists public.year_closures (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_year integer not null check (tax_year between 2000 and 2200),
  status text not null default 'open' check (status in ('open','closed')),
  revision integer not null default 0 check (revision >= 0),
  snapshot jsonb not null default '{}'::jsonb,
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id),
  reopen_reason text,
  created_at timestamptz not null default now(),
  unique (household_id,tax_year)
);
create table if not exists public.year_closure_account_checks (
  household_id uuid not null references public.households(id) on delete cascade,
  tax_year integer not null check (tax_year between 2000 and 2200),
  account_id uuid not null references public.accounts(id) on delete cascade,
  statement_through date not null,
  statement_balance numeric(18,2) not null,
  checked_by uuid not null references auth.users(id),
  checked_at timestamptz not null default now(),
  primary key (household_id,tax_year,account_id)
);
create table if not exists public.year_closure_versions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_year integer not null check (tax_year between 2000 and 2200),
  revision integer not null check (revision > 0),
  snapshot jsonb not null,
  closed_by uuid not null references auth.users(id),
  closed_at timestamptz not null default now(),
  unique (household_id,tax_year,revision)
);
create table if not exists public.year_closure_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tax_year integer not null,
  event_type text not null check (event_type in ('closed','reopened')),
  revision integer not null,
  reason text,
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now()
);
create index if not exists year_closure_accounts_year_idx on public.year_closure_account_checks(household_id,tax_year);
create index if not exists year_closure_events_year_idx on public.year_closure_events(household_id,tax_year,occurred_at desc);

alter table public.year_closures enable row level security;
alter table public.year_closure_account_checks enable row level security;
alter table public.year_closure_versions enable row level security;
alter table public.year_closure_events enable row level security;

-- Snapshots may include bank-account identifiers and balances: admin-only access.
create policy year_closures_admin_read on public.year_closures
  for select to authenticated using (private.can_admin_household(household_id));
create policy year_checks_admin_read on public.year_closure_account_checks
  for select to authenticated using (
    private.can_admin_household(household_id)
    or exists (select 1 from public.accounts a where a.id=account_id and a.owner_user_id=(select auth.uid()))
  );
create policy year_versions_admin_read on public.year_closure_versions
  for select to authenticated using (private.can_admin_household(household_id));
create policy year_events_admin_read on public.year_closure_events
  for select to authenticated using (private.can_admin_household(household_id));

grant select on public.year_closures,public.year_closure_account_checks,public.year_closure_versions,public.year_closure_events to authenticated;

-- Internal financial cutoff (CH/DE time zone) is exclusive midnight on January 1.
create or replace function private.year_close_cutoff(p_year integer)
returns timestamptz language sql immutable set search_path='' as $$
  select make_timestamptz(p_year+1,1,1,0,0,0,'Europe/Zurich');
$$;

create or replace function private.year_end_balance(p_account uuid,p_year integer)
returns numeric language sql stable set search_path='' as $$
  select (a.balance_anchor_amount + coalesce((
    select sum(t.amount) from public.transactions t
    where t.account_id=a.id and t.status='booked'
      and t.occurred_at>a.balance_anchor_at
      and t.occurred_at<private.year_close_cutoff(p_year)
  ),0))::numeric(18,2)
  from public.accounts a where a.id=p_account;
$$;

-- Return a preflight with no 'last transaction' assumption. Closed years report archive state.
create or replace function public.year_close_overview(p_household_id uuid,p_year integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_close public.year_closures%rowtype;
  v_accounts jsonb;
  v_mismatched integer;
  v_unchecked integer;
  v_unclassified integer;
  v_pending integer;
  v_hidden integer;
  v_year_end date:=make_date(p_year,12,31);
begin
  if (select auth.uid()) is null or not private.can_admin_household(p_household_id) then
    raise exception 'Keine Berechtigung für den Jahresabschluss' using errcode='42501';
  end if;
  if p_year < 2000 or p_year > extract(year from current_date)::integer then
    raise exception 'Ungültiges Abschlussjahr';
  end if;
  select * into v_close from public.year_closures where household_id=p_household_id and tax_year=p_year;
  select count(*) into v_hidden from public.accounts a
  where a.household_id=p_household_id
    and (a.created_at < private.year_close_cutoff(p_year)
      or a.balance_anchor_at < private.year_close_cutoff(p_year))
    and coalesce(a.visibility,'private')<>'household' and a.owner_user_id is distinct from (select auth.uid());
  select count(*) into v_pending from public.transactions t where t.household_id=p_household_id
    and t.status<>'booked'
    and t.occurred_at>=make_timestamptz(p_year,1,1,0,0,0,'Europe/Zurich')
    and t.occurred_at<private.year_close_cutoff(p_year);
  select count(*) into v_unclassified from public.transactions t where t.household_id=p_household_id
    and t.status='booked' and t.category_id is null and t.semantic_type is null
    and t.transfer_group_id is null and coalesce(t.cashflow_type,'standard')='standard'
    and coalesce(t.exclude_from_reports,false)=false
    and t.occurred_at>=make_timestamptz(p_year,1,1,0,0,0,'Europe/Zurich')
    and t.occurred_at<private.year_close_cutoff(p_year);
  select count(*) filter (where c.account_id is not null
      and c.statement_balance is distinct from private.year_end_balance(a.id,p_year)),
    count(*) filter (where c.account_id is null or c.statement_through<v_year_end
      or a.balance_anchor_at>=private.year_close_cutoff(p_year)
      or exists (select 1 from public.transactions changed
        where changed.account_id=a.id and changed.occurred_at<private.year_close_cutoff(p_year)
          and changed.occurred_at>a.balance_anchor_at
          and coalesce(changed.updated_at,changed.created_at)>c.checked_at))
    into v_mismatched,v_unchecked
  from public.accounts a
  left join public.year_closure_account_checks c on c.household_id=a.household_id and c.tax_year=p_year and c.account_id=a.id
  where a.household_id=p_household_id
    and (a.created_at<private.year_close_cutoff(p_year) or a.balance_anchor_at<private.year_close_cutoff(p_year));
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'name',a.name,'currency',a.currency,'archived',a.is_archived,
    'calculated_balance',case when a.balance_anchor_at<private.year_close_cutoff(p_year)
      then private.year_end_balance(a.id,p_year) else null end,
    'statement_balance',c.statement_balance,'statement_through',c.statement_through,
    'confirmed_at',c.checked_at,'confirmed_by',c.checked_by,
    'matches',c.checked_at is not null and c.statement_through>=v_year_end
      and a.balance_anchor_at<private.year_close_cutoff(p_year)
      and c.statement_balance=private.year_end_balance(a.id,p_year)
      and not exists (select 1 from public.transactions changed
        where changed.account_id=a.id and changed.occurred_at<private.year_close_cutoff(p_year)
          and changed.occurred_at>a.balance_anchor_at
          and coalesce(changed.updated_at,changed.created_at)>c.checked_at)
  ) order by a.name), '[]'::jsonb) into v_accounts
  from public.accounts a left join public.year_closure_account_checks c
    on c.household_id=a.household_id and c.tax_year=p_year and c.account_id=a.id
  where a.household_id=p_household_id
    and (a.created_at<private.year_close_cutoff(p_year) or a.balance_anchor_at<private.year_close_cutoff(p_year))
    and (a.visibility='household' or a.owner_user_id=(select auth.uid()));
  -- Never report the hidden account's identifying data or balance.
  select count(*) into v_hidden from public.accounts a
    where a.household_id=p_household_id
    and (a.created_at<private.year_close_cutoff(p_year) or a.balance_anchor_at<private.year_close_cutoff(p_year))
    and coalesce(a.visibility,'private')<>'household' and a.owner_user_id is distinct from (select auth.uid());
  return jsonb_build_object('year',p_year,'status',coalesce(v_close.status,'open'),
    'revision',coalesce(v_close.revision,0),'closed_at',v_close.closed_at,
    'accounts',v_accounts,'hidden_accounts',v_hidden,
    'unconfirmed_accounts',v_unchecked,'mismatched_accounts',v_mismatched,
    'pending_transactions',v_pending,'unclassified_transactions',v_unclassified,
    'can_close',p_year<extract(year from current_date)::integer
      and coalesce(v_close.status,'open')='open'
      and v_unchecked=0 and v_mismatched=0 and v_hidden=0 and v_pending=0 and v_unclassified=0
      and jsonb_array_length(v_accounts)>0);
end;
$$;

create or replace function public.year_confirm_account(
  p_household_id uuid,p_year integer,p_account_id uuid,p_statement_balance numeric,p_statement_through date
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_account public.accounts%rowtype;v_close public.year_closures%rowtype;
begin
  if (select auth.uid()) is null or not private.can_admin_household(p_household_id) then
    raise exception 'Keine Administratorberechtigung' using errcode='42501';
  end if;
  if p_year>=extract(year from current_date)::integer or p_year<2000 then
    raise exception 'Es können nur vergangene Kalenderjahre bestätigt werden';
  end if;
  select * into v_account from public.accounts where id=p_account_id and household_id=p_household_id;
  if not found or not (v_account.visibility='household' or v_account.owner_user_id=(select auth.uid())) then
    raise exception 'Konto nicht verfügbar' using errcode='42501';
  end if;
  if v_account.balance_anchor_at>=private.year_close_cutoff(p_year) then
    raise exception 'Historischer Kontosaldo ist nicht rekonstruierbar. Bitte zuerst den Kontoanker prüfen.';
  end if;
  if p_statement_through<>make_date(p_year,12,31) then
    raise exception 'Bitte den bestätigten Kontostand per 31.12. eingeben';
  end if;
  insert into public.year_closures(household_id,tax_year) values(p_household_id,p_year)
    on conflict(household_id,tax_year) do nothing;
  select * into v_close from public.year_closures where household_id=p_household_id and tax_year=p_year for update;
  if v_close.status='closed' then raise exception 'Das Jahr ist abgeschlossen'; end if;
  if p_statement_balance is distinct from private.year_end_balance(p_account_id,p_year) then
    raise exception 'Bankauszug und berechneter Saldo stimmen nicht überein';
  end if;
  insert into public.year_closure_account_checks(household_id,tax_year,account_id,statement_through,statement_balance,checked_by,checked_at)
    values(p_household_id,p_year,p_account_id,p_statement_through,p_statement_balance,(select auth.uid()),now())
    on conflict(household_id,tax_year,account_id) do update
    set statement_through=excluded.statement_through,statement_balance=excluded.statement_balance,checked_by=excluded.checked_by,checked_at=now();
  return public.year_close_overview(p_household_id,p_year);
end;
$$;

create or replace function public.year_close_finalize(p_household_id uuid,p_year integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_close public.year_closures%rowtype;v_check jsonb;v_snapshot jsonb;v_start timestamptz;
begin
  if (select auth.uid()) is null or not private.can_admin_household(p_household_id) then
    raise exception 'Nur Haushalt-Administratoren dürfen abschliessen' using errcode='42501';
  end if;
  if p_year>=extract(year from current_date)::integer or p_year<2000 then
    raise exception 'Ein laufendes Jahr kann nicht abgeschlossen werden';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_household_id::text),p_year);
  insert into public.year_closures(household_id,tax_year) values(p_household_id,p_year)
    on conflict(household_id,tax_year) do nothing;
  select * into v_close from public.year_closures
   where household_id=p_household_id and tax_year=p_year for update;
  if v_close.status='closed' then raise exception 'Jahr bereits abgeschlossen'; end if;
  v_check:=public.year_close_overview(p_household_id,p_year);
  if coalesce((v_check->>'can_close')::boolean,false)=false then
    raise exception 'Jahresabschluss noch nicht freigegeben: Konten und Buchungen prüfen';
  end if;
  v_start:=make_timestamptz(p_year,1,1,0,0,0,'Europe/Zurich');
  select jsonb_build_object(
    'year',p_year,'cutoff',(private.year_close_cutoff(p_year))::text,
    'created_at',now(),'household_id',p_household_id,
    'base_currency',(select base_currency from public.households where id=p_household_id),
    'accounts',v_check->'accounts',
    'booked_transaction_count',(select count(*) from public.transactions t
      where t.household_id=p_household_id and t.status='booked'
        and t.occurred_at>=v_start and t.occurred_at<private.year_close_cutoff(p_year)),
    'transactions',coalesce((
      select jsonb_agg(jsonb_build_object('id',t.id,'occurred_at',t.occurred_at,
        'amount',t.amount,'currency',t.currency,'description',t.description,
        'counterparty',t.counterparty,'account_id',t.account_id,
        'category_id',t.category_id,'category_name',c.name,
        'semantic_type',t.semantic_type,'tax_relevant',t.tax_relevant,
        'tax_year',t.tax_year,'tax_treatment',t.tax_treatment,
        'transfer_group_id',t.transfer_group_id,'exclude_from_reports',t.exclude_from_reports)
        order by t.occurred_at,t.id)
      from public.transactions t left join public.categories c on c.id=t.category_id
      where t.household_id=p_household_id and t.status='booked'
        and t.occurred_at>=v_start and t.occurred_at<private.year_close_cutoff(p_year)
    ),'[]'::jsonb),
    'tax_note','Frozen transaction metadata; tax return remains a separately prepared dossier'
  ) into v_snapshot;
  update public.year_closures set status='closed',revision=revision+1,snapshot=v_snapshot,
    closed_at=now(),closed_by=(select auth.uid()),reopened_at=null,reopened_by=null,reopen_reason=null
  where id=v_close.id returning * into v_close;
  insert into public.year_closure_versions(household_id,tax_year,revision,snapshot,closed_by)
    values(p_household_id,p_year,v_close.revision,v_snapshot,(select auth.uid()));
  insert into public.year_closure_events(household_id,tax_year,event_type,revision,actor_id)
    values(p_household_id,p_year,'closed',v_close.revision,(select auth.uid()));
  return jsonb_build_object('year',p_year,'status','closed','revision',v_close.revision);
end;
$$;

create or replace function public.year_close_reopen(p_household_id uuid,p_year integer,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_close public.year_closures%rowtype;
begin
  if (select auth.uid()) is null or not private.can_admin_household(p_household_id) then
    raise exception 'Nur Haushalt-Administratoren dürfen wiedereröffnen' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<12 then raise exception 'Bitte eine nachvollziehbare Begründung angeben'; end if;
  select * into v_close from public.year_closures where household_id=p_household_id and tax_year=p_year for update;
  if not found or v_close.status<>'closed' then raise exception 'Jahr ist nicht abgeschlossen'; end if;
  if exists(select 1 from public.year_closures where household_id=p_household_id and tax_year>p_year and status='closed')
    then raise exception 'Bitte zuerst spätere Jahre wiedereröffnen'; end if;
  update public.year_closures set status='open',reopened_at=now(),reopened_by=(select auth.uid()),reopen_reason=trim(p_reason)
    where id=v_close.id;
  delete from public.year_closure_account_checks where household_id=p_household_id and tax_year=p_year;
  insert into public.year_closure_events(household_id,tax_year,event_type,revision,reason,actor_id)
    values(p_household_id,p_year,'reopened',v_close.revision,trim(p_reason),(select auth.uid()));
  return jsonb_build_object('year',p_year,'status','open','revision',v_close.revision);
end;
$$;

-- Enforce immutability against all API clients, not only the UI.
create or replace function private.reject_closed_year_transaction()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_hh uuid;v_year integer;v_date timestamptz;v_side text;
begin
  for v_side in select unnest(case when tg_op='INSERT' then array['new']
     when tg_op='DELETE' then array['old'] else array['old','new'] end)
  loop
    if v_side='old' then v_hh=old.household_id;v_date=old.occurred_at;
    else v_hh=new.household_id;v_date=new.occurred_at;end if;
    v_year=extract(year from v_date at time zone 'Europe/Zurich')::integer;
    perform pg_advisory_xact_lock(hashtext(v_hh::text),v_year);
    if (select status from public.year_closures
      where household_id=v_hh and tax_year=v_year for share)='closed' then
      raise exception 'Das Jahr % ist abgeschlossen. Vor Änderungen zuerst wiedereröffnen.',v_year using errcode='23514';
    end if;
  end loop;
  if tg_op='DELETE' then return old;end if;
  return new;
end;
$$;
drop trigger if exists year_closure_tx_guard on public.transactions;
create trigger year_closure_tx_guard before insert or update or delete on public.transactions
  for each row execute function private.reject_closed_year_transaction();

create or replace function private.reject_closed_year_account_anchor()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.year_closures where household_id=old.household_id
      and status='closed' and private.year_close_cutoff(tax_year)>old.balance_anchor_at for share) then
      raise exception 'Konto gehört zu einem abgeschlossenen Jahr. Zuerst wiedereröffnen.' using errcode='23514';
    end if;
    return old;
  end if;
  if (new.balance_anchor_amount,new.balance_anchor_at,new.currency,new.household_id)
        is distinct from (old.balance_anchor_amount,old.balance_anchor_at,old.currency,old.household_id) then
    if exists(select 1 from public.year_closures
      where household_id=old.household_id and status='closed'
        and private.year_close_cutoff(tax_year)>old.balance_anchor_at for share) then
      raise exception 'Kontoanker gehört zu einem abgeschlossenen Jahr. Zuerst wiedereröffnen.' using errcode='23514';
    end if;
  end if;
  if tg_op='DELETE' then return old;end if;
  return new;
end;
$$;
drop trigger if exists year_closure_account_guard on public.accounts;
create trigger year_closure_account_guard before update or delete on public.accounts
  for each row execute function private.reject_closed_year_account_anchor();

revoke all on function public.year_close_overview(uuid,integer) from public,anon;
revoke all on function public.year_confirm_account(uuid,integer,uuid,numeric,date) from public,anon;
revoke all on function public.year_close_finalize(uuid,integer) from public,anon;
revoke all on function public.year_close_reopen(uuid,integer,text) from public,anon;
grant execute on function public.year_close_overview(uuid,integer),
  public.year_confirm_account(uuid,integer,uuid,numeric,date),
  public.year_close_finalize(uuid,integer),
  public.year_close_reopen(uuid,integer,text) to authenticated;
