-- Update 7: each place can have an area (circle) instead of just a point. Run once in Supabase > SQL Editor.
alter table places add column if not exists radius_m int check (radius_m between 5 and 500);
