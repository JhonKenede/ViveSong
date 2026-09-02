import type { GroupRole, Song, UserSession } from '../types';

export const DEFAULT_GROUP_ID = 'group-vive-worship';
export const DEFAULT_USER_ID = 'user-local-editor';

export const defaultSession: UserSession = {
  userId: DEFAULT_USER_ID,
  groupId: DEFAULT_GROUP_ID,
  role: 'editor',
};

export function canReadGroupResource(session: UserSession, groupId: string): boolean {
  return session.groupId === groupId;
}

export function canManageSongs(session: UserSession): boolean {
  return session.role === 'admin' || session.role === 'editor';
}

export function canArchiveSongs(session: UserSession): boolean {
  return session.role === 'admin' || session.role === 'editor';
}

export function canDeleteSongs(session: UserSession): boolean {
  return session.role === 'admin';
}

export function canEditSong(session: UserSession, song: Song): boolean {
  return canManageSongs(session) && !song.archivedAt;
}

export function roleLabel(role: GroupRole): string {
  if (role === 'admin') return 'Administrador';
  if (role === 'editor') return 'Editor';
  return 'Musico';
}
