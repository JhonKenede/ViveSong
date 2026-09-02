export type MusicalKey =
  | 'C'
  | 'C#'
  | 'Db'
  | 'D'
  | 'D#'
  | 'Eb'
  | 'E'
  | 'F'
  | 'F#'
  | 'Gb'
  | 'G'
  | 'G#'
  | 'Ab'
  | 'A'
  | 'A#'
  | 'Bb'
  | 'B';

export interface Song {
  id: string;
  groupId: string;
  title: string;
  artist: string;
  originalKey: MusicalKey;
  key: MusicalKey;
  tempo: number;
  timeSignature: string;
  tags: string[];
  notes: string;
  chordPro: string;
  durationSeconds: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface SetlistItem {
  songId: string;
  performanceKey?: MusicalKey;
  notes?: string;
}

export interface Setlist {
  id: string;
  groupId: string;
  name: string;
  eventDate: string;
  date: string;
  notes: string;
  createdBy: string;
  items: SetlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ParsedChordLine {
  kind: 'line';
  segments: Array<{
    chord?: string;
    lyric: string;
  }>;
}

export interface ParsedDirective {
  kind: 'directive';
  name: string;
  value: string;
}

export type ParsedSongBlock = ParsedChordLine | ParsedDirective;

export type ViewMode = 'library' | 'song' | 'editor' | 'setlists' | 'performance';

export type GroupRole = 'admin' | 'editor' | 'musician';

export interface UserSession {
  userId: string;
  groupId: string;
  role: GroupRole;
}
