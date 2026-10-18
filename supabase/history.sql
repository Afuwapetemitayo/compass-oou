-- Update 3: place history. Run once in Supabase > SQL Editor.
alter table places add column if not exists history text;
