import { describe, expect, it } from 'vitest';
import { CHROMATIC_KEYS, FLAT_KEYS, getSemitoneDistance, transposeChord, transposeChordPro, transposeKey } from './chords';

describe('chord transposition', () => {
  it('transposes basic chords with suffixes', () => {
    expect(transposeChord('G', 2)).toBe('A');
    expect(transposeChord('Bm7', 1)).toBe('Cm7');
    expect(transposeChord('Bbadd9', -2)).toBe('G#add9');
  });

  it('transposes slash chords', () => {
    expect(transposeChord('D/F#', 2)).toBe('E/G#');
  });

  it('can prefer flat spellings for transposed chords', () => {
    expect(transposeChord('C/E', -2, 'flat')).toBe('Bb/D');
    expect(transposeChord('Em7', 1, 'flat')).toBe('Fm7');
    expect(transposeChordPro('[F#m7]Aleluya [Bb/D]amen', 1, 'flat')).toBe('[Gm7]Aleluya [B/Eb]amen');
  });

  it('transposes all ChordPro chord markers', () => {
    expect(transposeChordPro('[G]Hola [D/F#]mundo', 2)).toBe('[A]Hola [E/G#]mundo');
  });

  it('wraps tonalities across octaves', () => {
    expect(transposeKey('B', 1)).toBe('C');
    expect(transposeKey('C', -1)).toBe('B');
  });

  it('calculates the distance between tonalities', () => {
    expect(getSemitoneDistance('G', 'A')).toBe(2);
    expect(getSemitoneDistance('Bb', 'C')).toBe(2);
    expect(getSemitoneDistance('B', 'C')).toBe(1);
  });

  it('exposes every chromatic key used by transposition', () => {
    expect(CHROMATIC_KEYS).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
    expect(FLAT_KEYS).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']);
  });
});
