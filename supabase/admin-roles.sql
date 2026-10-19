-- Update 9: let an admin make someone else an admin (or remove them) from the app.
-- Run once in Supabase > SQL Editor.
create or replace function set_user_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can change roles'; end if;
  if new_role not in ('student', 'admin') then raise exception 'Invalid role'; end if;
  if target = auth.uid() then raise exception 'You cannot change your own role'; end if;
  update profiles set role = new_role where id = target;
  if not found then raise exception 'That person has no profile yet. They need to sign up first.'; end if;
end $$;
revoke all on function set_user_role(uuid, text) from public;
grant execute on function set_user_role(uuid, text) to authenticated;
