-- Usage numbers for the admin Overview: visits (including people who have not signed up),
-- sign-ups, active users, installs, top searches.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table events add column if not exists vid text;          -- random anonymous id of the phone/browser, no name or email

alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check check (type in
  ('visit','search','place_view','directions_preview','directions_start','directions_done','landing','install_click','installed'));

-- anyone (even before signing in) may add a landing / install event, nothing else
drop policy if exists "anyone logs landing" on events;
create policy "anyone logs landing" on events for insert to anon, authenticated
  with check (user_id is null and type in ('landing','install_click','installed'));

grant insert on public.events to anon;
grant usage, select on sequence public.events_id_seq to anon, authenticated;
create index if not exists events_vid_idx on events (vid, created_at desc);

create or replace function admin_stats(days int default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; since timestamptz := now() - make_interval(days => days); tz text := 'Africa/Lagos';
begin
  if not is_admin() then raise exception 'admins only'; end if;
  select jsonb_build_object(
    'users_total',   (select count(*) from profiles where role = 'student'),
    'users_done',    (select count(*) from profiles where role = 'student' and faculty is not null and faculty <> '' and department_id is not null and level is not null and level <> ''),
    'users_new',     (select count(*) from profiles where role = 'student' and created_at > since),
    'signups_today', (select count(*) from profiles where role='student' and (created_at at time zone tz)::date = (now() at time zone tz)::date),
    'visits_today',  (select count(*) from events where type='landing' and (created_at at time zone tz)::date = (now() at time zone tz)::date),
    'visitors_today',(select count(distinct vid) from events where type='landing' and (created_at at time zone tz)::date = (now() at time zone tz)::date),
    'visits',        (select count(*) from events where type='landing' and created_at > since),
    'visitors',      (select count(distinct vid) from events where type='landing' and created_at > since),
    'returning',     (select count(*) from (select vid from events where type='landing' and created_at > since group by vid
                        having count(distinct (created_at at time zone tz)::date) >= 2) x),
    'active',        (select count(*) from profiles where role='student' and last_seen_at > since),
    'installs',      (select count(distinct vid) from events where type='installed' and created_at > since),
    'install_clicks',(select count(*) from events where type='install_click' and created_at > since),
    'tracking_since',(select min(created_at) from events where type='landing'),
    'places_live', (select count(*) from places where is_live),
    'places_total', (select count(*) from places),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'visits', v, 'visitors', u, 'signups', s) order by d), '[]'::jsonb)
              from (select d::date d,
                      (select count(*) from events e where e.type='landing' and (e.created_at at time zone tz)::date = d::date) v,
                      (select count(distinct e.vid) from events e where e.type='landing' and (e.created_at at time zone tz)::date = d::date) u,
                      (select count(*) from profiles p where p.role='student' and (p.created_at at time zone tz)::date = d::date) s
                    from generate_series(((now() at time zone tz)::date - (least(days, 60) - 1)), (now() at time zone tz)::date, interval '1 day') d) x),
    'by_faculty', (select coalesce(jsonb_agg(jsonb_build_object('faculty', faculty, 'users', c) order by c desc), '[]'::jsonb)
              from (select faculty, count(*) c from profiles where role='student' and faculty is not null and faculty <> '' group by 1) x),
    'top_places', (select coalesce(jsonb_agg(jsonb_build_object('place', n, 'count', c) order by c desc), '[]'::jsonb)
              from (select p.name n, count(*) c from events e join places p on p.id = e.place_id
                    where e.type in ('place_view','directions_start') and e.created_at > since group by 1 order by 2 desc limit 10) x),
    'top_searches', (select coalesce(jsonb_agg(jsonb_build_object('query', q, 'count', c) order by c desc), '[]'::jsonb)
              from (select lower(trim(query)) q, count(*) c from events where type='search' and query is not null and trim(query) <> ''
                    and created_at > since group by 1 order by 2 desc limit 10) x),
    'no_result_searches', (select coalesce(jsonb_agg(jsonb_build_object('query', q, 'count', c) order by c desc), '[]'::jsonb)
              from (select lower(trim(query)) q, count(*) c from events where type='search' and results = 0
                    and created_at > since group by 1 order by 2 desc limit 10) x),
    'modes', (select coalesce(jsonb_agg(jsonb_build_object('mode', mode, 'count', c)), '[]'::jsonb)
              from (select mode, count(*) c from events where type='directions_start' and created_at > since group by 1) x)
  ) into r;
  return r;
end $$;
