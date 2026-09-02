import { parseChordPro } from '../lib/chordPro';
import type { ParsedSongBlock } from '../types';

interface ChordPreviewProps {
  source: string;
  large?: boolean;
}

export function ChordPreview({ source, large = false }: ChordPreviewProps) {
  const blocks = mergeConsecutiveInstrumentalBlocks(parseChordPro(source));

  return (
    <div className={large ? 'chord-preview chord-preview--large' : 'chord-preview'} translate="no">
      {blocks.map((block, index) => {
        if (block.kind === 'directive') {
          if (!['section', 'comment'].includes(block.name)) return null;
          return (
            <div className="song-section" key={`${block.name}-${index}`}>
              {block.value}
            </div>
          );
        }

        const isInstrumentalLine =
          block.segments.length > 1 && block.segments.every((segment) => segment.chord && !segment.lyric.trim());
        if (isInstrumentalLine) {
          return (
            <div className="instrumental-line" key={index}>
              {block.segments.map((segment, segmentIndex) => (
                <span className="chord" key={`${index}-${segmentIndex}`}>
                  {segment.chord}
                </span>
              ))}
            </div>
          );
        }

        const hasContent = block.segments.some((segment) => segment.chord || segment.lyric.trim());
        if (!hasContent) return <div aria-hidden="true" className="song-spacer" key={index} />;

        const positionedLine = getPositionedLyricLine(block.segments);
        return (
          <div className="lyric-line" key={index}>
            <div className="chord-overlay" aria-hidden="true">
              {positionedLine.chords.map((chord, chordIndex) => (
                <span className="chord chord-positioned" key={`${index}-${chordIndex}`} style={{ left: `${chord.position}ch` }}>
                  {chord.value}
                </span>
              ))}
            </div>
            <div className="lyric-text">{positionedLine.lyric || ' '}</div>
          </div>
        );
      })}
    </div>
  );
}

function getPositionedLyricLine(segments: Array<{ chord?: string; lyric: string }>): {
  lyric: string;
  chords: Array<{ value: string; position: number }>;
} {
  let lyric = '';
  const chords: Array<{ value: string; position: number }> = [];

  for (const segment of segments) {
    if (segment.chord) chords.push({ value: segment.chord, position: lyric.length });
    lyric += segment.lyric;
  }

  return { lyric, chords };
}

function mergeConsecutiveInstrumentalBlocks(blocks: ParsedSongBlock[]): ParsedSongBlock[] {
  const merged: ParsedSongBlock[] = [];
  let pendingSegments: Array<{ chord?: string; lyric: string }> = [];

  for (const block of blocks) {
    if (block.kind === 'line' && block.segments.every((segment) => segment.chord && !segment.lyric.trim())) {
      pendingSegments = [...pendingSegments, ...block.segments];
      continue;
    }

    if (block.kind === 'line' && block.segments.some((segment) => segment.lyric.trim()) && pendingSegments.length > 0) {
      const leadingSegment = takeLeadingSegmentForLyric(pendingSegments);
      if (pendingSegments.length > 0) merged.push({ kind: 'line', segments: pendingSegments });
      pendingSegments = [];
      merged.push({
        kind: 'line',
        segments: leadingSegment ? [leadingSegment, ...block.segments] : block.segments,
      });
      continue;
    }

    if (pendingSegments.length > 0) {
      merged.push({ kind: 'line', segments: pendingSegments });
      pendingSegments = [];
    }
    merged.push(block);
  }

  if (pendingSegments.length > 0) merged.push({ kind: 'line', segments: pendingSegments });
  return merged;
}

function takeLeadingSegmentForLyric(
  pendingSegments: Array<{ chord?: string; lyric: string }>,
): { chord?: string; lyric: string } | undefined {
  if (pendingSegments.length === 1) return pendingSegments.pop();
  if (pendingSegments.length > 4) return pendingSegments.pop();
  return undefined;
}
