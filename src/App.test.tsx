import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('ViveSong app', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('searches songs and opens performance mode from setlists', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('Buscar canciones'), 'mesa');
    expect(screen.getByRole('button', { name: /Cerca de tu mesa/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Repertorios/i }));
    await user.click(screen.getByRole('button', { name: /Abrir directo/i }));
    expect(screen.getByRole('heading', { name: /Luz en mi camino/i })).toBeInTheDocument();
  });

  it('transposes the selected song from the library view', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Luz en mi camino/i }));
    const transposeSelect = screen.getByLabelText('Cambiar tono de la cancion');
    await user.selectOptions(transposeSelect, 'A');

    expect(transposeSelect).toHaveValue('A');
    expect(screen.getByText('E/G#')).toBeInTheDocument();
  });

  it('imports a plain text song from the library', async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File(['Cancion importada\nLinea para agregar acordes'], 'importada.txt', { type: 'text/plain' });
    await importFileAndOpenEditor(user, file);

    expect(await screen.findByRole('heading', { name: 'Cancion importada' })).toBeInTheDocument();
    expect(screen.getByLabelText('Letra linea 1')).toHaveValue('Linea para agregar acordes');
  });

  it('discards an imported draft when closing the editor', async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File(['Cancion temporal\nNo guardar'], 'temporal.txt', { type: 'text/plain' });
    await importFileAndOpenEditor(user, file);
    expect(await screen.findByDisplayValue('Cancion temporal')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Cerrar editor'));
    expect(screen.getByRole('dialog', { name: 'Descartar cambios' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByDisplayValue('Cancion temporal')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Cerrar editor'));
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.getByRole('heading', { name: /Selecciona una cancion/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancion temporal/i })).not.toBeInTheDocument();
  });

  it('blocks duplicate imports', async () => {
    const user = userEvent.setup();
    render(<App />);

    await importFileAndOpenEditor(user, new File(['Cancion importada\nLinea'], 'importada.txt', { type: 'text/plain' }));
    await user.click(await screen.findByRole('button', { name: /Guardar/i }));
    await user.click(screen.getAllByRole('button', { name: /Biblioteca/i })[0]);
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['Cancion importada\nOtra linea'], 'importada-2.txt', { type: 'text/plain' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ya existe esa cancion/i);
    expect(screen.getAllByRole('button', { name: /Cancion importada/i })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Importar version 2/i }));
    expect(await screen.findByDisplayValue('Cancion importada Version 2')).toBeInTheDocument();
  });

  it('blocks saving a new duplicate song', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Nueva cancion/i }));
    await user.type(screen.getByLabelText('Titulo'), 'Luz en mi camino');
    await user.type(screen.getByLabelText('Artista'), 'Vive Worship');
    await user.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ya existe una cancion/i);
    await user.click(screen.getByRole('button', { name: /Crear version 2/i }));
    expect(await screen.findByDisplayValue('Luz en mi camino Version 2')).toBeInTheDocument();
  });

  it('imports pasted ChordPro through a preview before editing', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Pegar texto/i }));
    await user.click(screen.getByLabelText('Texto de la cancion'));
    await user.paste('{title: Santo}\n{artist: Equipo}\n{key: Bb}\n\n[Bb/D]Santo eres [F#m7]Senor');
    await user.click(screen.getByRole('button', { name: /Previsualizar/i }));

    expect(await screen.findByRole('dialog', { name: 'Santo' })).toBeInTheDocument();
    expect(screen.getByText('Bb/D')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Abrir en editor/i }));
    expect(await screen.findByDisplayValue('Santo')).toBeInTheDocument();
    expect(screen.getByLabelText('Acorde 1 linea 1')).toHaveValue('Bb/D');
  });

  it('prevents a musician from changing songs', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText('Rol local'), 'musician');
    await user.click(screen.getByRole('button', { name: /Luz en mi camino/i }));

    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Duplicar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Archivar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Exportar/i })).toBeEnabled();
  });

  it('duplicates and archives songs from the reader', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Luz en mi camino/i }));
    await user.click(screen.getByRole('button', { name: /Duplicar/i }));
    expect(screen.getByRole('heading', { name: /Luz en mi camino Version 2/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Archivar/i }));
    expect(screen.getByRole('heading', { name: /Selecciona una cancion/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Luz en mi camino Version 2/i })).not.toBeInTheDocument();
  });

  it('edits the declared key without transposing editor chords', async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File(['Cancion importada\n\nC\nMi letra'], 'importada.txt', { type: 'text/plain' });
    await importFileAndOpenEditor(user, file);

    expect(await screen.findByLabelText('Acorde 1 linea 1')).toHaveValue('C');
    await user.selectOptions(screen.getByLabelText('Tonalidad'), 'D');

    expect(screen.getByLabelText('Tonalidad')).toHaveValue('D');
    expect(screen.getByLabelText('Acorde 1 linea 1')).toHaveValue('C');
  });

  it('adds and removes chords from a lyric line', async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File(['Cancion importada\n\nC\nMi letra'], 'importada.txt', { type: 'text/plain' });
    await importFileAndOpenEditor(user, file);

    await user.click(await screen.findByLabelText('Agregar acorde linea 1'));
    await user.type(screen.getByLabelText('Acorde 2 linea 1'), 'G');
    await user.click(screen.getByLabelText('Quitar acorde 1 linea 1'));

    expect(screen.getByLabelText('Acorde 1 linea 1')).toHaveValue('G');
    expect(screen.queryByLabelText('Acorde 2 linea 1')).not.toBeInTheDocument();
  });

  it('inserts a new lyric field after the current line', async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File(['Cancion importada\n\nC\nMi letra'], 'importada.txt', { type: 'text/plain' });
    await importFileAndOpenEditor(user, file);

    await user.click(await screen.findByLabelText('Agregar letra despues de linea 1'));
    await user.type(screen.getByLabelText('Letra linea 2'), 'Nueva frase');

    expect(screen.getByLabelText('Letra linea 1')).toHaveValue('Mi letra');
    expect(screen.getByLabelText('Letra linea 2')).toHaveValue('Nueva frase');
  });

  it('turns the active lyric line into a section heading', async () => {
    const user = userEvent.setup();
    render(<App />);

    const file = new File(['Cancion importada\n\nTexto normal'], 'importada.txt', { type: 'text/plain' });
    await importFileAndOpenEditor(user, file);

    const lyricInput = await screen.findByLabelText('Letra linea 1');
    await user.clear(lyricInput);
    await user.type(lyricInput, 'VERSO');
    await user.click(screen.getByRole('button', { name: /Seccion/i }));

    expect(screen.getByLabelText('Seccion 1')).toHaveValue('VERSO');
    expect(screen.queryByLabelText('Letra linea 1')).not.toBeInTheDocument();
  });

  it('asks for confirmation before deleting a song', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText('Rol local'), 'admin');
    await user.click(screen.getByRole('button', { name: /Luz en mi camino/i }));
    await user.click(screen.getByLabelText('Eliminar cancion'));
    expect(screen.getByRole('dialog', { name: 'Eliminar cancion' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('heading', { name: /Luz en mi camino/i })).toBeInTheDocument();

    await user.click(screen.getByLabelText('Eliminar cancion'));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByRole('heading', { name: /Selecciona una cancion/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Luz en mi camino/i })).not.toBeInTheDocument();
  });
});

async function importFileAndOpenEditor(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);
  await screen.findByRole('dialog', { name: /Cancion|Vista previa/i });
  await user.click(screen.getByRole('button', { name: /Abrir en editor/i }));
}
