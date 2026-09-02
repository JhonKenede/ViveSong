import { describe, expect, it } from 'vitest';
import { cleanImportedText, convertChordOverLyricsToChordPro, songInputFromText, validateChordProContent } from './importSongs';

describe('song import', () => {
  it('imports ChordPro text with metadata', () => {
    const song = songInputFromText('{title: Gracia}\n{artist: Equipo}\n{key: G}\n\n[G]Gracia', 'archivo');

    expect(song.title).toBe('Gracia');
    expect(song.artist).toBe('Equipo');
    expect(song.key).toBe('G');
    expect(song.chordPro).toContain('[G]Gracia');
  });

  it('imports plain text with fallback metadata', () => {
    const song = songInputFromText('Mi primera linea\nOtra linea', 'Mi archivo');

    expect(song.title).toBe('Mi primera linea');
    expect(song.artist).toBe('Importado');
    expect(song.tags).toEqual(['Importada']);
    expect(song.durationSeconds).toBe(180);
    expect(song.chordPro).toContain('{title: Mi primera linea}');
    expect(song.chordPro).toContain('Otra linea');
  });

  it('rejects empty imported text', () => {
    expect(() => songInputFromText('   ', 'vacio')).toThrow(/No se pudo encontrar texto/);
  });

  it('reports unsafe or malformed ChordPro content', () => {
    expect(validateChordProContent('[G]Gracia')).toEqual([]);
    expect(validateChordProContent('[GGracia')).toContain('Hay acordes con corchetes incompletos.');
    expect(validateChordProContent('<script>alert(1)</script>')).toContain(
      'No se permite HTML ni scripts dentro de la cancion.',
    );
  });

  it('cleans PDF headers and converts chord-over-lyric lines', () => {
    const source = cleanImportedText(`www.NotasyAcordes.com
www.NotasyAcordes.com
La niña de tus ojos
Daniel Calveti
Piano Tono: C
INTRO: //C - G - Am - F//
          C                 G
//Me viste a mi cuando nadie me vio
          Am                F
Me amaste a mi cuando nadie me amo//`);
    const song = songInputFromText(source, 'pdf');

    expect(song.title).toBe('La niña de tus ojos');
    expect(song.artist).toBe('Daniel Calveti');
    expect(song.key).toBe('C');
    expect(song.chordPro).not.toContain('www.NotasyAcordes.com');
    expect(song.chordPro).toContain('{section: Intro}');
    expect(song.chordPro).toContain('//Me viste[C] a mi cuando nadie[G] me vio');
    expect(song.chordPro).toContain('Me amaste [Am]a mi cuando nadie [F]me amo//');
  });

  it('converts a simple chord line before a lyric line', () => {
    expect(convertChordOverLyricsToChordPro('C G\nMi letra')).toBe('[C][G]Mi letra');
  });

  it('cleans LaCuerda-style PDF exports and detects the song body', () => {
    const source = cleanImportedText(`29/7/26, 14:20                   BENDITO JESUS, Música Cristiana: Acordes
                                                                            ×
     Bendito Jesús
     Música Cristiana
      Voces para Dios
      Mañana Gloriosa [2017]

     Intro: Am C Am C F C E7 Am C F C E Am

     C             F            C
     Bendito Jesús hoy quiero decirte
                   F            C
     bendito Jesús hoy quiero decirte
     C E Am C Am

      Este fichero es trabajo propio de su transcriptor y representa su interpretación personal de la canción.
         para exclusivo uso privado, por lo que se prohibe su reproducción o retransmisión.
   https://acordes.lacuerda.net/musica_cristiana/bendito_jesus.shtml         1/1`);

    const song = songInputFromText(source, 'BENDITO JESUS');

    expect(song.title).toBe('Bendito Jesús');
    expect(song.artist).toBe('Música Cristiana');
    expect(song.chordPro).not.toContain('29/7/26');
    expect(song.chordPro).not.toContain('Voces para Dios');
    expect(song.chordPro).toContain('{section: Intro}');
    expect(song.chordPro).toContain('[Am][C][Am][C][F][C][E7][Am][C][F][C][E][Am]');
    expect(song.chordPro).toContain('[C]Bendito Jesús [F]hoy quiero de[C]cirte');
  });
});
