create or replace function public.create_group(group_name text)
returns table (group_id uuid, role public.group_role, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_group_id uuid;
  clean_group_name text := nullif(trim(group_name), '');
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if clean_group_name is null or char_length(clean_group_name) < 2 or char_length(clean_group_name) > 80 then
    raise exception 'Group name must be between 2 and 80 characters';
  end if;

  insert into public.groups (name, owner_id)
  values (clean_group_name, current_user_id)
  returning id into new_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (new_group_id, current_user_id, 'admin');

  return query
  select g.id, gm.role, g.invite_code
  from public.groups g
  join public.group_members gm on gm.group_id = g.id and gm.user_id = current_user_id
  where g.id = new_group_id;
end;
$$;

grant execute on function public.create_group(text) to authenticated;
