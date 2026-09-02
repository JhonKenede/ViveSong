grant usage on schema public to authenticated;

grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.songs to authenticated;
grant select, insert, update, delete on public.setlists to authenticated;
grant select, insert, update, delete on public.setlist_songs to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.ensure_default_group(text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.has_group_role(uuid, public.group_role[]) to authenticated;
