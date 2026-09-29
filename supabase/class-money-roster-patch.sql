-- Class Money: allow students without accounts + keep PDF STT
-- Chạy một lần trong Supabase SQL Editor trên database đã có schema class-money-schema.sql.

ALTER TABLE public.class_money_collection_members
  ALTER COLUMN profile_id DROP NOT NULL;

ALTER TABLE public.class_money_collection_members
  DROP CONSTRAINT IF EXISTS class_money_collection_members_collection_id_profile_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS class_money_collection_members_profile_uidx
  ON public.class_money_collection_members (collection_id, profile_id)
  WHERE profile_id IS NOT NULL;

ALTER TABLE public.class_money_collection_members
  ADD COLUMN IF NOT EXISTS student_number integer;

ALTER TABLE public.class_money_collection_members
  DROP CONSTRAINT IF EXISTS class_money_collection_members_student_number_check;

ALTER TABLE public.class_money_collection_members
  ADD CONSTRAINT class_money_collection_members_student_number_check
  CHECK (student_number IS NULL OR student_number > 0);

CREATE UNIQUE INDEX IF NOT EXISTS class_money_collection_members_stt_uidx
  ON public.class_money_collection_members (collection_id, student_number)
  WHERE student_number IS NOT NULL;
