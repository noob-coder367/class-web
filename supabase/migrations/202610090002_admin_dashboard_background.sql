-- Persist the admin dashboard background in a private bucket.
-- Client roles receive no table or Storage permissions; the backend service role
-- mediates every read, upload and delete after requireAdmin.
create table if not exists public.admin_dashboard_settings (
  id boolean primary key default true check (id),
  background_image_path text,
  updated_at timestamptz not null default now()
);
alter table public.admin_dashboard_settings enable row level security;
revoke all on table public.admin_dashboard_settings from anon, authenticated;
grant all on table public.admin_dashboard_settings to service_role;

insert into public.admin_dashboard_settings (id, background_image_path)
values (true, null)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-dashboard-assets',
  'admin-dashboard-assets',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do nothing;
