export const CHROMATIC_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const FLAT_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const SHARP_NOTES: string[] = [...CHROMATIC_KEYS];
const FLAT_NOTES: string[] = [...FLAT_KEYS];
const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};
const CHORD_ROOT = /^([A-G](?:#|b)?)(.*)$/;
export type AccidentalPreference = 'sharp' | 'flat';

export function normalizeKey(key: string): string {
  return FLAT_TO_SHARP[key] ?? key;
}

export function transposeChord(chord: string, semitones: number, preference: AccidentalPreference = 'sharp'): string {
  const slashParts = chord.split('/');
  return slashParts.map((part) => transposeSingleChordPart(part, semitones, preference)).join('/');
}

export function transposeChordPro(input: string, semitones: number, preference: AccidentalPreference = 'sharp'): string {
  if (semitones === 0) return input;

  return input.replace(/\[([^\]]+)]/g, (_, chord: string) => `[${transposeChord(chord, semitones, preference)}]`);
}

export function transposeKey(key: string, semitones: number, preference: AccidentalPreference = 'sharp'): string {
  const normalized = normalizeKey(key);
  const index = SHARP_NOTES.indexOf(normalized);
  if (index === -1) return key;

  return getNoteName(wrapIndex(index + semitones), preference);
}

export function getSemitoneDistance(fromKey: string, toKey: string): number {
  const fromIndex = SHARP_NOTES.indexOf(normalizeKey(fromKey));
  const toIndex = SHARP_NOTES.indexOf(normalizeKey(toKey));
  if (fromIndex === -1 || toIndex === -1) return 0;

  return wrapIndex(toIndex - fromIndex);
}

function transposeSingleChordPart(part: string, semitones: number, preference: AccidentalPreference): string {
  const match = part.match(CHORD_ROOT);
  if (!match) return part;

  const [, root, suffix] = match;
  const normalizedRoot = normalizeKey(root);
  const rootIndex = SHARP_NOTES.indexOf(normalizedRoot);
  if (rootIndex === -1) return part;

  return `${getNoteName(wrapIndex(rootIndex + semitones), preference)}${suffix}`;
}

function wrapIndex(index: number): number {
  return ((index % SHARP_NOTES.length) + SHARP_NOTES.length) % SHARP_NOTES.length;
}

function getNoteName(index: number, preference: AccidentalPreference): string {
  return preference === 'flat' ? FLAT_NOTES[index] : SHARP_NOTES[index];
}
