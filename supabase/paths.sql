-- Update 8: recorded shortcuts (footpaths) and the main gate. Run once in Supabase > SQL Editor.
create table if not exists paths (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points jsonb not null,            -- [[lat, lng], ...] in walking order
  created_at timestamptz not null default now()
);
alter table paths enable row level security;
drop policy if exists "signed-in read paths" on paths;
drop policy if exists "admin writes paths" on paths;
create policy "signed-in read paths" on paths for select to authenticated using (true);
create policy "admin writes paths" on paths for all to authenticated using (is_admin()) with check (is_admin());

-- The main gate, captured on site (accuracy 2 m).
insert into places (slug, name, category, type_label, aliases, note, lat, lng, location_source, verified)
values ('oou-main-gate', 'OOU Main Gate', 'Facilities', 'Main gate', '{School gate}', 'Main entrance of the university', 6.935759, 3.879243, 'gps', true)
on conflict (name) do update set lat = excluded.lat, lng = excluded.lng, location_source = 'gps', verified = true, type_label = 'Main gate';
