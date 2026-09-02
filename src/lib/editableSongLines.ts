import { parseChordPro } from './chordPro';
import { transposeChord } from './chords';
import { createId } from './ids';

export interface EditableChordPosition {
  value: string;
  position: number;
}

export type EditableSongLine =
  | {
      id: string;
      type: 'line';
      chord: string;
      chords?: string[];
      chordSlots?: EditableChordPosition[];
      lyric: string;
    }
  | {
      id: string;
      type: 'section';
      title: string;
    }
  | {
      id: string;
      type: 'blank';
    };

export function createEditableLine(type: EditableSongLine['type'] = 'line'): EditableSongLine {
  const id = createId();
  if (type === 'section') return { id, type, title: 'Verso' };
  if (type === 'blank') return { id, type };
  return { id, type, chord: '', lyric: '' };
}

export function getEditableLineChords(line: Extract<EditableSongLine, { type: 'line' }>): string[] {
  return getEditableLineChordSlots(line).map((slot) => slot.value);
}

export function getEditableLineChordSlots(
  line: Extract<EditableSongLine, { type: 'line' }>,
): EditableChordPosition[] {
  if (line.chordSlots) return line.chordSlots;
  if (line.chords) {
    const parsed = parseChordPositions(line.chord);
    return line.chords.map((value, index) => ({ value, position: parsed[index]?.index ?? index * 4 }));
  }
  return parseChordPositions(line.chord).map(({ chord, index }) => ({ value: chord, position: index }));
}

export function chordProToEditableLines(source: string): EditableSongLine[] {
  const lines = parseChordPro(source).flatMap<EditableSongLine>((block) => {
    const id = createId();
    if (block.kind === 'directive') {
      if (block.name === 'section') return [{ id, type: 'section', title: block.value || 'Sección' }];
      return [];
    }

    const hasContent = block.segments.some((segment) => segment.chord || segment.lyric.trim());
    if (!hasContent) return [{ id, type: 'blank' }];

    if (isInstrumentalChordLine(block.segments)) {
      return [
        {
          id,
          type: 'line',
          chord: block.segments.map((segment) => segment.chord).filter(Boolean).join(' '),
          chords: block.segments.map((segment) => segment.chord).filter(Boolean) as string[],
          chordSlots: block.segments
            .map((segment) => segment.chord)
            .filter(Boolean)
            .map((value, index) => ({ value, position: index * 4 })) as EditableChordPosition[],
          lyric: '',
        },
      ];
    }

    if (block.segments.filter((segment) => segment.chord).length > 1) {
      return [chordSegmentsToEditableLine(block.segments)];
    }

    return block.segments
      .filter((segment) => segment.chord || segment.lyric.trim())
      .map((segment) => ({
        id: createId(),
        type: 'line',
        chord: segment.chord ?? '',
        chordSlots: segment.chord ? [{ value: segment.chord, position: 0 }] : [],
        lyric: segment.lyric,
      }));
  });

  const trimmed = trimOuterBlankLines(mergeConsecutiveInstrumentalRows(lines));
  return trimmed.length > 0 ? trimmed : [createEditableLine()];
}

export function editableLinesToChordPro(lines: EditableSongLine[]): string {
  return lines
    .map((line) => {
      if (line.type === 'section') return line.title.trim() ? `{section: ${line.title.trim()}}` : '';
      if (line.type === 'blank') return '';

      const chordSlots = getEditableLineChordSlots(line)
        .map((slot) => ({ value: slot.value.trim(), position: Math.max(0, Math.round(slot.position)) }))
        .filter((slot) => slot.value);
      const chords = chordSlots.map((slot) => slot.value);
      const lyric = line.lyric.trimEnd();
      if (chords.length === 0 && !line.chord.trim()) return lyric;
      if (lyric) return applyChordSlotsToLyric(chordSlots, lyric);
      const chordProChords = chords.map((part) => `[${part}]`).join('');
      return chordProChords;
    })
    .join('\n');
}

export function transposeEditableLines(lines: EditableSongLine[], semitones: number): EditableSongLine[] {
  if (semitones === 0) return lines;

  return lines.map((line) => {
    if (line.type !== 'line' || !line.chord.trim()) return line;
    return {
      ...line,
      chord: splitChordInput(line.chord)
        .map((chord) => transposeChord(chord, semitones))
        .join(' '),
      chords: line.chords?.map((chord) => (chord.trim() ? transposeChord(chord, semitones) : chord)),
      chordSlots: line.chordSlots?.map((slot) => ({
        ...slot,
        value: slot.value.trim() ? transposeChord(slot.value, semitones) : slot.value,
      })),
    };
  });
}

function isInstrumentalChordLine(segments: Array<{ chord?: string; lyric: string }>): boolean {
  return segments.length > 1 && segments.every((segment) => segment.chord && !segment.lyric.trim());
}

function chordSegmentsToEditableLine(segments: Array<{ chord?: string; lyric: string }>): EditableSongLine {
  let lyric = '';
  const chordPositions: Array<{ chord: string; index: number }> = [];

  for (const segment of segments) {
    if (segment.chord) chordPositions.push({ chord: segment.chord, index: lyric.length });
    lyric += segment.lyric;
  }

  return {
    id: createId(),
    type: 'line',
    chord: chordPositionsToLine(chordPositions),
    chords: chordPositions.map((position) => position.chord),
    chordSlots: chordPositions.map((position) => ({ value: position.chord, position: position.index })),
    lyric,
  };
}

function mergeConsecutiveInstrumentalRows(lines: EditableSongLine[]): EditableSongLine[] {
  const merged: EditableSongLine[] = [];
  let pending: Array<Extract<EditableSongLine, { type: 'line' }>> = [];

  for (const line of lines) {
    if (line.type === 'line' && line.chord.trim() && !line.lyric.trim()) {
      pending.push(line);
      continue;
    }

    if (line.type === 'line' && line.chord.trim() && line.lyric.trim() && pending.length > 0) {
      const leadingChord = takeLeadingChordForLyric(pending);
      flushInstrumentalRows(merged, pending);
      pending = [];
      merged.push({
        ...line,
        chord: leadingChord ? `${leadingChord.chord.trim()} ${line.chord.trim()}` : line.chord,
        chords: leadingChord ? [...getEditableLineChords(leadingChord), ...getEditableLineChords(line)] : line.chords,
        chordSlots: leadingChord
          ? [...getEditableLineChordSlots(leadingChord), ...getEditableLineChordSlots(line)]
          : line.chordSlots,
      });
      continue;
    }

    flushInstrumentalRows(merged, pending);
    pending = [];
    merged.push(line);
  }

  flushInstrumentalRows(merged, pending);
  return merged;
}

function takeLeadingChordForLyric(
  rows: Array<Extract<EditableSongLine, { type: 'line' }>>,
): Extract<EditableSongLine, { type: 'line' }> | undefined {
  const last = rows[rows.length - 1];
  if (!last) return undefined;
  const chordParts = last.chord.trim().split(/\s+/);

  if (chordParts.length === 1) return rows.pop();
  if (chordParts.length > 4) {
    const leadingChord = chordParts.pop();
    rows[rows.length - 1] = {
      ...last,
      chord: chordParts.join(' '),
      chords: chordParts,
      chordSlots: chordParts.map((value, index) => ({ value, position: index * 4 })),
    };
    return leadingChord
      ? { ...last, chord: leadingChord, chords: [leadingChord], chordSlots: [{ value: leadingChord, position: 0 }] }
      : undefined;
  }

  return undefined;
}

function flushInstrumentalRows(
  target: EditableSongLine[],
  rows: Array<Extract<EditableSongLine, { type: 'line' }>>,
): void {
  if (rows.length === 0) return;
  target.push({
    id: rows[0].id,
    type: 'line',
    chord: rows.map((row) => row.chord.trim()).join(' '),
    chords: rows.flatMap((row) => getEditableLineChords(row)),
    chordSlots: rows
      .flatMap((row) => getEditableLineChordSlots(row))
      .map((slot, index) => ({ ...slot, position: index * 4 })),
    lyric: '',
  });
}

function chordPositionsToLine(chordPositions: Array<{ chord: string; index: number }>): string {
  let line = '';
  for (const { chord, index } of chordPositions) {
    if (line.length < index) line += ' '.repeat(index - line.length);
    if (line.length > 0 && line.length >= index) line += ' ';
    line += chord;
  }
  return line.trimEnd();
}

function applyChordSlotsToLyric(chords: EditableChordPosition[], lyric: string): string {
  let result = lyric;
  const orderedChords = chords
    .map((slot, order) => ({ ...slot, order }))
    .sort((a, b) => b.position - a.position || b.order - a.order);
  for (const { value, position } of orderedChords) {
    const insertAt = Math.min(Math.max(0, position), result.length);
    result = `${result.slice(0, insertAt)}[${value}]${result.slice(insertAt)}`;
  }
  return result;
}

function parseChordPositions(chordLine: string): Array<{ chord: string; index: number }> {
  const chordRegex = /[A-G](?:#|b)?(?:maj|min|sus|dim|aug|add|m)?\d*(?:\/[A-G](?:#|b)?)?/g;
  const positions: Array<{ chord: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = chordRegex.exec(chordLine)) !== null) positions.push({ chord: match[0], index: match.index });
  return positions;
}

function splitChordInput(chord: string): string[] {
  return chord.split(/\s+/).map((part) => part.trim()).filter(Boolean);
}

function trimOuterBlankLines(lines: EditableSongLine[]): EditableSongLine[] {
  let start = 0;
  let end = lines.length;

  while (lines[start]?.type === 'blank') start += 1;
  while (lines[end - 1]?.type === 'blank') end -= 1;

  return lines.slice(start, end);
}
