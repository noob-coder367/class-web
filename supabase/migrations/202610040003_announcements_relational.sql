-- Relational announcement metadata for the EXISTING application schema.
-- Existing production deployments may already have public.announcements with UUID
-- identifiers and UUID account/homework references. Do not change those types.
-- classroom_store remains an immutable source; malformed legacy records are
-- reported and skipped, never assigned invented announcement IDs.

begin;

create table if not exists public.announcements (
  id uuid primary key,
  title text not null default '',
  document_kind text not null default 'thong_bao',
  short_id integer,
  content text not null default '',
  images jsonb not null default '[]'::jsonb,
  notify_type text not null default 'normal',
  section text not null default 'main',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  created_by_name text not null default 'Admin',
  source_homework_id uuid,
  is_exam_reminder boolean not null default false,
  is_system boolean not null default false,
  hidden boolean not null default false,
  hidden_at timestamptz,
  hidden_by uuid,
  hidden_by_name text,
  subject_user_id uuid,
  subject_user_name text,
  from_level text,
  to_level text,
  updated_at timestamptz
);

-- Add missing columns without changing any existing column's type or rewriting
-- existing announcement rows. In particular the account/reference columns stay UUID.
alter table public.announcements add column if not exists title text;
alter table public.announcements add column if not exists document_kind text;
alter table public.announcements add column if not exists short_id integer;
alter table public.announcements add column if not exists content text;
alter table public.announcements add column if not exists images jsonb;
alter table public.announcements add column if not exists notify_type text;
alter table public.announcements add column if not exists section text;
alter table public.announcements add column if not exists expires_at timestamptz;
alter table public.announcements add column if not exists created_at timestamptz;
alter table public.announcements add column if not exists created_by uuid;
alter table public.announcements add column if not exists created_by_name text;
alter table public.announcements add column if not exists source_homework_id uuid;
alter table public.announcements add column if not exists is_exam_reminder boolean;
alter table public.announcements add column if not exists is_system boolean;
alter table public.announcements add column if not exists hidden boolean;
alter table public.announcements add column if not exists hidden_at timestamptz;
alter table public.announcements add column if not exists hidden_by uuid;
alter table public.announcements add column if not exists hidden_by_name text;
alter table public.announcements add column if not exists subject_user_id uuid;
alter table public.announcements add column if not exists subject_user_name text;
alter table public.announcements add column if not exists from_level text;
alter table public.announcements add column if not exists to_level text;
alter table public.announcements add column if not exists updated_at timestamptz;

-- Fail before touching data if an existing installation has incompatible ID types.
do $$
declare
  expected record;
  actual_type text;
begin
  for expected in select * from (values
    ('id','uuid'), ('title','text'), ('content','text'), ('images','jsonb'),
    ('notify_type','text'), ('section','text'), ('expires_at','timestamp with time zone'),
    ('created_at','timestamp with time zone'), ('created_by','uuid'), ('created_by_name','text'),
    ('source_homework_id','uuid'), ('is_exam_reminder','boolean'), ('is_system','boolean'),
    ('hidden','boolean'), ('hidden_at','timestamp with time zone'), ('hidden_by','uuid'),
    ('hidden_by_name','text'), ('subject_user_id','uuid'), ('subject_user_name','text'),
    ('from_level','text'), ('to_level','text'), ('updated_at','timestamp with time zone'),
    ('document_kind','text'), ('short_id','integer')
  ) as known(column_name,type_name)
  loop
    select format_type(a.atttypid, a.atttypmod)
      into actual_type
    from pg_attribute a
    where a.attrelid = 'public.announcements'::regclass
      and a.attname = expected.column_name
      and a.attnum > 0
      and not a.attisdropped;

    if actual_type is distinct from expected.type_name then
      raise exception 'public.announcements.% must be %; found %. No type conversion was attempted.',
        expected.column_name, expected.type_name, coalesce(actual_type, '<missing>');
    end if;
  end loop;
end $$;

-- Provide defaults for newly inserted rows, but do not normalize or rewrite
-- pre-existing announcement rows. Existing NULL/legacy values remain untouched.
alter table public.announcements alter column title set default '';
alter table public.announcements alter column document_kind set default 'thong_bao';
alter table public.announcements alter column content set default '';
alter table public.announcements alter column images set default '[]'::jsonb;
alter table public.announcements alter column notify_type set default 'normal';
alter table public.announcements alter column section set default 'main';
alter table public.announcements alter column created_at set default now();
alter table public.announcements alter column created_by_name set default 'Admin';
alter table public.announcements alter column is_exam_reminder set default false;
alter table public.announcements alter column is_system set default false;
alter table public.announcements alter column hidden set default false;

-- NOT VALID keeps legacy rows intact while enforcing these checks for new writes.
do $$
begin
  if exists (select 1 from pg_constraint where conrelid='public.announcements'::regclass and conname='announcements_document_kind_chk'
      and (contype <> 'c' or position('document_kind' in lower(pg_get_constraintdef(oid)))=0
        or position('thong_bao' in lower(pg_get_constraintdef(oid)))=0 or position('bao_cao' in lower(pg_get_constraintdef(oid)))=0)) then
    raise exception 'Existing announcements_document_kind_chk is incompatible; inspect it before retrying.';
  end if;
  if exists (select 1 from pg_constraint where conrelid='public.announcements'::regclass and conname='announcements_notify_type_chk'
      and (contype <> 'c' or position('notify_type' in lower(pg_get_constraintdef(oid)))=0
        or position('normal' in lower(pg_get_constraintdef(oid)))=0 or position('urgent' in lower(pg_get_constraintdef(oid)))=0)) then
    raise exception 'Existing announcements_notify_type_chk is incompatible; inspect it before retrying.';
  end if;
  if exists (select 1 from pg_constraint where conrelid='public.announcements'::regclass and conname='announcements_section_chk'
      and (contype <> 'c' or position('section' in lower(pg_get_constraintdef(oid)))=0
        or position('important' in lower(pg_get_constraintdef(oid)))=0 or position('discipline' in lower(pg_get_constraintdef(oid)))=0)) then
    raise exception 'Existing announcements_section_chk is incompatible; inspect it before retrying.';
  end if;
  if exists (select 1 from pg_constraint where conrelid='public.announcements'::regclass and conname='announcements_short_id_chk'
      and (contype <> 'c' or position('short_id' in lower(pg_get_constraintdef(oid)))=0
        or position('> 0' in pg_get_constraintdef(oid))=0)) then
    raise exception 'Existing announcements_short_id_chk is incompatible; inspect it before retrying.';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.announcements'::regclass and conname='announcements_document_kind_chk') then
    alter table public.announcements add constraint announcements_document_kind_chk
      check (document_kind is null or document_kind in ('thong_bao', 'bao_cao')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.announcements'::regclass and conname='announcements_notify_type_chk') then
    alter table public.announcements add constraint announcements_notify_type_chk
      check (notify_type is null or notify_type in ('normal', 'hot', 'urgent')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.announcements'::regclass and conname='announcements_section_chk') then
    alter table public.announcements add constraint announcements_section_chk
      check (section is null or section in ('main', 'important', 'discipline')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.announcements'::regclass and conname='announcements_short_id_chk') then
    alter table public.announcements add constraint announcements_short_id_chk
      check (short_id is null or short_id > 0) not valid;
  end if;
end $$;

-- The referenced UUID must be unique even if a legacy table was created without
-- its original primary key. Add a unique index only when no equivalent exists.
do $$
declare
  id_attnum smallint;
begin
  select attnum into id_attnum from pg_attribute
   where attrelid='public.announcements'::regclass and attname='id' and not attisdropped;
  if not exists (
    select 1 from pg_index i
    where i.indrelid='public.announcements'::regclass
      and i.indisunique and i.indisvalid and i.indpred is null and i.indexprs is null
      and i.indnkeyatts=1 and i.indnatts=1 and i.indkey[0]=id_attnum
  ) then
    create unique index announcements_id_uuid_uidx on public.announcements(id);
  end if;
end $$;

-- IF NOT EXISTS does not verify an existing index definition. Fail explicitly
-- if a prior/manual object reused one of these names for a different index.
do $$
declare
  expected record;
  existing_table text;
  existing_def text;
  expected_fragment text;
begin
  for expected in select * from (values
    ('announcements_created_at_idx','announcements','onpublic.announcementsusingbtree(created_atdesc)'),
    ('announcements_visible_idx','announcements','onpublic.announcementsusingbtree(hidden,expires_at,created_atdesc)'),
    ('announcements_archive_section_idx','announcements','onpublic.announcementsusingbtree(section,hidden,created_atdesc)'),
    ('announcements_homework_idx','announcements','onpublic.announcementsusingbtree(source_homework_id,is_exam_reminder)'),
    ('announcements_short_id_idx','announcements','onpublic.announcementsusingbtree(document_kind,short_id)')
  ) as expected(index_name,table_name,definition_fragment)
  loop
    select tablename, regexp_replace(lower(indexdef), '\s+', '', 'g')
      into existing_table, existing_def
    from pg_indexes where schemaname='public' and indexname=expected.index_name;
    if found then
      expected_fragment := expected.definition_fragment;
      if existing_table <> expected.table_name or position(expected_fragment in existing_def)=0
         or existing_def like 'createuniqueindex%' then
        raise exception 'Existing public.% does not match expected index on public.%; inspect it before retrying.', expected.index_name, expected.table_name;
      end if;
    end if;
  end loop;
end $$;

create index if not exists announcements_created_at_idx on public.announcements (created_at desc);
create index if not exists announcements_visible_idx on public.announcements (hidden, expires_at, created_at desc);
create index if not exists announcements_archive_section_idx on public.announcements (section, hidden, created_at desc);
create index if not exists announcements_homework_idx on public.announcements (source_homework_id, is_exam_reminder);
create index if not exists announcements_short_id_idx on public.announcements (document_kind, short_id);

create table if not exists public.announcement_images (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  storage_path text,
  public_url text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes > 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

-- Converge a table left behind by an earlier/manual attempt without dropping
-- its original text IDs. Valid text IDs are copied into a new UUID FK column;
-- raw values remain in announcement_id_legacy_text for audit and recovery.
alter table public.announcement_images add column if not exists id uuid default gen_random_uuid();
alter table public.announcement_images add column if not exists announcement_id uuid;
alter table public.announcement_images add column if not exists storage_path text;
alter table public.announcement_images add column if not exists public_url text;
alter table public.announcement_images add column if not exists mime_type text;
alter table public.announcement_images add column if not exists size_bytes bigint;
alter table public.announcement_images add column if not exists position integer default 0;
alter table public.announcement_images add column if not exists created_at timestamptz default now();

do $$
declare
  announcement_id_type oid;
  image_id_type oid;
  position_type oid;
  has_legacy_column boolean;
  invalid_count bigint;
  null_count bigint;
begin
  select a.atttypid into announcement_id_type
  from pg_attribute a
  where a.attrelid='public.announcement_images'::regclass
    and a.attname='announcement_id' and a.attnum > 0 and not a.attisdropped;
  select exists (
    select 1 from pg_attribute a where a.attrelid='public.announcement_images'::regclass
      and a.attname='announcement_id_legacy_text' and a.attnum > 0 and not a.attisdropped
  ) into has_legacy_column;

  select a.atttypid into image_id_type from pg_attribute a
   where a.attrelid='public.announcement_images'::regclass
     and a.attname='id' and a.attnum > 0 and not a.attisdropped;
  if image_id_type not in ('uuid'::regtype, 'text'::regtype) then
    raise exception 'public.announcement_images.id must be uuid or legacy text; found %. No type conversion was attempted.',
      coalesce(format_type(image_id_type, null), '<missing>');
  end if;
  select a.atttypid into position_type from pg_attribute a
   where a.attrelid='public.announcement_images'::regclass
     and a.attname='position' and a.attnum > 0 and not a.attisdropped;
  if position_type <> 'integer'::regtype then
    raise exception 'public.announcement_images.position must be integer; found %.', format_type(position_type, null);
  end if;

  if announcement_id_type = 'text'::regtype then
    if has_legacy_column then
      raise exception 'Both text announcement_id and announcement_id_legacy_text exist; inspect this partial state before rerunning.';
    end if;
    select count(*) into invalid_count from public.announcement_images
      where announcement_id is null
         or btrim(announcement_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    if invalid_count > 0 then
      raise exception 'Cannot convert % announcement_images rows: announcement_id contains NULL or non-UUID text. No image rows were changed; inspect the table and preserve those raw values before retrying.', invalid_count;
    end if;
    alter table public.announcement_images rename column announcement_id to announcement_id_legacy_text;
    alter table public.announcement_images alter column announcement_id_legacy_text drop not null;
    alter table public.announcement_images add column announcement_id uuid;
    update public.announcement_images
       set announcement_id = announcement_id_legacy_text::uuid
     where announcement_id is null;
  elsif announcement_id_type is null then
    alter table public.announcement_images add column announcement_id uuid;
  elsif announcement_id_type <> 'uuid'::regtype then
    raise exception 'public.announcement_images.announcement_id must be uuid or legacy text; found %. No type conversion was attempted.',
      format_type(announcement_id_type, null);
  end if;

  if has_legacy_column then
    alter table public.announcement_images alter column announcement_id_legacy_text drop not null;
    select count(*) into invalid_count from public.announcement_images
      where announcement_id is null
        and announcement_id_legacy_text is not null
        and btrim(announcement_id_legacy_text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    if invalid_count > 0 then
      update public.announcement_images
         set announcement_id = announcement_id_legacy_text::uuid
       where announcement_id is null
         and btrim(announcement_id_legacy_text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    end if;
    select count(*) into invalid_count from public.announcement_images
      where announcement_id is null and announcement_id_legacy_text is not null
        and btrim(announcement_id_legacy_text) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    if invalid_count > 0 then
      raise exception 'Cannot enforce UUID announcement_id: % legacy text values are invalid and remain preserved in announcement_id_legacy_text.', invalid_count;
    end if;
  end if;

  select count(*) into null_count from public.announcement_images where announcement_id is null;
  if null_count > 0 then
    raise exception 'Cannot enforce announcement_images.announcement_id NOT NULL: % rows have no UUID relationship. Review them without deleting data.', null_count;
  end if;
  alter table public.announcement_images alter column announcement_id set not null;
  if image_id_type = 'uuid'::regtype then
    alter table public.announcement_images alter column id set default gen_random_uuid();
    update public.announcement_images set id=gen_random_uuid() where id is null;
  else
    alter table public.announcement_images alter column id set default (gen_random_uuid()::text);
    update public.announcement_images set id=gen_random_uuid()::text where id is null;
  end if;
  alter table public.announcement_images alter column id set not null;
  select count(*) into null_count from public.announcement_images where position is null;
  if null_count > 0 then
    raise exception 'Cannot create image position uniqueness index: % rows have NULL position. Review without deleting rows.', null_count;
  end if;
  alter table public.announcement_images alter column position set default 0;
  alter table public.announcement_images alter column position set not null;
  alter table public.announcement_images alter column created_at set default now();
end $$;

-- Ensure the FK is UUID -> UUID. NOT VALID preserves pre-existing orphaned UUID
-- links while enforcing all future writes; no rows are deleted or rewritten.
do $$
declare
  image_attnum smallint;
  announcement_attnum smallint;
  wrong_fk boolean;
begin
  select attnum into image_attnum from pg_attribute
   where attrelid='public.announcement_images'::regclass and attname='announcement_id' and not attisdropped;
  select attnum into announcement_attnum from pg_attribute
   where attrelid='public.announcements'::regclass and attname='id' and not attisdropped;

  select exists (
    select 1 from pg_constraint c
    where c.conrelid='public.announcement_images'::regclass and c.contype='f'
      and c.conkey=array[image_attnum]::smallint[]
      and (c.confrelid <> 'public.announcements'::regclass or c.confkey <> array[announcement_attnum]::smallint[])
  ) into wrong_fk;
  if wrong_fk then
    raise exception 'announcement_images.announcement_id has an unrelated or incompatible existing FK; inspect it before retrying.';
  end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid='public.announcement_images'::regclass and c.contype='f'
      and c.conkey=array[image_attnum]::smallint[]
      and c.confrelid='public.announcements'::regclass
      and c.confkey=array[announcement_attnum]::smallint[]
  ) then
    alter table public.announcement_images
      add constraint announcement_images_announcement_id_fkey
      foreign key (announcement_id) references public.announcements(id)
      on delete cascade not valid;
  end if;
end $$;

-- Do not silently merge pre-existing duplicate image positions. The unique key
-- makes reruns/concurrent backfills idempotent; duplicates abort this transaction
-- with their rows preserved for manual review.
do $$
declare duplicate_count bigint;
begin
  select count(*) into duplicate_count from (
    select announcement_id, position from public.announcement_images
    group by announcement_id, position having count(*) > 1
  ) duplicates;
  if duplicate_count > 0 then
    raise exception 'announcement_images contains % duplicate (announcement_id, position) groups; review without deleting rows before retrying.', duplicate_count;
  end if;
end $$;

do $$
declare
  expected record;
  existing_table text;
  existing_def text;
  existing_unique boolean;
begin
  for expected in select * from (values
    ('announcement_images_announcement_position_uidx','onpublic.announcement_imagesusingbtree(announcement_id,position)',true),
    ('announcement_images_id_uidx','onpublic.announcement_imagesusingbtree(id)',true),
    ('announcement_images_storage_path_idx','onpublic.announcement_imagesusingbtree(storage_path)',false)
  ) as expected(index_name,definition_fragment,is_unique)
  loop
    select tablename, regexp_replace(lower(indexdef), '\s+', '', 'g')
      into existing_table, existing_def
    from pg_indexes where schemaname='public' and indexname=expected.index_name;
    if found then
      existing_unique := existing_def like 'createuniqueindex%';
      if existing_table <> 'announcement_images'
         or position(expected.definition_fragment in existing_def)=0
         or existing_unique is distinct from expected.is_unique then
        raise exception 'Existing public.% does not match the expected announcement_images index; inspect it before retrying.', expected.index_name;
      end if;
    end if;
  end loop;
end $$;

create unique index if not exists announcement_images_announcement_position_uidx
  on public.announcement_images (announcement_id, position);
create unique index if not exists announcement_images_id_uidx on public.announcement_images (id);
create index if not exists announcement_images_storage_path_idx on public.announcement_images (storage_path);

-- Backfill only canonical UUID identities. Invalid IDs/account references are
-- explicitly skipped with NOTICE; the original classroom_store JSON is retained.
do $$
declare
  source_value jsonb;
  item jsonb;
  raw_id text;
  item_count bigint := 0;
  skipped_ids bigint := 0;
begin
  if to_regclass('public.classroom_store') is null then
    raise notice 'classroom_store absent: announcements backfill skipped; source remains external';
    return;
  end if;
  select value into source_value from public.classroom_store where key='announcements';
  if source_value is null then
    raise notice 'classroom_store key announcements is absent; no legacy announcement rows copied';
    return;
  end if;
  if jsonb_typeof(source_value->'items') is distinct from 'array' then
    raise notice 'classroom_store.announcements.items is not an array; no legacy announcement rows copied';
    return;
  end if;

  for item in select value from jsonb_array_elements(source_value->'items') as x(value)
  loop
    item_count := item_count + 1;
    raw_id := nullif(btrim(item->>'id'), '');
    if jsonb_typeof(item) <> 'object' or raw_id is null
      or raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      skipped_ids := skipped_ids + 1;
      raise notice 'Skipped legacy announcement with missing/non-UUID id; original retained in classroom_store';
      continue;
    end if;

    begin
      insert into public.announcements (
        id, title, document_kind, short_id, content, notify_type, section,
        expires_at, created_at, created_by, created_by_name, source_homework_id,
        is_exam_reminder, is_system, hidden, hidden_at, hidden_by, hidden_by_name,
        subject_user_id, subject_user_name, from_level, to_level
      ) values (
        raw_id::uuid,
        coalesce(item->>'title', ''),
        case when item->>'document_kind' in ('thong_bao', 'bao_cao') then item->>'document_kind' else 'thong_bao' end,
        case when pg_input_is_valid(item->>'short_id', 'integer') and item->>'short_id' ~ '^[1-9][0-9]*$'
          then (item->>'short_id')::integer else null end,
        coalesce(item->>'content', ''),
        case when item->>'notify_type' in ('normal', 'hot', 'urgent') then item->>'notify_type' else 'normal' end,
        case when item->>'section' in ('main', 'important', 'discipline') then item->>'section' else 'main' end,
        case when pg_input_is_valid(item->>'expires_at', 'timestamptz') then (item->>'expires_at')::timestamptz else null end,
        case when pg_input_is_valid(item->>'created_at', 'timestamptz') then (item->>'created_at')::timestamptz else now() end,
        case when item->>'created_by' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (item->>'created_by')::uuid else null end,
        coalesce(nullif(btrim(item->>'created_by_name'), ''), 'Admin'),
        case when item->>'source_homework_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (item->>'source_homework_id')::uuid else null end,
        item->>'is_exam_reminder' = 'true',
        item->>'is_system' = 'true',
        item->>'hidden' = 'true',
        case when pg_input_is_valid(item->>'hidden_at', 'timestamptz') then (item->>'hidden_at')::timestamptz else null end,
        case when item->>'hidden_by' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (item->>'hidden_by')::uuid else null end,
        nullif(btrim(item->>'hidden_by_name'), ''),
        case when item->>'subject_user_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (item->>'subject_user_id')::uuid else null end,
        nullif(item->>'subject_user_name', ''), nullif(item->>'from_level', ''), nullif(item->>'to_level', '')
      ) on conflict (id) do nothing;
    exception when others then
      raise notice 'Skipped legacy announcement UUID % due to row constraint/data issue (%); source retained', raw_id, sqlerrm;
    end;
  end loop;
  raise notice 'Announcement backfill examined % rows; skipped % entries with missing/non-UUID IDs', item_count, skipped_ids;
end $$;

-- Image backfill is tied to valid UUID announcements only. The source image URL
-- remains in classroom_store; duplicate (announcement,position) pairs are ignored.
do $$
declare
  source_value jsonb;
  item jsonb;
  raw_id text;
  image_url text;
  image_position bigint;
begin
  if to_regclass('public.classroom_store') is null then return; end if;
  select value into source_value from public.classroom_store where key='announcements';
  if jsonb_typeof(source_value->'items') is distinct from 'array' then return; end if;

  for item in select value from jsonb_array_elements(source_value->'items') as x(value)
  loop
    raw_id := nullif(btrim(item->>'id'), '');
    if jsonb_typeof(item) <> 'object' or raw_id is null
      or raw_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      continue;
    end if;
    if not exists (select 1 from public.announcements a where a.id=raw_id::uuid) then
      continue;
    end if;

    for image_url, image_position in
      select value, ordinality from jsonb_array_elements_text(
        case when jsonb_typeof(item->'images')='array' then item->'images' else '[]'::jsonb end
      ) with ordinality
    loop
      if btrim(image_url) <> '' and image_position <= 2147483647 then
        insert into public.announcement_images(announcement_id, storage_path, public_url, position)
        values (
          raw_id::uuid,
          case when image_url like '%/announcement-images/%'
            then split_part(split_part(image_url, '/announcement-images/', 2), '?', 1) else null end,
          image_url,
          image_position::integer
        ) on conflict (announcement_id, position) do nothing;
      end if;
    end loop;
  end loop;
end $$;

alter table public.announcements enable row level security;
alter table public.announcement_images enable row level security;
revoke all on table public.announcements, public.announcement_images from public, anon, authenticated;
grant all on table public.announcements, public.announcement_images to service_role;
drop policy if exists announcements_no_client_access on public.announcements;
drop policy if exists announcement_images_no_client_access on public.announcement_images;

comment on table public.announcements is 'Normalized announcement records; existing UUID schema is retained and classroom_store.announcements remains an immutable migration source.';
comment on table public.announcement_images is 'Announcement image metadata; announcement_id is UUID and references announcements(id). Legacy text IDs, when present, are retained in announcement_id_legacy_text.';
notify pgrst, 'reload schema';

commit;
