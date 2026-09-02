import type { Setlist, Song } from '../types';
import { createId } from './ids';
import { DEFAULT_GROUP_ID, DEFAULT_USER_ID } from './permissions';

export function createSetlist(name: string, date: string, id = createId(), groupId = DEFAULT_GROUP_ID): Setlist {
  const now = new Date().toISOString();
  return {
    id,
    groupId,
    name: name.trim(),
    date,
    eventDate: date,
    notes: '',
    createdBy: DEFAULT_USER_ID,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addSongToSetlist(setlist: Setlist, songId: string): Setlist {
  if (setlist.items.some((item) => item.songId === songId)) return setlist;
  return touchSetlist({ ...setlist, items: [...setlist.items, { songId }] });
}

export function setSetlistSongKey(setlist: Setlist, songId: string, performanceKey: Setlist['items'][number]['performanceKey']): Setlist {
  return touchSetlist({
    ...setlist,
    items: setlist.items.map((item) => (item.songId === songId ? { ...item, performanceKey } : item)),
  });
}

export function removeSongFromSetlist(setlist: Setlist, songId: string): Setlist {
  return touchSetlist({ ...setlist, items: setlist.items.filter((item) => item.songId !== songId) });
}

export function moveSetlistItem(setlist: Setlist, fromIndex: number, toIndex: number): Setlist {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return setlist;
  if (fromIndex >= setlist.items.length || toIndex >= setlist.items.length) return setlist;

  const items = [...setlist.items];
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  return touchSetlist({ ...setlist, items });
}

export function getSetlistDurationSeconds(setlist: Setlist, songs: Song[]): number {
  const songMap = new Map(songs.map((song) => [song.id, song]));
  return setlist.items.reduce((total, item) => total + (songMap.get(item.songId)?.durationSeconds ?? 0), 0);
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function touchSetlist(setlist: Setlist): Setlist {
  return { ...setlist, updatedAt: new Date().toISOString() };
}
