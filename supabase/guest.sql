-- Guest mode: anyone can open the map, directory and directions without signing in.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Places and shortcut paths are public campus information, so they can be read by anyone.
-- Nobody can change them without being an admin (those policies are unchanged).

drop policy if exists "anyone reads places" on places;
create policy "anyone reads places" on places for select to anon using (true);
grant select on public.places to anon;

drop policy if exists "anyone reads paths" on paths;
create policy "anyone reads paths" on paths for select to anon using (true);
grant select on public.paths to anon;

-- Guests may add anonymous usage events (no name or email, only the random phone id):
-- visits, searches and directions, so the admin Overview can count guest use too.
drop policy if exists "anyone logs landing" on events;
create policy "anyone logs landing" on events for insert to anon, authenticated
  with check (
    user_id is null and vid is not null and
    type in ('landing','install_click','installed','search','place_view','directions_preview','directions_start','directions_done')
  );
