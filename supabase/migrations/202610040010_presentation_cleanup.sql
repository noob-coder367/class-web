-- MANUAL, OPTIONAL CLEANUP — run only after reviewing legacy presentation data and taking a backup.
-- No Presentation schema/migration exists in this repository. This script targets only the
-- two conventional exact table names and intentionally does not touch Storage or other tables.
-- First inspect whether these objects exist and whether they contain data:
select to_regclass('public.presentation_slides') as presentation_slides_table,
       to_regclass('public.presentations') as presentations_table;

-- If these tables exist and their data has been archived / is approved for removal,
-- uncomment and execute the statements below in dependency order. This destructive step is
-- separate from application deployment; do not run blindly on production.
-- drop table if exists public.presentation_slides;
-- drop table if exists public.presentations;

-- Storage files are intentionally retained. Inspect the existing bucket's objects under
-- any known Presentation-specific prefix and remove them manually only after an explicit
-- data-retention decision. This script does not delete production objects.
