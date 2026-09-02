import { BetweenHorizontalEnd, Heading2, Plus, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ChordPreview } from './ChordPreview';
import {
  chordProToEditableLines,
  createEditableLine,
  editableLinesToChordPro,
  getEditableLineChordSlots,
  type EditableSongLine,
} from '../lib/editableSongLines';
import { CHROMATIC_KEYS } from '../lib/chords';
import { type SongInput, validateSong } from '../lib/songs';
import type { Song } from '../types';

const emptySong: SongInput = {
  title: '',
  artist: '',
  originalKey: 'G',
  key: 'G',
  tempo: 72,
  timeSignature: '4/4',
  tags: [],
  notes: '',
  durationSeconds: 180,
  chordPro: `{section: Verso 1}
[G]Escribe aqui tu cancion
[C]Anade acordes sin usar corchetes`,
};

const musicalKeys = CHROMATIC_KEYS;

interface SongEditorProps {
  song?: Song;
  onCancel: () => void;
  onSave: (input: SongInput) => void;
}

export function SongEditor({ song, onCancel, onSave }: SongEditorProps) {
  const initial = useMemo<SongInput>(
    () =>
      song
        ? {
            title: song.title,
            artist: song.artist,
            originalKey: song.originalKey,
            key: song.key,
            tempo: song.tempo,
            timeSignature: song.timeSignature,
            tags: song.tags,
            notes: song.notes,
            durationSeconds: song.durationSeconds,
            chordPro: song.chordPro,
          }
        : emptySong,
    [song],
  );
  const [form, setForm] = useState<SongInput>(initial);
  const [lines, setLines] = useState<EditableSongLine[]>(() => chordProToEditableLines(initial.chordPro));
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [selectedChord, setSelectedChord] = useState<{ lineId: string; chordIndex: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const chordPro = editableLinesToChordPro(lines);
  const draft = { ...form, originalKey: form.key, chordPro };
  const errors = validateSong(draft);

  function update<K extends keyof SongInput>(key: K, value: SongInput[K]) {
    setTouched(true);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (errors.length === 0) onSave(draft);
  }

  function updateLine(lineId: string, patch: Partial<EditableSongLine>) {
    setTouched(true);
    setLines((current) =>
      current.map((line) => (line.id === lineId ? ({ ...line, ...patch } as EditableSongLine) : line)),
    );
  }

  function updateLineChord(lineId: string, chordIndex: number, value: string) {
    setTouched(true);
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId || line.type !== 'line') return line;
        const chordSlots = getEditableLineChordSlots(line).map((slot) => ({ ...slot }));
        chordSlots[chordIndex] = { value, position: chordSlots[chordIndex]?.position ?? 0 };
        const chordSummary = chordSlots.map((slot) => slot.value.trim()).filter(Boolean).join(' ');
        return { ...line, chords: chordSlots.map((slot) => slot.value), chordSlots, chord: chordSummary };
      }),
    );
  }

  function addChordToLine(lineId: string) {
    setTouched(true);
    setSelectedChord(null);
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId || line.type !== 'line') return line;
        const chordSlots = getEditableLineChordSlots(line).map((slot) => ({ ...slot }));
        const lastPosition = chordSlots.reduce((position, slot) => Math.max(position, slot.position), 0);
        const nextSlot = { value: '', position: line.lyric.length > 0 ? line.lyric.length : lastPosition + 4 };
        const nextSlots = [...chordSlots, nextSlot];
        return {
          ...line,
          chords: nextSlots.map((slot) => slot.value),
          chordSlots: nextSlots,
          chord: nextSlots.map((slot) => slot.value.trim()).filter(Boolean).join(' '),
        };
      }),
    );
  }

  function removeChordFromLine(lineId: string, chordIndex: number) {
    setTouched(true);
    setSelectedChord((current) => {
      if (!current || current.lineId !== lineId) return current;
      if (current.chordIndex === chordIndex) return null;
      return current.chordIndex > chordIndex ? { ...current, chordIndex: current.chordIndex - 1 } : current;
    });
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId || line.type !== 'line') return line;
        const chordSlots = getEditableLineChordSlots(line)
          .map((slot) => ({ ...slot }))
          .filter((_, index) => index !== chordIndex);
        return {
          ...line,
          chords: chordSlots.map((slot) => slot.value),
          chordSlots,
          chord: chordSlots.map((slot) => slot.value.trim()).filter(Boolean).join(' '),
        };
      }),
    );
  }

  function moveChordToPointer(
    lineId: string,
    chordIndex: number,
    clientX: number,
    lane: HTMLElement,
    laneLength: number,
  ) {
    setTouched(true);
    const rect = lane.getBoundingClientRect();
    const relative = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const maxPosition = Math.max(1, laneLength);
    const position = Math.min(maxPosition, Math.max(0, Math.round(relative * maxPosition)));
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId || line.type !== 'line') return line;
        const chordSlots = getEditableLineChordSlots(line).map((slot) => ({ ...slot }));
        if (!chordSlots[chordIndex]) return line;
        chordSlots[chordIndex] = { ...chordSlots[chordIndex], position };
        return {
          ...line,
          chords: chordSlots.map((slot) => slot.value),
          chordSlots,
          chord: chordSlots.map((slot) => slot.value.trim()).filter(Boolean).join(' '),
        };
      }),
    );
  }

  function addLine(type: EditableSongLine['type']) {
    setTouched(true);
    setLines((current) => insertEditableLine(current, activeLineId, createEditableLine(type)));
  }

  function convertActiveLineToSection() {
    setTouched(true);
    setLines((current) => {
      if (!activeLineId) return [...current, createEditableLine('section')];
      return current.map((line) => {
        if (line.id !== activeLineId) return line;
        if (line.type === 'section') return line;
        if (line.type === 'blank') return { id: line.id, type: 'section', title: 'Verso' };
        return { id: line.id, type: 'section', title: line.lyric.trim() || line.chord.trim() || 'Verso' };
      });
    });
  }

  function insertLineAfter(lineId: string, type: EditableSongLine['type'] = 'line') {
    setTouched(true);
    setLines((current) => {
      const index = current.findIndex((line) => line.id === lineId);
      if (index === -1) return [...current, createEditableLine(type)];
      return [...current.slice(0, index + 1), createEditableLine(type), ...current.slice(index + 1)];
    });
  }

  function removeLine(lineId: string) {
    setTouched(true);
    setLines((current) => {
      const next = current.filter((line) => line.id !== lineId);
      return next.length > 0 ? next : [createEditableLine()];
    });
  }

  return (
    <form className="editor-shell editor-shell--song-form" onSubmit={handleSubmit}>
      <div className="panel-header editor-header">
        <div>
          <p className="eyebrow">{song ? 'Editar cancion' : 'Nueva cancion'}</p>
          <h2>{form.title || 'Cancion sin titulo'}</h2>
        </div>
        <div className="toolbar">
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Cerrar editor" title="Cerrar">
            <X size={18} />
          </button>
          <button className="primary-button" type="submit">
            <Save size={17} /> Guardar
          </button>
        </div>
      </div>

      {touched && errors.length > 0 ? (
        <div className="validation" role="alert">
          {errors.join(' ')}
        </div>
      ) : null}

      <section className="form-panel metadata-panel" aria-label="Datos de la cancion">
        <div className="metadata-grid">
          <label>
            Titulo
            <input value={form.title} onChange={(event) => update('title', event.target.value)} />
          </label>
          <label>
            Artista
            <input value={form.artist} onChange={(event) => update('artist', event.target.value)} />
          </label>
          <div className="field-row">
            <label>
              Tonalidad
              <select value={form.key} onChange={(event) => update('key', event.target.value as SongInput['key'])}>
                {musicalKeys.map((key) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
            </label>
            <label>
              Tempo
              <input
                type="number"
                min="30"
                max="240"
                value={form.tempo}
                onChange={(event) => update('tempo', Number(event.target.value))}
              />
            </label>
            <label>
              Compas
              <input value={form.timeSignature} onChange={(event) => update('timeSignature', event.target.value)} />
            </label>
          </div>
          <label>
            Etiquetas
            <input
              value={form.tags.join(', ')}
              onChange={(event) => update('tags', event.target.value.split(','))}
              placeholder="Adoracion, Entrada, Banda"
            />
          </label>
          <label>
            Notas
            <textarea
              className="notes-input"
              value={form.notes ?? ''}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="Notas para el grupo, entrada, capo, dinamica..."
            />
          </label>
          <label>
            Duracion en minutos
            <input
              type="number"
              min="0"
              step="0.25"
              value={Number((form.durationSeconds / 60).toFixed(2))}
              onChange={(event) => update('durationSeconds', Math.max(0, Number(event.target.value) * 60))}
            />
          </label>
        </div>
      </section>

      <div className="editor-grid">
        <section className="form-panel lyrics-panel" aria-label="Editor de letra y acordes">
          <div className="simple-song-editor" aria-label="Letra y acordes">
            <div className="simple-editor-header">
              <div>
                <strong>Letra y acordes</strong>
                <span>Escribe el acorde en su campo y la frase al lado.</span>
              </div>
              <div className="toolbar">
                <button className="secondary-button" type="button" onClick={convertActiveLineToSection}>
                  <Heading2 size={16} /> Seccion
                </button>
                <button className="secondary-button" type="button" onClick={() => addLine('line')}>
                  <Plus size={16} /> Linea
                </button>
                <button className="secondary-button" type="button" onClick={() => addLine('blank')}>
                  <BetweenHorizontalEnd size={16} /> Espacio
                </button>
              </div>
            </div>

            <div className="simple-lines">
              {lines.map((line, index) => {
                if (line.type === 'section') {
                  return (
                    <div className="simple-line simple-line--section" key={line.id}>
                      <span className="line-number">{index + 1}</span>
                      <input
                        aria-label={`Seccion ${index + 1}`}
                        value={line.title}
                        onFocus={() => setActiveLineId(line.id)}
                        onChange={(event) => updateLine(line.id, { title: event.target.value })}
                        placeholder="Verso, Coro, Puente..."
                      />
                      <button
                        className="icon-button danger"
                        type="button"
                        onClick={() => removeLine(line.id)}
                        aria-label="Eliminar linea"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                }

                if (line.type === 'blank') {
                  return (
                    <div className="simple-line simple-line--blank" key={line.id}>
                      <span className="line-number">{index + 1}</span>
                      <span>Espacio entre bloques</span>
                      <button
                        className="icon-button danger"
                        type="button"
                        onClick={() => removeLine(line.id)}
                        aria-label="Eliminar linea"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                }

                const chordSlots = getEditableLineChordSlots(line);
                const visibleChordSlots = chordSlots.length > 0 ? chordSlots : [{ value: '', position: 0 }];
                const laneLength = getLineLaneLength(line.lyric, visibleChordSlots);
                return (
                  <div className="simple-line" key={line.id}>
                    <span className="line-number">{index + 1}</span>
                    <div className="lyric-position-editor">
                      <div
                        className="chord-position-lane"
                        aria-label={`Acordes linea ${index + 1}`}
                        onPointerDown={(event) => {
                          if (event.target !== event.currentTarget || selectedChord?.lineId !== line.id) return;
                          moveChordToPointer(
                            line.id,
                            selectedChord.chordIndex,
                            event.clientX,
                            event.currentTarget,
                            laneLength,
                          );
                        }}
                      >
                        {visibleChordSlots.map((slot, chordIndex) => (
                          <div
                            className="chord-chip-editor"
                            key={`${line.id}-${chordIndex}`}
                            style={{ left: `${(Math.min(slot.position, laneLength) / laneLength) * 100}%` }}
                            onPointerDown={(event) => {
                              setSelectedChord({ lineId: line.id, chordIndex });
                              event.currentTarget.setPointerCapture?.(event.pointerId);
                              moveChordToPointer(line.id, chordIndex, event.clientX, event.currentTarget.parentElement!, laneLength);
                            }}
                            onPointerMove={(event) => {
                              if (event.currentTarget.hasPointerCapture && !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                              moveChordToPointer(line.id, chordIndex, event.clientX, event.currentTarget.parentElement!, laneLength);
                            }}
                          >
                            <input
                              aria-label={`Acorde ${chordIndex + 1} linea ${index + 1}`}
                              className="chord-input"
                              value={slot.value}
                              onChange={(event) => updateLineChord(line.id, chordIndex, event.target.value)}
                              onFocus={() => {
                                setActiveLineId(line.id);
                                setSelectedChord({ lineId: line.id, chordIndex });
                              }}
                              placeholder="G"
                            />
                            {chordSlots.length > 0 ? (
                              <button
                                aria-label={`Quitar acorde ${chordIndex + 1} linea ${index + 1}`}
                                className="chord-remove-button"
                                type="button"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => removeChordFromLine(line.id, chordIndex)}
                              >
                                <X size={13} />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      <input
                        aria-label={`Letra linea ${index + 1}`}
                        value={line.lyric}
                        onFocus={() => setActiveLineId(line.id)}
                        onChange={(event) => updateLine(line.id, { lyric: event.target.value })}
                        placeholder="Escribe la letra aqui"
                      />
                    </div>
                    <div className="line-actions">
                      <button
                        className="mini-icon-button"
                        type="button"
                        onClick={() => addChordToLine(line.id)}
                        aria-label={`Agregar acorde linea ${index + 1}`}
                        title="Agregar acorde"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        className="mini-icon-button"
                        type="button"
                        onClick={() => insertLineAfter(line.id)}
                        aria-label={`Agregar letra despues de linea ${index + 1}`}
                        title="Agregar letra debajo"
                      >
                        <span className="button-symbol">Aa</span>
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        onClick={() => removeLine(line.id)}
                        aria-label="Eliminar linea"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <label className="raw-chordpro-editor">
              Formato ChordPro
              <textarea
                aria-label="Contenido ChordPro"
                value={chordPro}
                onFocus={() => setActiveLineId(null)}
                onChange={(event) => {
                  setTouched(true);
                  setLines(chordProToEditableLines(event.target.value));
                }}
              />
            </label>
          </div>
        </section>

        <section className="preview-panel preview-panel--sticky" aria-label="Vista previa">
          <ChordPreview source={chordPro} />
        </section>
      </div>
    </form>
  );
}

function getLineLaneLength(lyric: string, chordSlots: Array<{ position: number }>): number {
  const lastChordPosition = chordSlots.reduce((position, slot) => Math.max(position, slot.position), 0);
  return Math.max(lyric.length, lastChordPosition + 4, 24);
}

function insertEditableLine(lines: EditableSongLine[], activeLineId: string | null, lineToInsert: EditableSongLine): EditableSongLine[] {
  if (!activeLineId) return [...lines, lineToInsert];
  const index = lines.findIndex((line) => line.id === activeLineId);
  if (index === -1) return [...lines, lineToInsert];
  return [...lines.slice(0, index + 1), lineToInsert, ...lines.slice(index + 1)];
}
