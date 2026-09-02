import type { GroupRole, MusicalKey, Setlist, SetlistItem, Song, UserSession } from '../types';
import { supabase } from './supabaseClient';

export interface WorkspaceSession extends UserSession {
  inviteCode: string;
}

export interface WorkspaceSummary extends WorkspaceSession {
  name: string;
}

interface SongRow {
  id: string;
  group_id: string;
  title: string;
  artist: string;
  original_key: MusicalKey;
  song_key: MusicalKey;
  tempo: number;
  time_signature: string;
  tags: string[];
  notes: string;
  chord_pro: string;
  duration_seconds: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface SetlistRow {
  id: string;
  group_id: string;
  name: string;
  event_date: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  setlist_songs?: SetlistSongRow[];
}

interface SetlistSongRow {
  song_id: string;
  position: number;
  performance_key: MusicalKey | null;
  notes: string | null;
}

interface MembershipRow {
  group_id: string;
  role: GroupRole;
  groups:
    | {
        name: string;
        invite_code: string;
      }
    | Array<{
        name: string;
        invite_code: string;
      }>;
}

export async function getCurrentAuthUser() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function hasStoredAuthSession() {
  if (!supabase) return false;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return false;

  const { error: userError } = await supabase.auth.getUser();
  if (!userError) return true;

  if (isMissingAuthUserError(userError.message)) {
    await supabase.auth.signOut({ scope: 'local' });
    return false;
  }

  throw userError;
}

export async function signInWithPassword(email: string, password: string) {
  assertSupabase();
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword(email: string, password: string) {
  assertSupabase();
  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  assertSupabase();
  const { error } = await supabase!.auth.signOut();
  if (error) throw error;
}

export async function ensureWorkspace(groupName = 'ViveSong'): Promise<WorkspaceSession> {
  assertSupabase();
  const user = await getCurrentAuthUser();
  if (!user) throw new Error('Inicia sesion para usar Supabase.');

  const { data, error } = await supabase!.rpc('ensure_default_group', { group_name: groupName });
  if (error) throw error;
  const workspace = firstRpcRow(data);
  return {
    userId: user.id,
    groupId: workspace.group_id,
    role: workspace.role,
    inviteCode: workspace.invite_code,
  };
}

export async function joinWorkspaceByCode(code: string): Promise<WorkspaceSession> {
  assertSupabase();
  const user = await getCurrentAuthUser();
  if (!user) throw new Error('Inicia sesion para unirte a un grupo.');

  const { data, error } = await supabase!.rpc('join_group_by_code', { code });
  if (error) throw error;
  const workspace = firstRpcRow(data);
  return {
    userId: user.id,
    groupId: workspace.group_id,
    role: workspace.role,
    inviteCode: workspace.invite_code,
  };
}

export async function listUserWorkspaces(): Promise<WorkspaceSummary[]> {
  assertSupabase();
  const user = await getCurrentAuthUser();
  if (!user) throw new Error('Inicia sesion para ver tus grupos.');

  const { data, error } = await supabase!
    .from('group_members')
    .select('group_id, role, groups(name, invite_code)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as MembershipRow[]).map((membership) => {
    const group = Array.isArray(membership.groups) ? membership.groups[0] : membership.groups;
    return {
      userId: user.id,
      groupId: membership.group_id,
      role: membership.role,
      name: group?.name ?? 'Grupo',
      inviteCode: group?.invite_code ?? '',
    };
  });
}

export async function fetchWorkspaceData(groupId: string): Promise<{ songs: Song[]; setlists: Setlist[] }> {
  assertSupabase();
  const [songsResult, setlistsResult] = await Promise.all([
    supabase!.from('songs').select('*').eq('group_id', groupId).order('updated_at', { ascending: false }),
    supabase!
      .from('setlists')
      .select('*, setlist_songs(song_id, position, performance_key, notes)')
      .eq('group_id', groupId)
      .order('event_date', { ascending: false }),
  ]);

  if (songsResult.error) throw songsResult.error;
  if (setlistsResult.error) throw setlistsResult.error;

  return {
    songs: ((songsResult.data ?? []) as SongRow[]).map(songFromRow),
    setlists: ((setlistsResult.data ?? []) as SetlistRow[]).map(setlistFromRow),
  };
}

export async function upsertSong(song: Song): Promise<void> {
  assertSupabase();
  const { error } = await supabase!.from('songs').upsert(songToRow(song));
  if (error) throw error;
}

export async function deleteSongRemote(songId: string): Promise<void> {
  assertSupabase();
  const { error } = await supabase!.from('songs').delete().eq('id', songId);
  if (error) throw error;
}

export async function upsertSetlist(setlist: Setlist): Promise<void> {
  assertSupabase();
  const setlistRow = setlistToRow(setlist);
  const { error: setlistError } = await supabase!.from('setlists').upsert(setlistRow);
  if (setlistError) throw setlistError;

  const { error: deleteItemsError } = await supabase!.from('setlist_songs').delete().eq('setlist_id', setlist.id);
  if (deleteItemsError) throw deleteItemsError;

  if (setlist.items.length === 0) return;

  const rows = setlist.items.map((item, position) => setlistItemToRow(setlist.id, item, position));
  const { error: itemError } = await supabase!.from('setlist_songs').insert(rows);
  if (itemError) throw itemError;
}

function assertSupabase(): void {
  if (!supabase) throw new Error('Supabase no esta configurado.');
}

function isMissingAuthUserError(message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('user from sub claim') ||
    (normalizedMessage.includes('jwt') && normalizedMessage.includes('does not exist'))
  );
}

function firstRpcRow(data: unknown): { group_id: string; role: GroupRole; invite_code: string } {
  const rows = Array.isArray(data) ? data : [];
  const row = rows[0] as { group_id?: string; role?: GroupRole; invite_code?: string } | undefined;
  if (!row?.group_id || !row.role || !row.invite_code) throw new Error('Supabase no devolvio un grupo valido.');
  return { group_id: row.group_id, role: row.role, invite_code: row.invite_code };
}

function songFromRow(row: SongRow): Song {
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    artist: row.artist,
    originalKey: row.original_key,
    key: row.song_key,
    tempo: row.tempo,
    timeSignature: row.time_signature,
    tags: row.tags ?? [],
    notes: row.notes ?? '',
    chordPro: row.chord_pro,
    durationSeconds: row.duration_seconds,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
  };
}

function songToRow(song: Song): SongRow {
  return {
    id: song.id,
    group_id: song.groupId,
    title: song.title,
    artist: song.artist,
    original_key: song.originalKey,
    song_key: song.key,
    tempo: song.tempo,
    time_signature: song.timeSignature,
    tags: song.tags,
    notes: song.notes,
    chord_pro: song.chordPro,
    duration_seconds: song.durationSeconds,
    created_by: song.createdBy,
    created_at: song.createdAt,
    updated_at: song.updatedAt,
    archived_at: song.archivedAt ?? null,
  };
}

function setlistFromRow(row: SetlistRow): Setlist {
  const items = [...(row.setlist_songs ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      songId: item.song_id,
      performanceKey: item.performance_key ?? undefined,
      notes: item.notes ?? undefined,
    }));
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    eventDate: row.event_date,
    date: row.event_date,
    notes: row.notes ?? '',
    createdBy: row.created_by,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function setlistToRow(setlist: Setlist): Omit<SetlistRow, 'setlist_songs'> {
  return {
    id: setlist.id,
    group_id: setlist.groupId,
    name: setlist.name,
    event_date: setlist.eventDate,
    notes: setlist.notes,
    created_by: setlist.createdBy,
    created_at: setlist.createdAt,
    updated_at: setlist.updatedAt,
  };
}

function setlistItemToRow(setlistId: string, item: SetlistItem, position: number) {
  return {
    setlist_id: setlistId,
    song_id: item.songId,
    position,
    performance_key: item.performanceKey ?? null,
    notes: item.notes ?? '',
  };
}
