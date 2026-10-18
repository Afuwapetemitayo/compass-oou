-- Update 4: "Coming to OOU?" guide. Run once in Supabase > SQL Editor.
create table if not exists arrival_tips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);
alter table arrival_tips enable row level security;
drop policy if exists "signed-in read tips" on arrival_tips;
drop policy if exists "admin writes tips" on arrival_tips;
create policy "signed-in read tips" on arrival_tips for select to authenticated using (true);
create policy "admin writes tips" on arrival_tips for all to authenticated using (is_admin()) with check (is_admin());

-- Guide text for new students. Edit any of it later from Admin > Arrival.
delete from arrival_tips;
insert into arrival_tips (title, body, sort_order) values
  ('Where you get dropped depends on where you come from', 'Coming from Lagos by the normal route, the vehicle usually drops you at the school gate. From other places, some vehicles drop you at a junction in Ago-Iwoye. Ask the driver or other passengers where you will get down, and tell them you are going to OOU.', 10),
  ('If you are dropped at a junction', 'Take a cab or the school bus that goes inside the school. It will drop you at School Park, the main drop-off point. Say where you are going so the driver knows where to stop.', 20),
  ('If you take a bike or reach the school gate', 'A bike drops you at the school gate. From the gate, take a keke napep going inside the school and tell the rider exactly where you are going.', 30),
  ('If you are coming from a street or hostel area', 'Each street around Ago-Iwoye has buses that take students to School Park. Ask your neighbours or other students which bus to join from your street.', 40),
  ('Stay safe', 'Keep your phone, money and admission documents close. Agree the fare before you get in. If you are lost, ask a student or a security officer.', 50);
