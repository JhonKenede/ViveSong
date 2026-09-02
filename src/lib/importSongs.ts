import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { extractChordProMetadata } from './chordPro';
import type { SongInput } from './songs';
import type { MusicalKey } from '../types';

export const SUPPORTED_IMPORT_EXTENSIONS = ['txt', 'cho', 'chordpro', 'pro', 'pdf'];
const DEFAULT_KEY: MusicalKey = 'C';
const DEFAULT_DURATION_SECONDS = 180;
const PDF_MONO_COLUMN_WIDTH = 4.2;
const MAX_IMPORT_BYTES = 1_000_000;

export async function importSongFile(file: File): Promise<SongInput> {
  validateImportFile(file);
  const extension = getFileExtension(file.name);
  const source =
    extension === 'pdf'
      ? await extractPdfText(file)
      : SUPPORTED_IMPORT_EXTENSIONS.includes(extension)
        ? await file.text()
        : '';

  return songInputFromText(source, stripExtension(file.name));
}

export function validateImportFile(file: File): void {
  const extension = getFileExtension(file.name);
  if (!SUPPORTED_IMPORT_EXTENSIONS.includes(extension)) {
    throw new Error('Formato no compatible. Usa .txt, .cho, .pro, .chordpro o PDF.');
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('El archivo es demasiado grande. El limite para este MVP es 1 MB.');
  }
}

export function songInputFromText(source: string, fallbackTitle: string): SongInput {
  const normalizedSource = cleanImportedText(source);
  if (!normalizedSource) {
    throw new Error('No se pudo encontrar texto en el archivo. Si es un PDF escaneado, necesita OCR.');
  }
  if (containsUnsafeMarkup(normalizedSource)) {
    throw new Error('El contenido incluye HTML o scripts. Limpialo antes de importarlo.');
  }

  const metadata = extractChordProMetadata(normalizedSource);
  const plainMetadata = inferPlainTextMetadata(normalizedSource, fallbackTitle);
  const title = metadata.title || plainMetadata.title;
  const artist = metadata.artist || plainMetadata.artist;
  const key = (metadata.key as MusicalKey | undefined) || plainMetadata.key;
  const tempo = metadata.tempo ? Number(metadata.tempo) : 72;
  const timeSignature = metadata.time || '4/4';
  const body = metadata.title ? normalizedSource : plainMetadata.body;
  const importedChordPro = convertChordOverLyricsToChordPro(body);

  const chordPro = hasChordProMetadata(normalizedSource)
    ? normalizedSource
    : `{title: ${title}}\n{artist: ${artist}}\n{key: ${key}}\n\n${importedChordPro}`;

  return {
    title,
    artist,
    key,
    originalKey: key,
    tempo: Number.isFinite(tempo) ? tempo : 72,
    timeSignature,
    tags: ['Importada'],
    notes: '',
    chordPro,
    durationSeconds: DEFAULT_DURATION_SECONDS,
  };
}

export function validateChordProContent(source: string): string[] {
  const errors: string[] = [];
  if (!source.trim()) errors.push('El contenido esta vacio.');
  if (containsUnsafeMarkup(source)) errors.push('No se permite HTML ni scripts dentro de la cancion.');
  const openBrackets = (source.match(/\[/g) ?? []).length;
  const closeBrackets = (source.match(/]/g) ?? []).length;
  if (openBrackets !== closeBrackets) errors.push('Hay acordes con corchetes incompletos.');
  return errors;
}

export function cleanImportedText(source: string): string {
  return source
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/g, ''))
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !isImportedPdfNoiseLine(trimmed);
    })
    .join('\n')
    .trim();
}

export function convertChordOverLyricsToChordPro(source: string): string {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  let pendingChordLine = '';

  for (const line of lines) {
    const normalizedLine = normalizeChordDashes(line);
    const trimmed = normalizedLine.trim();
    if (!trimmed) {
      flushPendingChordLine(output, pendingChordLine);
      pendingChordLine = '';
      output.push('');
      continue;
    }

    const section = getSectionLine(trimmed);
    if (section && !isChordOnlyLine(trimmed)) {
      flushPendingChordLine(output, pendingChordLine);
      pendingChordLine = '';
      output.push(`{section: ${section.title}}`);
      if (section.content) output.push(isChordOnlyLine(section.content) ? chordsToChordPro(section.content) : section.content);
      continue;
    }

    if (isChordOnlyLine(trimmed)) {
      flushPendingChordLine(output, pendingChordLine);
      pendingChordLine = normalizedLine;
      continue;
    }

    if (pendingChordLine) {
      output.push(applyChordLineToLyric(pendingChordLine, normalizedLine.replace(/\s+$/g, '')));
      pendingChordLine = '';
    } else {
      output.push(trimmed);
    }
  }

  flushPendingChordLine(output, pendingChordLine);
  return output.join('\n').trim();
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const data = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const positionedItems = content.items
      .filter((item) => 'str' in item && item.str)
      .map((item) => ({
        text: 'str' in item ? item.str : '',
        x: 'transform' in item ? item.transform[4] : 0,
        y: 'transform' in item ? Math.round(item.transform[5] / 3) * 3 : 0,
      }));
    const grouped = new Map<number, typeof positionedItems>();
    for (const item of positionedItems) grouped.set(item.y, [...(grouped.get(item.y) ?? []), item]);
    const pageLeft = Math.min(...positionedItems.filter((item) => item.text.trim()).map((item) => item.x));
    const pageText = [...grouped.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => rebuildPdfLine(items, pageLeft))
      .filter(Boolean)
      .join('\n');
    if (pageText) pages.push(pageText);
  }

  return pages.join('\n\n');
}

function inferPlainTextMetadata(source: string, fallbackTitle: string): { title: string; artist: string; key: MusicalKey; body: string } {
  const lines = source.split(/\r?\n/).filter(Boolean);
  const keyLine = lines.find((line) => /tono\s*:/i.test(line));
  const key = (keyLine?.match(/tono\s*:\s*([A-G](?:#|b)?)/i)?.[1] as MusicalKey | undefined) || DEFAULT_KEY;
  const bodyStart = findBodyStartIndex(lines);
  const metadataLines = lines.slice(0, bodyStart).map((line) => line.trim()).filter((line) => !isLikelyBodyStart(line));
  const title =
    metadataLines[0]?.replace(/\[[^\]]+]/g, '').replace(/\{[^}]+}/g, '').trim() || fallbackTitle || 'Cancion importada';
  const artist = bodyStart > 2 ? getImportedArtist(metadataLines) : 'Importado';
  const body = lines
    .slice(bodyStart)
    .map((line) => line.replace(/\bPiano\b/gi, '').replace(/\bTono\s*:\s*[A-G](?:#|b)?\b/gi, '').replace(/\s+$/g, ''))
    .filter((line) => line.trim())
    .join('\n');

  return { title, artist, key, body };
}

function hasChordProMetadata(source: string): boolean {
  return /^\{(?:title|artist|key|tempo|time|section):/im.test(source);
}

function isImportedPdfNoiseLine(line: string): boolean {
  return (
    /^www\./i.test(line) ||
    /^https?:\/\//i.test(line) ||
    /^×$/.test(line) ||
    /^\d+\s*\/\s*\d+$/.test(line) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/.test(line) ||
    /^Este fichero es trabajo propio/i.test(line) ||
    /^para exclusivo uso privado/i.test(line)
  );
}

function getImportedArtist(lines: string[]): string {
  const artist = lines
    .slice(1, 4)
    .find((line) => !/\[[0-9]{4}]|tono\s*:|piano|intro|coro|verso|puente/i.test(line));
  return artist || 'Importado';
}

function findBodyStartIndex(lines: string[]): number {
  const index = lines.findIndex((line) => isLikelyBodyStart(line));
  if (index >= 0) return index;
  return lines.length > 2 ? 2 : 1;
}

function isLikelyBodyStart(line: string): boolean {
  const trimmed = line.trim();
  return Boolean(getSectionLine(trimmed)) || isChordOnlyLine(trimmed) || /^\s*[A-G](?:#|b)?\s{2,}/.test(line);
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function containsUnsafeMarkup(source: string): boolean {
  return /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|html|body)\b/i.test(source);
}

function normalizeChordDashes(line: string): string {
  return line.replace(/[\u2013\u2014]/g, '-');
}

function getSectionLine(line: string): { title: string; content: string } | null {
  const match = line.match(/^(intro|introduccion|coro|verso|estrofa|pre\s*-?\s*coro|puente|final|tag|instrumental)(?::\s*(.*)|\s*)$/i);
  if (!match) return null;
  return { title: toTitleCase(match[1].replace(/\s*-\s*/g, '-')), content: (match[2] ?? '').trim() };
}

function isChordOnlyLine(line: string): boolean {
  const cleaned = line.replace(/[|/,-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return false;
  return cleaned
    .split(' ')
    .every((token) => /^[A-G](?:#|b)?(?:maj|min|sus|dim|aug|add|m)?\d*(?:\/[A-G](?:#|b)?)?$/.test(token));
}

function chordsToChordPro(line: string): string {
  return parseChordPositions(line)
    .map(({ chord }) => chord)
    .map((chord) => `[${chord}]`)
    .join('');
}

function flushPendingChordLine(output: string[], pendingChordLine: string): void {
  if (pendingChordLine) output.push(chordsToChordPro(pendingChordLine));
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function rebuildPdfLine(items: Array<{ text: string; x: number; y: number }>, pageLeft: number): string {
  const sorted = items.filter((item) => item.text.trim()).sort((a, b) => a.x - b.x);
  let line = '';

  for (const item of sorted) {
    const column = Math.max(0, Math.round((item.x - pageLeft) / PDF_MONO_COLUMN_WIDTH));
    if (line.length < column) line += ' '.repeat(column - line.length);
    line += item.text.trim();
  }

  return line.replace(/\s+$/g, '');
}

function applyChordLineToLyric(chordLine: string, lyric: string): string {
  const chords = parseChordPositions(chordLine);
  if (chords.length === 0) return lyric;
  if (!hasWideChordSpacing(chords)) return `${chordsToChordPro(chordLine)}${lyric.trimStart()}`;

  let result = lyric;
  for (const { chord, index } of [...chords].reverse()) {
    const insertAt = Math.min(Math.max(0, index), result.length);
    result = `${result.slice(0, insertAt)}[${chord}]${result.slice(insertAt)}`;
  }
  return result.trimStart();
}

function hasWideChordSpacing(chords: Array<{ chord: string; index: number }>): boolean {
  return chords.some((chord, index) => index > 0 && chord.index - chords[index - 1].index > 4);
}

function parseChordPositions(line: string): Array<{ chord: string; index: number }> {
  const normalized = normalizeChordDashes(line).replace(/[|,]/g, ' ');
  const chordRegex = /[A-G](?:#|b)?(?:maj|min|sus|dim|aug|add|m)?\d*(?:\/[A-G](?:#|b)?)?/g;
  const matches: Array<{ chord: string; index: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = chordRegex.exec(normalized)) !== null) {
    const chord = match[0];
    if (isChordOnlyLine(chord)) matches.push({ chord, index: match.index });
  }

  return matches;
}
