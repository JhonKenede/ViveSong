import { describe, expect, it } from 'vitest';
import {
  chordProToEditableLines,
  editableLinesToChordPro,
  getEditableLineChords,
  transposeEditableLines,
} from './editableSongLines';

describe('editable song lines', () => {
  it('converts ChordPro into musician-friendly rows', () => {
    const lines = chordProToEditableLines('{section: Coro}\n[G]Santo [D]eres');

    expect(lines[0]).toMatchObject({ type: 'section', title: 'Coro' });
    expect(lines[1]).toMatchObject({ type: 'line', chord: 'G      D', lyric: 'Santo eres' });
  });

  it('builds ChordPro from simple rows', () => {
    expect(
      editableLinesToChordPro([
        { id: '1', type: 'section', title: 'Verso' },
        { id: '2', type: 'line', chord: 'G', lyric: 'Mi cancion' },
        { id: '3', type: 'blank' },
        { id: '4', type: 'line', chord: '', lyric: 'Sin acorde' },
      ]),
    ).toBe('{section: Verso}\n[G]Mi cancion\n\nSin acorde');
  });

  it('keeps instrumental chord lines on one editable row', () => {
    const lines = chordProToEditableLines('{section: Intro}\n[C][G][Am][F]');

    expect(lines[1]).toMatchObject({ type: 'line', chord: 'C G Am F', lyric: '' });
    if (lines[1].type !== 'line') throw new Error('Expected a chord line');
    expect(getEditableLineChords(lines[1])).toEqual(['C', 'G', 'Am', 'F']);
    expect(editableLinesToChordPro(lines)).toBe('{section: Intro}\n[C][G][Am][F]');
  });

  it('keeps intro chords separate from the first lyric chords', () => {
    const lines = chordProToEditableLines('{section: Intro}\n[C][G][Am][F]\n[C][G]//Me viste');

    expect(lines[1]).toMatchObject({ type: 'line', chord: 'C G Am F', lyric: '' });
    expect(lines[2]).toMatchObject({ type: 'line', chord: 'C G', lyric: '//Me viste' });
    if (lines[2].type !== 'line') throw new Error('Expected a lyric line');
    expect(getEditableLineChords(lines[2])).toEqual(['C', 'G']);
    expect(editableLinesToChordPro(lines)).toBe('{section: Intro}\n[C][G][Am][F]\n[C][G]//Me viste');
  });

  it('repairs previously split instrumental chord rows', () => {
    const lines = chordProToEditableLines('{section: Intro}\n[C]\n[G]\n[Am]\n[F]');

    expect(lines[1]).toMatchObject({ type: 'line', chord: 'C G Am F', lyric: '' });
    expect(editableLinesToChordPro(lines)).toBe('{section: Intro}\n[C][G][Am][F]');
  });

  it('repairs an intro that swallowed the first lyric chord', () => {
    const lines = chordProToEditableLines('{section: Intro}\n[C][G][Am][F][C]\n[G]//Me viste');

    expect(lines[1]).toMatchObject({ type: 'line', chord: 'C G Am F', lyric: '' });
    expect(lines[2]).toMatchObject({ type: 'line', chord: 'C G', lyric: '//Me viste' });
    expect(editableLinesToChordPro(lines)).toBe('{section: Intro}\n[C][G][Am][F]\n[C][G]//Me viste');
  });

  it('transposes chord rows and instrumental rows', () => {
    expect(
      transposeEditableLines(
        [
          { id: '1', type: 'section', title: 'Coro' },
          { id: '2', type: 'line', chord: 'D/F#', lyric: 'Tu bondad' },
          { id: '3', type: 'line', chord: 'C G Am F', lyric: '' },
          { id: '4', type: 'line', chord: '', lyric: 'Sin acorde' },
        ],
        2,
      ),
    ).toEqual([
      { id: '1', type: 'section', title: 'Coro' },
      { id: '2', type: 'line', chord: 'E/G#', lyric: 'Tu bondad' },
      { id: '3', type: 'line', chord: 'D A Bm G', lyric: '' },
      { id: '4', type: 'line', chord: '', lyric: 'Sin acorde' },
    ]);
  });
});
