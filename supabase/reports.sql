-- Compass OOU: "Report a problem" (run once in Supabase > SQL Editor, after schema.sql)
create table reports (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete set null,
  place_id uuid references places(id) on delete set null,
  place_name text,
  message text not null check (char_length(message) between 3 and 1000),
  page text,
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now()
);
create index on reports (status, created_at desc);
alter table reports enable row level security;
create policy "students send reports" on reports for insert to authenticated with check (user_id = auth.uid());
create policy "admin reads reports" on reports for select to authenticated using (is_admin());
create policy "admin updates reports" on reports for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin deletes reports" on reports for delete to authenticated using (is_admin());
