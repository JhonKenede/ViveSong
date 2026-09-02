alter table public.groups
add column if not exists archived_at timestamptz;

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

grant execute on function public.delete_group(uuid) to authenticated;
