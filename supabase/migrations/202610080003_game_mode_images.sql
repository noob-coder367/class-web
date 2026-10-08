-- Persist one public cover image per implemented Game Mode.
create table if not exists public.game_mode_images (
  game_key text primary key check (game_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(game_key) <= 64),
  image_path text not null,
  updated_at timestamptz not null default now()
);

alter table public.game_mode_images enable row level security;
revoke all on table public.game_mode_images from anon, authenticated;
grant select on table public.game_mode_images to anon, authenticated;
grant all on table public.game_mode_images to service_role;

create policy "Game Mode images are readable by everyone"
  on public.game_mode_images
  for select
  to anon, authenticated
  using (true);

create or replace function public.touch_game_mode_image_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger game_mode_images_touch_updated_at
  before update on public.game_mode_images
  for each row execute function public.touch_game_mode_image_updated_at();

-- Public bucket means anyone may fetch a known image URL. Upload/delete continue
-- through the server-only service-role API; existing storage.objects deny policies
-- remain unchanged, so ordinary clients cannot write or enumerate objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-images',
  'game-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do nothing;
