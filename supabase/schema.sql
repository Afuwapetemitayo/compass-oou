-- Compass OOU: Supabase database (version 2).
-- Run once in Supabase > SQL Editor, then run seed.sql.

create extension if not exists pgcrypto;

create type place_category as enum ('Faculties','Departments','Halls','Offices','Library','Facilities','Buildings');

-- Places: every faculty, department, hall, office and facility.
create table places (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text unique not null,
  category place_category not null,
  type_label text,                    -- "Cafe centre", "Drop-off point" ...
  faculty text,                       -- for departments and faculties, e.g. "Social Sciences"
  aliases text[] not null default '{}',   -- FOS, FASA, SOSSA, ICT ...
  description text,
  note text,                          -- e.g. "Inside the Admin Block"
  lat double precision,
  lng double precision,
  location_source text check (location_source in ('gps','osm')),
  verified boolean not null default false,   -- true once checked on site
  photo_path text,                    -- file in the place-photos bucket
  sort_order int not null default 1000,
  is_live boolean generated always as (lat is not null and lng is not null) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  check (lat is null or (lat between 6.90 and 6.95 and lng between 3.85 and 3.89))
);
create index on places (category);
create index on places using gin (aliases);

-- Profiles: one per registered student (and you, the admin).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  faculty text,
  department_id uuid references places(id),   -- "My department"
  level text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

-- Pinned departments (a student can pin more than one).
create table user_pins (
  user_id uuid references auth.users(id) on delete cascade,
  place_id uuid references places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- One table for all analytics: visits, searches, directions.
create table events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('visit','search','place_view','directions_preview','directions_start','directions_done')),
  place_id uuid references places(id) on delete set null,
  query text,            -- search words
  results int,           -- how many results the search gave (0 = no result)
  mode text check (mode in ('walk','keke','car')),
  created_at timestamptz not null default now()
);
create index on events (type, created_at desc);

-- Helpers
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger places_touch before update on places for each row execute function touch_updated_at();

-- Create the profile automatically when someone signs up.
-- The sign-up form sends: full_name, faculty, department (e.g. "Economics"), level.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, faculty, department_id, level)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
    new.email,
    nullif(new.raw_user_meta_data->>'faculty',''),
    (select id from places where name = 'Department of ' || (new.raw_user_meta_data->>'department') limit 1),
    nullif(new.raw_user_meta_data->>'level','')
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Row level security: signed-in students read; only you write.
alter table places enable row level security;
alter table profiles enable row level security;
alter table user_pins enable row level security;
alter table events enable row level security;

create policy "signed-in read places" on places for select to authenticated using (true);
create policy "admin writes places" on places for all to authenticated using (is_admin()) with check (is_admin());

create policy "own profile read" on profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy "own profile update" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

create policy "own pins" on user_pins for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "log own events" on events for insert to authenticated with check (user_id = auth.uid());
create policy "admin reads events" on events for select to authenticated using (is_admin());

-- Photos bucket (public read so images load fast; only admin uploads).
insert into storage.buckets (id, name, public) values ('place-photos','place-photos', true) on conflict do nothing;
create policy "photos public read" on storage.objects for select using (bucket_id = 'place-photos');
create policy "admin uploads photos" on storage.objects for insert to authenticated with check (bucket_id = 'place-photos' and is_admin());
create policy "admin edits photos" on storage.objects for update to authenticated using (bucket_id = 'place-photos' and is_admin());
create policy "admin deletes photos" on storage.objects for delete to authenticated using (bucket_id = 'place-photos' and is_admin());

-- Admin overview numbers in one call: select admin_stats(7);
create or replace function admin_stats(days int default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'admins only'; end if;
  select jsonb_build_object(
    'users_total', (select count(*) from profiles where role = 'student'),
    'users_new', (select count(*) from profiles where role='student' and created_at > now() - make_interval(days => days)),
    'visits', (select count(*) from events where type='visit' and created_at > now() - make_interval(days => days)),
    'visitors', (select count(distinct user_id) from events where type='visit' and created_at > now() - make_interval(days => days)),
    'places_live', (select count(*) from places where is_live),
    'places_total', (select count(*) from places),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'visits', c) order by d), '[]'::jsonb)
              from (select date_trunc('day', created_at)::date d, count(*) c from events
                    where type='visit' and created_at > now() - make_interval(days => days) group by 1) x),
    'by_faculty', (select coalesce(jsonb_agg(jsonb_build_object('faculty', faculty, 'users', c) order by c desc), '[]'::jsonb)
              from (select faculty, count(*) c from profiles where role='student' and faculty is not null group by 1) x),
    'top_places', (select coalesce(jsonb_agg(jsonb_build_object('place', n, 'count', c) order by c desc), '[]'::jsonb)
              from (select p.name n, count(*) c from events e join places p on p.id = e.place_id
                    where e.type in ('place_view','directions_start') and e.created_at > now() - make_interval(days => days)
                    group by 1 order by 2 desc limit 8) x),
    'no_result_searches', (select coalesce(jsonb_agg(jsonb_build_object('query', q, 'count', c) order by c desc), '[]'::jsonb)
              from (select lower(query) q, count(*) c from events where type='search' and results = 0
                    and created_at > now() - make_interval(days => days) group by 1 order by 2 desc limit 8) x),
    'modes', (select coalesce(jsonb_agg(jsonb_build_object('mode', mode, 'count', c)), '[]'::jsonb)
              from (select mode, count(*) c from events where type='directions_start'
                    and created_at > now() - make_interval(days => days) group by 1) x)
  ) into r;
  return r;
end $$;

-- After you sign up yourself once, make your account the admin:
--   update profiles set role = 'admin' where email = 'temmyteegraphic@gmail.com';
