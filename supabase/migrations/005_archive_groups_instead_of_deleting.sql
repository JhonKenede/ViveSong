alter table public.groups
add column if not exists archived_at timestamptz;

create or replace function public.ensure_default_group(group_name text default 'ViveSong')
returns table (group_id uuid, role public.group_role, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select gm.group_id, gm.role, g.invite_code
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.user_id = current_user_id
    and g.archived_at is null
  order by gm.created_at asc
  limit 1;

  if found then
    return;
  end if;

  insert into public.groups (name, owner_id)
  values (coalesce(nullif(trim(group_name), ''), 'ViveSong'), current_user_id)
  returning id, groups.invite_code into group_id, invite_code;

  insert into public.group_members (group_id, user_id, role)
  values (group_id, current_user_id, 'admin');

  role := 'admin';
  return next;
end;
$$;

create or replace function public.join_group_by_code(code text)
returns table (group_id uuid, role public.group_role, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_group_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select g.id into target_group_id
  from public.groups g
  where upper(g.invite_code) = upper(trim(code))
    and g.archived_at is null;

  if target_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group_id, current_user_id, 'musician')
  on conflict (group_id, user_id) do nothing;

  return query
  select gm.group_id, gm.role, g.invite_code
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.group_id = target_group_id
    and gm.user_id = current_user_id;
end;
$$;

create or replace function public.delete_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = current_user_id
      and gm.role = 'admin'
  ) then
    raise exception 'Only group admins can delete this group';
  end if;

  update public.groups g
  set archived_at = coalesce(g.archived_at, now())
  where g.id = target_group_id;
end;
$$;

grant execute on function public.ensure_default_group(text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
