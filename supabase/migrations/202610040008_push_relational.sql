-- Relational Web Push subscriptions and user preferences.
-- The legacy classroom_store row is retained as an immutable migration source.
-- The service reads/writes only these normalized tables with supabaseAdmin.

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  receipt_token text not null,
  receipt_url text,
  last_received_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Existing installations may have created push_subscriptions from the standalone
-- schema. Add any columns introduced by this migration without replacing data.
alter table public.push_subscriptions add column if not exists user_id uuid;
alter table public.push_subscriptions add column if not exists endpoint text;
alter table public.push_subscriptions add column if not exists p256dh text;
alter table public.push_subscriptions add column if not exists auth text;
alter table public.push_subscriptions add column if not exists user_agent text;
alter table public.push_subscriptions add column if not exists receipt_token text;
alter table public.push_subscriptions add column if not exists receipt_url text;
alter table public.push_subscriptions add column if not exists last_received_at timestamptz;
alter table public.push_subscriptions add column if not exists updated_at timestamptz default now();
alter table public.push_subscriptions add column if not exists created_at timestamptz default now();

-- Old rows created before receipt tracking get stable, non-secret placeholder
-- tokens only when absent; legacy classroom_store data is never changed.
update public.push_subscriptions
set receipt_token = md5(gen_random_uuid()::text || clock_timestamp()::text)
where receipt_token is null or length(trim(receipt_token)) = 0;
update public.push_subscriptions set updated_at = now() where updated_at is null;
update public.push_subscriptions set created_at = coalesce(created_at, updated_at, now()) where created_at is null;

create unique index if not exists push_subscriptions_endpoint_uidx
  on public.push_subscriptions (endpoint);
create unique index if not exists push_subscriptions_receipt_token_uidx
  on public.push_subscriptions (receipt_token);
create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_last_received_at_idx
  on public.push_subscriptions (last_received_at desc nulls last);

-- Add useful checks even when an older installation had a less strict table.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.push_subscriptions'::regclass
      and conname = 'push_subscriptions_endpoint_nonempty'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_endpoint_nonempty
      check (length(trim(endpoint)) > 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.push_subscriptions'::regclass
      and conname = 'push_subscriptions_keys_nonempty'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_keys_nonempty
      check (length(trim(p256dh)) > 0 and length(trim(auth)) > 0) not valid;
  end if;
end $$;

-- Add the profile relationship when profiles exists. NOT VALID keeps deployment
-- safe if an old installation contains an orphaned row while enforcing new rows.
do $$
begin
  if to_regclass('public.profiles') is not null and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.push_subscriptions'::regclass
      and confrelid = 'public.profiles'::regclass
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade not valid;
  end if;
end $$;

create table if not exists public.push_preferences (
  user_id uuid primary key,
  enabled boolean not null default true,
  prompted boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Preferences were historically optional and embedded in the legacy value. The
-- table is intentionally server-only; current browser localStorage behavior is
-- preserved because there is no public preference API/DTO to change.
do $$
begin
  if to_regclass('public.profiles') is not null and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.push_preferences'::regclass
      and confrelid = 'public.profiles'::regclass
  ) then
    alter table public.push_preferences
      add constraint push_preferences_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade not valid;
  end if;
end $$;

create index if not exists push_preferences_enabled_idx
  on public.push_preferences (enabled, updated_at desc);

-- Backfill only the source key used by the former push JSON store. In the
-- classroomDbStore convention this is the path push-subscriptions.json with
-- the extension removed: key = push-subscriptions. No DELETE/UPDATE is issued
-- against classroom_store, so it remains an audit-safe legacy backup.
do $$
declare
  source_value jsonb;
  item jsonb;
  pref_key text;
  pref_value jsonb;
  user_text text;
  endpoint_text text;
  p256dh_text text;
  auth_text text;
  receipt_text text;
  created_text text;
  updated_text text;
  last_received_text text;
  enabled_value boolean;
  prompted_value boolean;
begin
  if to_regclass('public.classroom_store') is null then
    raise notice 'classroom_store absent: push legacy backfill skipped';
    return;
  end if;

  select value into source_value
  from public.classroom_store
  where key = 'push-subscriptions';

  if source_value is null then
    raise notice 'classroom_store key push-subscriptions absent: push legacy backfill skipped';
    return;
  end if;

  for item in
    select value
    from jsonb_array_elements(
      case
        when jsonb_typeof(source_value->'subscriptions') = 'array' then source_value->'subscriptions'
        else '[]'::jsonb
      end
    ) as entries(value)
  loop
    user_text := coalesce(item->>'userId', item->>'user_id', '');
    endpoint_text := nullif(trim(coalesce(item->>'endpoint', '')), '');
    p256dh_text := nullif(trim(coalesce(item->'keys'->>'p256dh', item->>'p256dh', '')), '');
    auth_text := nullif(trim(coalesce(item->'keys'->>'auth', item->>'auth', '')), '');
    receipt_text := nullif(trim(coalesce(item->>'receiptToken', item->>'receipt_token', '')), '');
    created_text := nullif(coalesce(item->>'createdAt', item->>'created_at', ''), '');
    updated_text := nullif(coalesce(item->>'updatedAt', item->>'updated_at', ''), '');
    last_received_text := nullif(coalesce(item->>'lastReceivedAt', item->>'last_received_at', ''), '');

    if user_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and endpoint_text is not null
       and p256dh_text is not null
       and auth_text is not null then
      begin
        insert into public.push_subscriptions (
          user_id, endpoint, p256dh, auth, user_agent,
          receipt_token, receipt_url, last_received_at, updated_at, created_at
        ) values (
          user_text::uuid,
          endpoint_text,
          p256dh_text,
          auth_text,
          nullif(left(coalesce(item->>'userAgent', item->>'user_agent', ''), 200), ''),
          coalesce(receipt_text, md5(gen_random_uuid()::text || clock_timestamp()::text)),
          nullif(coalesce(item->>'receiptUrl', item->>'receipt_url', ''), ''),
          case when last_received_text is null then null else last_received_text::timestamptz end,
          coalesce(updated_text::timestamptz, now()),
          coalesce(created_text::timestamptz, updated_text::timestamptz, now())
        ) on conflict (endpoint) do nothing;
      exception when foreign_key_violation or invalid_datetime_format or datetime_field_overflow then
        raise notice 'skipped invalid/orphan legacy push subscription endpoint=%', left(endpoint_text, 120);
      end;
    end if;

    -- Some historical records carried the optional preference alongside a
    -- subscription. Backfill it without overwriting a newer normalized row.
    if user_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and jsonb_typeof(item->'preferences') = 'object' then
      enabled_value := case lower(coalesce(item->'preferences'->>'enabled', ''))
        when 'false' then false when '0' then false else true end;
      prompted_value := case lower(coalesce(item->'preferences'->>'prompted', ''))
        when 'true' then true when '1' then true else false end;
      begin
        insert into public.push_preferences (user_id, enabled, prompted)
        values (user_text::uuid, enabled_value, prompted_value)
        on conflict (user_id) do nothing;
      exception when foreign_key_violation then
        null;
      end;
    end if;
  end loop;

  -- Also accept a legacy top-level preferences object keyed by user UUID.
  if jsonb_typeof(source_value->'preferences') = 'object' then
    for pref_key, pref_value in select key, value from jsonb_each(source_value->'preferences') loop
      if pref_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        begin
          enabled_value := case lower(coalesce(pref_value->>'enabled', ''))
            when 'false' then false when '0' then false else true end;
          prompted_value := case lower(coalesce(pref_value->>'prompted', ''))
            when 'true' then true when '1' then true else false end;
          insert into public.push_preferences (user_id, enabled, prompted)
          values (pref_key::uuid, enabled_value, prompted_value)
          on conflict (user_id) do nothing;
        exception when foreign_key_violation then
          null;
        end;
      end if;
    end loop;
  end if;
end $$;

alter table public.push_subscriptions enable row level security;
alter table public.push_preferences enable row level security;
revoke all on table public.push_subscriptions, public.push_preferences from public, anon, authenticated;
grant all on table public.push_subscriptions, public.push_preferences to service_role;

-- Deliberately no client policies: service_role is the only application path.
notify pgrst, 'reload schema';
commit;
