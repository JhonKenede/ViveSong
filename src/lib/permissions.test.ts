import { describe, expect, it } from 'vitest';
import { canEditSong, canReadGroupResource, defaultSession } from './permissions';
import { createSong } from './songs';

describe('local permissions', () => {
  it('isolates resources by group id', () => {
    expect(canReadGroupResource(defaultSession, defaultSession.groupId)).toBe(true);
    expect(canReadGroupResource(defaultSession, 'other-group')).toBe(false);
  });

  it('prevents musicians from editing songs', () => {
    const song = createSong({
      groupId: defaultSession.groupId,
      title: 'Gracia',
      artist: 'Equipo',
      key: 'G',
      tempo: 72,
      timeSignature: '4/4',
      tags: [],
      chordPro: '[G]Gracia',
      durationSeconds: 180,
    });

    expect(canEditSong({ ...defaultSession, role: 'musician' }, song)).toBe(false);
    expect(canEditSong({ ...defaultSession, role: 'editor' }, song)).toBe(true);
  });

  it('allows editors to edit shared library songs outside the active group', () => {
    const song = createSong({
      groupId: 'shared-library',
      title: 'Gracia',
      artist: 'Equipo',
      key: 'G',
      tempo: 72,
      timeSignature: '4/4',
      tags: [],
      chordPro: '[G]Gracia',
      durationSeconds: 180,
    });

    expect(canEditSong({ ...defaultSession, role: 'editor' }, song)).toBe(true);
  });
});
