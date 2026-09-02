import { sampleSetlists, sampleSongs } from '../data/sampleData';
import type { Setlist, Song } from '../types';
import { DEFAULT_GROUP_ID, DEFAULT_USER_ID } from './permissions';

const SONGS_KEY = 'vivesong:songs';
const SETLISTS_KEY = 'vivesong:setlists';

export function loadSongs(): Song[] {
  return readJson<Song[]>(SONGS_KEY, sampleSongs).map(migrateSong);
}

export function saveSongs(songs: Song[]): void {
  writeJson(SONGS_KEY, songs);
}

export function loadSetlists(): Setlist[] {
  return readJson<Setlist[]>(SETLISTS_KEY, sampleSetlists).map(migrateSetlist);
}

export function saveSetlists(setlists: Setlist[]): void {
  writeJson(SETLISTS_KEY, setlists);
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function migrateSong(song: Song): Song {
  const updatedAt = song.updatedAt ?? new Date().toISOString();
  return {
    ...song,
    groupId: song.groupId ?? DEFAULT_GROUP_ID,
    originalKey: song.originalKey ?? song.key,
    notes: song.notes ?? '',
    createdBy: song.createdBy ?? DEFAULT_USER_ID,
    createdAt: song.createdAt ?? updatedAt,
    updatedAt,
  };
}

function migrateSetlist(setlist: Setlist): Setlist {
  const updatedAt = setlist.updatedAt ?? new Date().toISOString();
  const date = setlist.date ?? setlist.eventDate ?? new Date().toISOString().slice(0, 10);
  return {
    ...setlist,
    groupId: setlist.groupId ?? DEFAULT_GROUP_ID,
    date,
    eventDate: setlist.eventDate ?? date,
    notes: setlist.notes ?? '',
    createdBy: setlist.createdBy ?? DEFAULT_USER_ID,
    createdAt: setlist.createdAt ?? updatedAt,
    updatedAt,
  };
}
