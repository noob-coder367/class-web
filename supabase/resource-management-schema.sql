-- Resource Management is isolated from classroom_store.
-- Run this script once in Supabase SQL Editor.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.resource_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS resource_categories_name_lower_idx ON public.resource_categories (lower(name));

CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES public.resource_categories(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resources_category_idx ON public.resources (category_id);
CREATE INDEX IF NOT EXISTS resources_created_at_idx ON public.resources (created_at DESC);

CREATE TABLE IF NOT EXISTS public.resource_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 52428800),
  file_type TEXT NOT NULL CHECK (file_type IN ('file', 'image')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resource_files_resource_idx ON public.resource_files (resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS resource_files_type_idx ON public.resource_files (file_type);

ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resource_categories FROM anon, authenticated;
REVOKE ALL ON public.resources FROM anon, authenticated;
REVOKE ALL ON public.resource_files FROM anon, authenticated;
DROP POLICY IF EXISTS resource_categories_no_direct_client ON public.resource_categories;
DROP POLICY IF EXISTS resources_no_direct_client ON public.resources;
DROP POLICY IF EXISTS resource_files_no_direct_client ON public.resource_files;
CREATE POLICY resource_categories_no_direct_client ON public.resource_categories FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY resources_no_direct_client ON public.resources FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY resource_files_no_direct_client ON public.resource_files FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

INSERT INTO storage.buckets (id, name, public)
VALUES ('classroom-resources', 'classroom-resources', false)
ON CONFLICT (id) DO UPDATE SET public = false;
DROP POLICY IF EXISTS resource_storage_no_direct_read ON storage.objects;
DROP POLICY IF EXISTS resource_storage_no_direct_insert ON storage.objects;
DROP POLICY IF EXISTS resource_storage_no_direct_update ON storage.objects;
DROP POLICY IF EXISTS resource_storage_no_direct_delete ON storage.objects;
CREATE POLICY resource_storage_no_direct_read ON storage.objects FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY resource_storage_no_direct_insert ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY resource_storage_no_direct_update ON storage.objects FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY resource_storage_no_direct_delete ON storage.objects FOR DELETE TO anon, authenticated USING (false);
