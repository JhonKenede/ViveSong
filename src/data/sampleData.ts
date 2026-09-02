import type { Setlist, Song } from '../types';
import { DEFAULT_GROUP_ID, DEFAULT_USER_ID } from '../lib/permissions';

const now = new Date().toISOString();

export const sampleSongs: Song[] = [
  {
    id: 'song-luz-en-mi-camino',
    groupId: DEFAULT_GROUP_ID,
    title: 'Luz en mi camino',
    artist: 'Vive Worship',
    originalKey: 'G',
    key: 'G',
    tempo: 74,
    timeSignature: '4/4',
    tags: ['Alabanza', 'Entrada', 'Congregacional'],
    notes: 'Entrada congregacional con banda completa.',
    durationSeconds: 270,
    createdBy: DEFAULT_USER_ID,
    createdAt: now,
    updatedAt: now,
    chordPro: `{title: Luz en mi camino}
{artist: Vive Worship}
{key: G}
{tempo: 74}
{time: 4/4}

{section: Verso 1}
[G]Cuando amanece [D/F#]canto tu bondad
[Em]Tu voz me guía [C]en la tempestad
[G]No hay noche eterna, [D]tu promesa está
[C]Luz en mi camino [D]siempre brillarás

{section: Coro}
[G]Vive en mi canción, [D]arde mi corazón
[Em]Cristo eres mi fuerza, [C]mi adoración
[G]Todo lo que soy [D]vuelve a ti Señor
[C]Hoy levantamos [D]una voz`,
  },
  {
    id: 'song-cerca-de-tu-mesa',
    groupId: DEFAULT_GROUP_ID,
    title: 'Cerca de tu mesa',
    artist: 'Casa Viva',
    originalKey: 'D',
    key: 'D',
    tempo: 68,
    timeSignature: '6/8',
    tags: ['Adoración', 'Comunión', 'Íntima'],
    notes: 'Funciona bien para ministracion tranquila.',
    durationSeconds: 315,
    createdBy: DEFAULT_USER_ID,
    createdAt: now,
    updatedAt: now,
    chordPro: `{title: Cerca de tu mesa}
{artist: Casa Viva}
{key: D}
{tempo: 68}
{time: 6/8}

{section: Verso}
[D]Cerca de tu mesa [A/C#]quiero permanecer
[Bm]Donde tu presencia [G]me vuelve a encender
[D/F#]Traigo mis silencios, [A]traigo mi canción
[G]Haz de mí un altar [A]para tu amor

{section: Puente}
[Bm]Santo, [A]santo
[G]Mi refugio [D/F#]eres tú
[Bm]Digno, [A]digno
[G]Todo vuelve [A]a Jesús`,
  },
  {
    id: 'song-firme-roca',
    groupId: DEFAULT_GROUP_ID,
    title: 'Firme roca',
    artist: 'Norte Sur',
    originalKey: 'A',
    key: 'A',
    tempo: 96,
    timeSignature: '4/4',
    tags: ['Celebración', 'Cierre', 'Banda'],
    notes: 'Cierre con energia.',
    durationSeconds: 238,
    createdBy: DEFAULT_USER_ID,
    createdAt: now,
    updatedAt: now,
    chordPro: `{title: Firme roca}
{artist: Norte Sur}
{key: A}
{tempo: 96}
{time: 4/4}

{section: Intro}
[A] [E] [F#m] [D]

{section: Verso}
[A]Mis pies están sobre [E]firme roca
[F#m]Tu gracia abrió [D]camino en mí
[A]Con manos libres [E]y alma nueva
[F#m]Correré hacia [D]ti

{section: Coro}
[A]No seré movido, [E]Cristo va conmigo
[F#m]En cada batalla [D]tú vencerás
[A]Cantaré más fuerte, [E]tu amor me sostiene
[F#m]Sobre la roca [D]permaneceré`,
  },
];

export const sampleSetlists: Setlist[] = [
  {
    id: 'setlist-domingo-manana',
    groupId: DEFAULT_GROUP_ID,
    name: 'Domingo mañana',
    date: new Date().toISOString().slice(0, 10),
    eventDate: new Date().toISOString().slice(0, 10),
    notes: 'Ensayo 30 minutos antes.',
    createdBy: DEFAULT_USER_ID,
    items: [
      { songId: 'song-luz-en-mi-camino' },
      { songId: 'song-cerca-de-tu-mesa', performanceKey: 'C', notes: 'Bajar un tono si lidera alto.' },
      { songId: 'song-firme-roca' },
    ],
    createdAt: now,
    updatedAt: now,
  },
];
