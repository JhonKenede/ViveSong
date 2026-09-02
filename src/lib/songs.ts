import type { MusicalKey, Song } from '../types';
import { extractChordProMetadata } from './chordPro';
import { transposeChordPro, transposeKey, type AccidentalPreference } from './chords';
import { createId } from './ids';
import { DEFAULT_GROUP_ID, DEFAULT_USER_ID } from './permissions';

export interface SongInput {
  groupId?: string;
  title: string;
  artist: string;
  originalKey?: MusicalKey;
  key: MusicalKey;
  tempo: number;
  timeSignature: string;
  tags: string[];
  notes?: string;
  chordPro: string;
  durationSeconds: number;
  createdBy?: string;
  archivedAt?: string;
}

export function validateSong(input: SongInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push('El título es obligatorio.');
  if (!input.artist.trim()) errors.push('El artista es obligatorio.');
  if (!input.chordPro.trim()) errors.push('La letra con acordes es obligatoria.');
  if (!Number.isFinite(input.tempo) || input.tempo < 30 || input.tempo > 240) {
    errors.push('El tempo debe estar entre 30 y 240 BPM.');
  }
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 0) {
    errors.push('La duracion estimada no puede ser negativa.');
  }
  if (!/^\d+\/\d+$/.test(input.timeSignature)) {
    errors.push('El compás debe tener formato 4/4, 6/8, etc.');
  }
  return errors;
}

export function createSong(input: SongInput, id = createId()): Song {
  const now = new Date().toISOString();
  return {
    ...input,
    id,
    groupId: input.groupId ?? DEFAULT_GROUP_ID,
    originalKey: input.originalKey ?? input.key,
    notes: input.notes ?? '',
    createdBy: input.createdBy ?? DEFAULT_USER_ID,
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateSong(song: Song, input: SongInput): Song {
  return {
    ...song,
    ...input,
    groupId: input.groupId ?? song.groupId,
    originalKey: input.originalKey ?? song.originalKey,
    notes: input.notes ?? song.notes,
    createdBy: song.createdBy,
    createdAt: song.createdAt,
    tags: normalizeTags(input.tags),
    updatedAt: new Date().toISOString(),
  };
}

export function duplicateSong(song: Song, title: string, id = createId()): Song {
  const now = new Date().toISOString();
  return {
    ...song,
    id,
    title,
    createdAt: now,
    updatedAt: now,
    archivedAt: undefined,
  };
}

export function archiveSong(song: Song): Song {
  return {
    ...song,
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function transposeSong(song: Song, semitones: number, preference: AccidentalPreference = 'sharp'): Song {
  return {
    ...song,
    key: transposeKey(song.key, semitones, preference) as MusicalKey,
    chordPro: transposeChordPro(song.chordPro, semitones, preference),
    updatedAt: new Date().toISOString(),
  };
}

export function hydrateSongFromChordPro(input: SongInput): SongInput {
  const metadata = extractChordProMetadata(input.chordPro);
  return {
    ...input,
    title: metadata.title || input.title,
    artist: metadata.artist || input.artist,
    key: (metadata.key as MusicalKey) || input.key,
    originalKey: (metadata.key as MusicalKey) || input.originalKey || input.key,
    tempo: metadata.tempo ? Number(metadata.tempo) : input.tempo,
    timeSignature: metadata.time || input.timeSignature,
  };
}

export function filterSongs(
  songs: Song[],
  filters: { query: string; key: string; artist: string; tag: string },
): Song[] {
  const query = filters.query.trim().toLowerCase();
  return songs.filter((song) => {
    if (song.archivedAt) return false;
    const matchesQuery =
      !query ||
      [song.title, song.artist, song.key, song.originalKey, song.tags.join(' '), song.notes, song.chordPro]
        .join(' ')
        .toLowerCase()
        .includes(query);
    const matchesKey = !filters.key || song.key === filters.key;
    const matchesArtist = !filters.artist || song.artist === filters.artist;
    const matchesTag = !filters.tag || song.tags.includes(filters.tag);

    return matchesQuery && matchesKey && matchesArtist && matchesTag;
  });
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}
