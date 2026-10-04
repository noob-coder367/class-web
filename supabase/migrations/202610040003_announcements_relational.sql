-- Relational announcements storage.
-- The legacy classroom_store row is intentionally read-only here: this migration
-- never updates or deletes classroom_store (or the original Storage JSON file).

create table if not exists public.announcements (
  id text primary key check (char_length(trim(id)) between 1 and 200),
  title text not null default '',
  document_kind text not null default 'thong_bao' check (document_kind in ('thong_bao', 'bao_cao')),
  short_id integer check (short_id is null or short_id > 0),
  content text not null default '',
  notify_type text not null default 'normal' check (notify_type in ('normal', 'hot', 'urgent')),
  section text not null default 'main' check (section in ('main', 'important', 'discipline')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text,
  created_by_name text not null default 'Admin',
  source_homework_id text,
  is_exam_reminder boolean not null default false,
  is_system boolean not null default false,
  hidden boolean not null default false,
  hidden_at timestamptz,
  hidden_by text,
  hidden_by_name text,
  subject_user_id text,
  subject_user_name text,
  from_level text,
  to_level text
);

-- Keep this migration safe if an early/manual installation already created the
-- table with only part of the shape above.
alter table public.announcements add column if not exists title text;
alter table public.announcements add column if not exists document_kind text;
alter table public.announcements add column if not exists short_id integer;
alter table public.announcements add column if not exists content text;
alter table public.announcements add column if not exists notify_type text;
alter table public.announcements add column if not exists section text;
alter table public.announcements add column if not exists expires_at timestamptz;
alter table public.announcements add column if not exists created_at timestamptz;
alter table public.announcements add column if not exists created_by text;
alter table public.announcements add column if not exists created_by_name text;
alter table public.announcements add column if not exists source_homework_id text;
alter table public.announcements add column if not exists is_exam_reminder boolean;
alter table public.announcements add column if not exists is_system boolean;
alter table public.announcements add column if not exists hidden boolean;
alter table public.announcements add column if not exists hidden_at timestamptz;
alter table public.announcements add column if not exists hidden_by text;
alter table public.announcements add column if not exists hidden_by_name text;
alter table public.announcements add column if not exists subject_user_id text;
alter table public.announcements add column if not exists subject_user_name text;
alter table public.announcements add column if not exists from_level text;
alter table public.announcements add column if not exists to_level text;

-- Normalize nulls from a possible pre-existing table before applying defaults.
update public.announcements set title = '' where title is null;
update public.announcements set document_kind = 'thong_bao' where document_kind is null or document_kind not in ('thong_bao', 'bao_cao');
update public.announcements set content = '' where content is null;
update public.announcements set notify_type = 'normal' where notify_type is null or notify_type not in ('normal', 'hot', 'urgent');
update public.announcements set section = 'main' where section is null or section not in ('main', 'important', 'discipline');
update public.announcements set created_at = now() where created_at is null;
update public.announcements set created_by_name = 'Admin' where created_by_name is null or btrim(created_by_name) = '';
update public.announcements set is_exam_reminder = false where is_exam_reminder is null;
update public.announcements set is_system = false where is_system is null;
update public.announcements set hidden = false where hidden is null;

alter table public.announcements alter column title set default '';
alter table public.announcements alter column title set not null;
alter table public.announcements alter column document_kind set default 'thong_bao';
alter table public.announcements alter column document_kind set not null;
alter table public.announcements alter column content set default '';
alter table public.announcements alter column content set not null;
alter table public.announcements alter column notify_type set default 'normal';
alter table public.announcements alter column notify_type set not null;
alter table public.announcements alter column section set default 'main';
alter table public.announcements alter column section set not null;
alter table public.announcements alter column created_at set default now();
alter table public.announcements alter column created_at set not null;
alter table public.announcements alter column created_by_name set default 'Admin';
alter table public.announcements alter column created_by_name set not null;
alter table public.announcements alter column is_exam_reminder set default false;
alter table public.announcements alter column is_exam_reminder set not null;
alter table public.announcements alter column is_system set default false;
alter table public.announcements alter column is_system set not null;
alter table public.announcements alter column hidden set default false;
alter table public.announcements alter column hidden set not null;

do $$
begin
  begin alter table public.announcements add constraint announcements_document_kind_chk check (document_kind in ('thong_bao', 'bao_cao')); exception when duplicate_object then null; end;
  begin alter table public.announcements add constraint announcements_notify_type_chk check (notify_type in ('normal', 'hot', 'urgent')); exception when duplicate_object then null; end;
  begin alter table public.announcements add constraint announcements_section_chk check (section in ('main', 'important', 'discipline')); exception when duplicate_object then null; end;
  begin alter table public.announcements add constraint announcements_short_id_chk check (short_id is null or short_id > 0); exception when duplicate_object then null; end;
end $$;

create index if not exists announcements_created_at_idx on public.announcements (created_at desc);
create index if not exists announcements_visible_idx on public.announcements (hidden, expires_at, created_at desc);
create index if not exists announcements_archive_section_idx on public.announcements (section, hidden, created_at desc);
create index if not exists announcements_homework_idx on public.announcements (source_homework_id, is_exam_reminder);
create index if not exists announcements_short_id_idx on public.announcements (document_kind, short_id);

create table if not exists public.announcement_images (
  id uuid primary key default gen_random_uuid(),
  announcement_id text not null references public.announcements(id) on delete cascade,
  storage_path text,
  public_url text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes > 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

alter table public.announcement_images add column if not exists storage_path text;
alter table public.announcement_images add column if not exists public_url text;
alter table public.announcement_images add column if not exists mime_type text;
alter table public.announcement_images add column if not exists size_bytes bigint;
alter table public.announcement_images add column if not exists position integer;
alter table public.announcement_images add column if not exists created_at timestamptz;
update public.announcement_images set public_url = '' where public_url is null;
update public.announcement_images set position = 0 where position is null;
update public.announcement_images set created_at = now() where created_at is null;
alter table public.announcement_images alter column public_url set not null;
alter table public.announcement_images alter column position set default 0;
alter table public.announcement_images alter column position set not null;
alter table public.announcement_images alter column created_at set default now();
alter table public.announcement_images alter column created_at set not null;

create index if not exists announcement_images_announcement_idx
  on public.announcement_images (announcement_id, position, created_at);
create index if not exists announcement_images_storage_path_idx
  on public.announcement_images (storage_path);

-- Backfill exactly the key used by announcements.service.js. Invalid/partial
-- legacy fields receive the same defaults as the service normalizer.
do $$
begin
  if to_regclass('public.classroom_store') is not null then
    insert into public.announcements (
      id, title, document_kind, short_id, content, notify_type, section,
      expires_at, created_at, created_by, created_by_name, source_homework_id,
      is_exam_reminder, is_system, hidden, hidden_at, hidden_by, hidden_by_name,
      subject_user_id, subject_user_name, from_level, to_level
    )
    select
      nullif(btrim(item->>'id'), ''),
      coalesce(item->>'title', ''),
      case when item->>'document_kind' in ('thong_bao', 'bao_cao') then item->>'document_kind' else 'thong_bao' end,
      case when item->>'short_id' ~ '^[1-9][0-9]*$' then (item->>'short_id')::integer else null end,
      coalesce(item->>'content', ''),
      case when item->>'notify_type' in ('normal', 'hot', 'urgent') then item->>'notify_type' else 'normal' end,
      case when item->>'section' in ('main', 'important', 'discipline') then item->>'section' else 'main' end,
      case when item->>'expires_at' ~ '^[-0-9T:.+ Z]+$' then (item->>'expires_at')::timestamptz else null end,
      case when item->>'created_at' ~ '^[-0-9T:.+ Z]+$' then (item->>'created_at')::timestamptz else now() end,
      nullif(item->>'created_by', ''),
      coalesce(nullif(btrim(item->>'created_by_name'), ''), 'Admin'),
      nullif(item->>'source_homework_id', ''),
      item->>'is_exam_reminder' = 'true',
      item->>'is_system' = 'true',
      item->>'hidden' = 'true',
      case when item->>'hidden_at' ~ '^[-0-9T:.+ Z]+$' then (item->>'hidden_at')::timestamptz else null end,
      nullif(item->>'hidden_by', ''),
      nullif(btrim(item->>'hidden_by_name'), ''),
      nullif(item->>'subject_user_id', ''),
      nullif(item->>'subject_user_name', ''),
      nullif(item->>'from_level', ''),
      nullif(item->>'to_level', '')
    from public.classroom_store store
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(store.value->'items') = 'array' then store.value->'items' else '[]'::jsonb end
    ) item
    where store.key = 'announcements'
      and nullif(btrim(item->>'id'), '') is not null
    on conflict (id) do nothing;

    insert into public.announcement_images (announcement_id, storage_path, public_url, mime_type, size_bytes, position)
    select a.id,
      case when image_url like '%/announcement-images/%'
        then split_part(split_part(image_url, '/announcement-images/', 2), '?', 1)
        else null end,
      image_url,
      null,
      null,
      image_position
    from public.classroom_store store
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(store.value->'items') = 'array' then store.value->'items' else '[]'::jsonb end
    ) item
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(item->'images') = 'array' then item->'images' else '[]'::jsonb end
    ) with ordinality image(image_url, image_position)
    join public.announcements a on a.id = nullif(btrim(item->>'id'), '')
    where store.key = 'announcements'
      and btrim(image_url) <> ''
      and not exists (
        select 1 from public.announcement_images existing
        where existing.announcement_id = a.id
          and existing.position = image_position
      )
    on conflict do nothing;
  end if;
end $$;

alter table public.announcements enable row level security;
alter table public.announcement_images enable row level security;
revoke all on table public.announcements, public.announcement_images from public, anon, authenticated;
grant all on table public.announcements, public.announcement_images to service_role;
drop policy if exists announcements_no_client_access on public.announcements;
drop policy if exists announcement_images_no_client_access on public.announcement_images;

comment on table public.announcements is 'Normalized announcement records; legacy classroom_store.announcements is retained as an immutable migration source.';
comment on table public.announcement_images is 'Announcement image metadata; public_url preserves the announcement DTO while storage details remain relational.';
notify pgrst, 'reload schema';
