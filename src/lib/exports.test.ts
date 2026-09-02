import { describe, expect, it } from 'vitest';
import { buildChordProExport, getChordProFileName } from './exports';
import { createSong } from './songs';

describe('ChordPro exports', () => {
  it('exports a compatible ChordPro file without duplicating metadata', () => {
    const song = createSong({
      title: 'La nina',
      artist: 'Equipo',
      key: 'C',
      originalKey: 'C',
      tempo: 80,
      timeSignature: '4/4',
      tags: ['Entrada'],
      notes: 'Capo 2',
      chordPro: '{title: Viejo}\n{artist: Otro}\n\n[C]Letra',
      durationSeconds: 180,
    });

    expect(buildChordProExport(song)).toBe(
      '{title: La nina}\n{artist: Equipo}\n{key: C}\n{tempo: 80}\n{time: 4/4}\n{comment: Capo 2}\n\n[C]Letra\n',
    );
    expect(getChordProFileName(song)).toBe('la-nina-equipo.chordpro');
  });
});
