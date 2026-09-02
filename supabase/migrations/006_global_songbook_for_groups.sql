drop policy if exists "members can read songs" on public.songs;
create policy "members can read songs" on public.songs
for select using (auth.uid() is not null);

drop policy if exists "editors can manage setlist songs" on public.setlist_songs;
create policy "editors can manage setlist songs" on public.setlist_songs
for all using (
  exists (
    select 1 from public.setlists s
    where s.id = setlist_songs.setlist_id
      and public.has_group_role(s.group_id, array['admin','editor']::public.group_role[])
  )
)
with check (
  exists (
    select 1 from public.setlists s
    where s.id = setlist_songs.setlist_id
      and public.has_group_role(s.group_id, array['admin','editor']::public.group_role[])
      and exists (
        select 1
        from public.songs so
        where so.id = setlist_songs.song_id
      )
  )
);
