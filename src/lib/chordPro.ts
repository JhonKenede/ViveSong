import type { ParsedSongBlock } from '../types';

export function parseChordPro(source: string): ParsedSongBlock[] {
  return source.split(/\r?\n/).map((line) => {
    const directive = line.match(/^\{([^:}]+):?\s*([^}]*)}$/);
    if (directive) {
      return {
        kind: 'directive',
        name: directive[1].trim().toLowerCase(),
        value: directive[2].trim(),
      };
    }

    const segments: Array<{ chord?: string; lyric: string }> = [];
    const chordRegex = /\[([^\]]+)]/g;
    let lastIndex = 0;
    let currentChord: string | undefined;
    let match: RegExpExecArray | null;

    while ((match = chordRegex.exec(line)) !== null) {
      const lyric = line.slice(lastIndex, match.index);
      if (lyric || currentChord) segments.push({ chord: currentChord, lyric });
      currentChord = match[1];
      lastIndex = match.index + match[0].length;
    }

    const tail = line.slice(lastIndex);
    segments.push({ chord: currentChord, lyric: tail });

    return { kind: 'line', segments };
  });
}

export function extractChordProMetadata(source: string): Record<string, string> {
  return parseChordPro(source).reduce<Record<string, string>>((metadata, block) => {
    if (block.kind === 'directive') metadata[block.name] = block.value;
    return metadata;
  }, {});
}
