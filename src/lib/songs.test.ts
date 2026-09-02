import { describe, expect, it } from 'vitest';
import { createSong, filterSongs, transposeSong, validateSong } from './songs';

describe('song management', () => {
  it('validates required song fields', () => {
    expect(
      validateSong({
        title: '',
        artist: '',
        key: 'G',
        tempo: 12,
        timeSignature: '44',
        tags: [],
        chordPro: '',
        durationSeconds: 120,
      }),
    ).toHaveLength(5);
  });

  it('allows short or zero estimated durations', () => {
    expect(
      validateSong({
        title: 'Corto',
        artist: 'Equipo',
        key: 'G',
        tempo: 90,
        timeSignature: '4/4',
        tags: [],
        chordPro: '[G]Amen',
        durationSeconds: 0,
      }),
    ).toEqual([]);
  });

  it('rejects negative estimated durations', () => {
    expect(
      validateSong({
        title: 'Corto',
        artist: 'Equipo',
        key: 'G',
        tempo: 90,
        timeSignature: '4/4',
        tags: [],
        chordPro: '[G]Amen',
        durationSeconds: -1,
      }),
    ).toContain('La duracion estimada no puede ser negativa.');
  });

  it('creates songs with normalized tags', () => {
    const song = createSong(
      {
        title: 'Canto',
        artist: 'Equipo',
        key: 'C',
        tempo: 80,
        timeSignature: '4/4',
        tags: ['Adoración', ' Adoración ', ''],
        chordPro: '[C]Hola',
        durationSeconds: 180,
      },
      'song-1',
    );

    expect(song.tags).toEqual(['Adoración']);
    expect(song.id).toBe('song-1');
  });

  it('filters by query and tags', () => {
    const songs = [
      createSong({ title: 'Fuego', artist: 'A', key: 'G', tempo: 90, timeSignature: '4/4', tags: ['Entrada'], chordPro: '[G]Ven', durationSeconds: 180 }, '1'),
      createSong({ title: 'Paz', artist: 'B', key: 'D', tempo: 70, timeSignature: '4/4', tags: ['Adoración'], chordPro: '[D]Aquí', durationSeconds: 180 }, '2'),
    ];

    expect(filterSongs(songs, { query: 'paz', key: '', artist: '', tag: 'Adoración' })).toHaveLength(1);
  });

  it('transposes songs while updating the key', () => {
    const song = createSong({ title: 'A', artist: 'B', key: 'G', tempo: 80, timeSignature: '4/4', tags: [], chordPro: '[G]Test', durationSeconds: 180 }, '1');
    const transposed = transposeSong(song, 2);
    expect(transposed.key).toBe('A');
    expect(transposed.chordPro).toBe('[A]Test');
  });
});
