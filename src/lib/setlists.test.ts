import { describe, expect, it } from 'vitest';
import { addSongToSetlist, createSetlist, formatDuration, getSetlistDurationSeconds, moveSetlistItem, removeSongFromSetlist } from './setlists';
import { createSong } from './songs';

describe('setlist management', () => {
  it('adds, reorders and removes songs', () => {
    let setlist = createSetlist('Domingo', '2026-07-29', 'set-1');
    setlist = addSongToSetlist(setlist, 'a');
    setlist = addSongToSetlist(setlist, 'b');
    setlist = moveSetlistItem(setlist, 1, 0);
    expect(setlist.items.map((item) => item.songId)).toEqual(['b', 'a']);

    setlist = removeSongFromSetlist(setlist, 'b');
    expect(setlist.items.map((item) => item.songId)).toEqual(['a']);
  });

  it('calculates setlist duration', () => {
    const setlist = addSongToSetlist(addSongToSetlist(createSetlist('Noche', '2026-07-29', 'set-1'), 'a'), 'b');
    const songs = [
      createSong({ title: 'A', artist: 'X', key: 'G', tempo: 80, timeSignature: '4/4', tags: [], chordPro: '[G]A', durationSeconds: 120 }, 'a'),
      createSong({ title: 'B', artist: 'X', key: 'D', tempo: 80, timeSignature: '4/4', tags: [], chordPro: '[D]B', durationSeconds: 75 }, 'b'),
    ];

    expect(getSetlistDurationSeconds(setlist, songs)).toBe(195);
    expect(formatDuration(195)).toBe('3:15');
  });
});
