import { describe, expect, it } from 'vitest';
import { extractChordProMetadata, parseChordPro } from './chordPro';

describe('ChordPro parsing', () => {
  it('extracts directives and chorded lyric segments', () => {
    const parsed = parseChordPro('{section: Coro}\n[G]Santo [D]eres');
    expect(parsed[0]).toEqual({ kind: 'directive', name: 'section', value: 'Coro' });
    expect(parsed[1]).toEqual({
      kind: 'line',
      segments: [
        { chord: 'G', lyric: 'Santo ' },
        { chord: 'D', lyric: 'eres' },
      ],
    });
  });

  it('extracts metadata directives', () => {
    expect(extractChordProMetadata('{title: Mi canción}\n{key: D}')).toEqual({
      title: 'Mi canción',
      key: 'D',
    });
  });
});
