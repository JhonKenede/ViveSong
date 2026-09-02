import type { Song } from '../types';

export function buildChordProExport(song: Song): string {
  const metadata = [
    `{title: ${song.title}}`,
    `{artist: ${song.artist}}`,
    `{key: ${song.originalKey}}`,
    `{tempo: ${song.tempo}}`,
    `{time: ${song.timeSignature}}`,
  ];
  const notes = song.notes.trim() ? [`{comment: ${song.notes.trim()}}`] : [];
  const body = stripKnownMetadata(song.chordPro).trim();
  return [...metadata, ...notes, '', body].join('\n').trimEnd() + '\n';
}

export function getChordProFileName(song: Song): string {
  const safeName = `${song.title}-${song.artist}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${safeName || 'cancion'}.chordpro`;
}

function stripKnownMetadata(source: string): string {
  return source
    .split(/\r?\n/)
    .filter((line) => !/^\{(?:title|artist|key|tempo|time):/i.test(line.trim()))
    .join('\n');
}
