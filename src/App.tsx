import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Archive,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Library,
  ListMusic,
  LogIn,
  Mic2,
  Moon,
  Music2,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCircle,
  UsersRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import { ChordPreview } from './components/ChordPreview';
import { SongEditor } from './components/SongEditor';
import { CHROMATIC_KEYS, getSemitoneDistance } from './lib/chords';
import { buildChordProExport, getChordProFileName } from './lib/exports';
import { importSongFile, songInputFromText } from './lib/importSongs';
import {
  canArchiveSongs,
  canDeleteSongs,
  canEditSong,
  canManageSongs,
  canReadGroupResource,
  defaultSession,
  roleLabel,
} from './lib/permissions';
import {
  addSongToSetlist,
  createSetlist,
  formatDuration,
  getSetlistDurationSeconds,
  moveSetlistItem,
  removeSongFromSetlist,
  setSetlistSongKey,
} from './lib/setlists';
import { archiveSong, createSong, duplicateSong, filterSongs, transposeSong, updateSong, type SongInput } from './lib/songs';
import { loadSetlists, loadSongs, saveSetlists, saveSongs } from './lib/storage';
import { isSupabaseConfigured } from './lib/supabaseClient';
import {
  createWorkspace,
  deleteWorkspace,
  deleteSongRemote,
  ensureWorkspace,
  fetchWorkspaceData,
  hasStoredAuthSession,
  joinWorkspaceByCode,
  listUserWorkspaces,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  upsertSetlist,
  upsertSong,
  type WorkspaceSession,
  type WorkspaceSummary,
} from './lib/supabaseRepository';
import type { GroupRole, Setlist, Song, ViewMode } from './types';

interface DuplicatePrompt {
  message: string;
  actionLabel: string;
  inputs: SongInput[];
}

const navItems: Array<{ view: Exclude<ViewMode, 'song'>; label: string; icon: typeof Library }> = [
  { view: 'library', label: 'Biblioteca', icon: Library },
  { view: 'editor', label: 'Editor', icon: Music2 },
  { view: 'setlists', label: 'Repertorios', icon: ListMusic },
  { view: 'performance', label: 'Directo', icon: Mic2 },
  { view: 'groups', label: 'Grupos', icon: UsersRound },
  { view: 'profile', label: 'Perfil', icon: UserCircle },
];

const musicalKeys = CHROMATIC_KEYS;

type SyncMode = 'local' | 'supabase';
type AuthAction = 'signIn' | 'signUp';

function App() {
  const [songs, setSongs] = useState<Song[]>(() => loadSongs());
  const [setlists, setSetlists] = useState<Setlist[]>(() => loadSetlists());
  const [session, setSession] = useState(defaultSession);
  const [activeView, setActiveView] = useState<ViewMode>('library');
  const [selectedSongId, setSelectedSongId] = useState(songs[0]?.id ?? '');
  const [selectedGroupSongId, setSelectedGroupSongId] = useState('');
  const [editingSongId, setEditingSongId] = useState<string | undefined>();
  const [draftSong, setDraftSong] = useState<Song | null>(null);
  const [selectedSetlistId, setSelectedSetlistId] = useState(setlists[0]?.id ?? '');
  const [performanceIndex, setPerformanceIndex] = useState(0);
  const [performanceSemitones, setPerformanceSemitones] = useState(0);
  const [songReaderSemitones, setSongReaderSemitones] = useState(0);
  const [filters, setFilters] = useState({ query: '', key: '', artist: '', tag: '' });
  const [importError, setImportError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null);
  const [songPendingDelete, setSongPendingDelete] = useState<Song | null>(null);
  const [groupPendingDelete, setGroupPendingDelete] = useState<WorkspaceSummary | null>(null);
  const [discardEditorRequested, setDiscardEditorRequested] = useState(false);
  const [importPreview, setImportPreview] = useState<SongInput | null>(null);
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [pastedSongText, setPastedSongText] = useState('');
  const [syncMode, setSyncMode] = useState<SyncMode>('local');
  const [syncMessage, setSyncMessage] = useState('');
  const [authBootstrapping, setAuthBootstrapping] = useState(isSupabaseConfigured);
  const [authSubmitting, setAuthSubmitting] = useState<AuthAction | null>(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [joinGroupCode, setJoinGroupCode] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => saveSongs(songs), [songs]);
  useEffect(() => saveSetlists(setlists), [setlists]);
  useEffect(() => setSongReaderSemitones(0), [selectedSongId]);

  const activateRemoteWorkspace = useCallback(async (workspace: WorkspaceSession, message: string) => {
    const remoteData = await fetchWorkspaceData(workspace.groupId);
    setSession({ userId: workspace.userId, groupId: workspace.groupId, role: workspace.role });
    setUserEmail(workspace.userEmail);
    setInviteCode(workspace.inviteCode);
    setSongs(remoteData.songs);
    setSetlists(remoteData.setlists);
    setSelectedSongId(remoteData.songs[0]?.id ?? '');
    setSelectedSetlistId(remoteData.setlists[0]?.id ?? '');
    setSyncMode('supabase');
    setSyncMessage(message);
    setAuthBootstrapping(false);
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setWorkspaces(await listUserWorkspaces());
  }, []);

  const loadDefaultWorkspace = useCallback(async (message: string) => {
    const workspace = await ensureWorkspace('ViveSong');
    await activateRemoteWorkspace(workspace, message);
    await refreshWorkspaces();
  }, [activateRemoteWorkspace, refreshWorkspaces]);

  const loadRemoteWorkspace = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const hasSession = await hasStoredAuthSession();
      if (!hasSession) {
        setSyncMessage('');
        setAuthBootstrapping(false);
        return;
      }

      await loadDefaultWorkspace('Conectado a Supabase.');
    } catch (error) {
      setAuthBootstrapping(false);
      setSyncMode('local');
      const message = getFriendlyBackendError(error);
      setSyncMessage(message.includes('Inicia sesion') ? '' : message);
    }
  }, [loadDefaultWorkspace]);

  function getAuthCredentials() {
    const email = authForm.email.trim();
    const password = authForm.password;

    if (!email || !password) {
      setSyncMessage('Escribe tu correo electronico y una contrasena para continuar.');
      return null;
    }

    if (password.length < 6) {
      setSyncMessage('La contrasena debe tener al menos 6 caracteres.');
      return null;
    }

    return { email, password };
  }

  async function openRemoteWorkspaceAfterAuth(message: string) {
    await loadDefaultWorkspace(message);
    setActiveView('library');
  }

  async function switchWorkspace(workspace: WorkspaceSummary) {
    try {
      await activateRemoteWorkspace(workspace, `Grupo activo: ${workspace.name}.`);
      setActiveView('groups');
    } catch (error) {
      setSyncMessage(getFriendlyBackendError(error));
    }
  }

  async function handleJoinWorkspace() {
    const code = joinGroupCode.trim();
    if (!code) {
      setSyncMessage('Escribe el codigo del grupo para unirte.');
      return;
    }

    try {
      const workspace = await joinWorkspaceByCode(code);
      await activateRemoteWorkspace(workspace, 'Te uniste al grupo.');
      await refreshWorkspaces();
      setJoinGroupCode('');
      setActiveView('groups');
    } catch (error) {
      setSyncMessage(getFriendlyAuthError(error, 'No se pudo unir al grupo.'));
    }
  }

  async function handleCreateWorkspace() {
    const groupName = newGroupName.trim();
    if (groupName.length < 2 || groupName.length > 80) {
      setSyncMessage('El nombre del grupo debe tener entre 2 y 80 caracteres.');
      return;
    }

    try {
      const workspace = await createWorkspace(groupName);
      await activateRemoteWorkspace(workspace, `Grupo creado: ${groupName}.`);
      await refreshWorkspaces();
      setNewGroupName('');
      setActiveView('groups');
    } catch (error) {
      setSyncMessage(getFriendlyBackendError(error));
    }
  }

  async function copyInviteCode(code: string) {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setSyncMessage('Codigo del grupo copiado.');
    } catch {
      setSyncMessage('No se pudo copiar el codigo. Seleccionalo y copialo manualmente.');
    }
  }

  async function handleDeleteWorkspace() {
    if (!groupPendingDelete) return;
    if (groupPendingDelete.role !== 'admin') {
      setSyncMessage('Solo un administrador puede eliminar este grupo.');
      setGroupPendingDelete(null);
      return;
    }

    try {
      await deleteWorkspace(groupPendingDelete.groupId);
      const remainingWorkspaces = await listUserWorkspaces();
      setWorkspaces(remainingWorkspaces);
      setGroupPendingDelete(null);

      const nextWorkspace = remainingWorkspaces[0];
      if (nextWorkspace) {
        await activateRemoteWorkspace(nextWorkspace, `Grupo eliminado: ${groupPendingDelete.name}.`);
        setActiveView('groups');
        return;
      }

      setSession({ userId: session.userId, groupId: '', role: 'musician' });
      setInviteCode('');
      setSongs([]);
      setSetlists([]);
      setSelectedSongId('');
      setSelectedSetlistId('');
      setSyncMode('supabase');
      setSyncMessage('Grupo archivado. Crea un grupo o unete a uno para compartir canciones.');
      setActiveView('groups');
    } catch (error) {
      setGroupPendingDelete(null);
      setSyncMessage(getFriendlyBackendError(error));
    }
  }

  function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
    return '';
  }

  function getFriendlyAuthError(error: unknown, fallback: string) {
    const rawMessage = getErrorMessage(error);
    if (!rawMessage) return fallback;
    const message = rawMessage.toLowerCase();

    if (message.includes('email not confirmed')) {
      return 'La cuenta se ha creado, pero Supabase pide confirmar el correo antes de entrar. Revisa tu email y despues pulsa Entrar.';
    }

    if (message.includes('rate limit') || message.includes('frequency') || message.includes('frecuencia')) {
      return 'Supabase ha bloqueado temporalmente los correos de confirmacion por demasiados intentos. Espera unos minutos o desactiva la confirmacion de email en Supabase para el ensayo.';
    }

    if (message.includes('invalid') && message.includes('email')) {
      return 'Ese correo no parece valido. Usa un correo real, por ejemplo Gmail, Outlook o el tuyo habitual.';
    }

    if (message.includes('anonymous')) {
      return 'Escribe correo y contrasena antes de crear la cuenta.';
    }

    if (message.includes('invalid login credentials')) {
      return 'Correo o contrasena incorrectos.';
    }

    return rawMessage;
  }

  function getFriendlyBackendError(error: unknown) {
    const rawMessage = getErrorMessage(error);
    if (!rawMessage) return 'No se pudo conectar con Supabase.';
    const message = rawMessage.toLowerCase();

    if (
      message.includes('ensure_default_group') ||
      message.includes('create_group') ||
      message.includes('delete_group') ||
      message.includes('schema cache') ||
      message.includes('pgrst202')
    ) {
      return 'Falta instalar la base de datos de ViveSong en Supabase. Ejecuta la migracion SQL desde el SQL Editor.';
    }

    if (message.includes('permission denied') || message.includes('grant select') || message.includes('42501')) {
      return 'Faltan permisos de lectura/escritura para usuarios autenticados en Supabase. Ejecuta la migracion 002_grant_authenticated_access.sql.';
    }

    if (message.includes('user from sub claim') || (message.includes('jwt') && message.includes('does not exist'))) {
      return 'La sesion guardada ya no existe en Supabase. Vuelve a iniciar sesion.';
    }

    return rawMessage;
  }

  useEffect(() => {
    void loadRemoteWorkspace();
  }, [loadRemoteWorkspace]);

  const visibleSongs = useMemo(
    () => songs.filter((song) => (syncMode === 'supabase' || canReadGroupResource(session, song.groupId)) && !song.archivedAt),
    [songs, session, syncMode],
  );
  const visibleSetlists = useMemo(
    () => setlists.filter((setlist) => canReadGroupResource(session, setlist.groupId)),
    [setlists, session],
  );
  const selectedSong = visibleSongs.find((song) => song.id === selectedSongId) ?? visibleSongs[0];
  const selectedGroupSong = visibleSongs.find((song) => song.id === selectedGroupSongId) ?? visibleSongs[0];
  const renderedSelectedSong = selectedSong ? transposeSong(selectedSong, songReaderSemitones) : undefined;
  const editingSong = visibleSongs.find((song) => song.id === editingSongId);
  const editorSong = editingSong ?? draftSong ?? undefined;
  const selectedSetlist = visibleSetlists.find((setlist) => setlist.id === selectedSetlistId) ?? visibleSetlists[0];
  const performanceSongs = selectedSetlist
    ? (selectedSetlist.items
        .map((item) => visibleSongs.find((song) => song.id === item.songId))
        .filter(Boolean) as Song[])
    : [];
  const performanceSong = performanceSongs[performanceIndex] ?? visibleSongs[0];
  const performanceItem = selectedSetlist?.items[performanceIndex];
  const performanceKeyOffset =
    performanceSong && performanceItem?.performanceKey ? getSemitoneDistance(performanceSong.key, performanceItem.performanceKey) : 0;
  const renderedPerformanceSong = performanceSong
    ? transposeSong(performanceSong, performanceKeyOffset + performanceSemitones)
    : undefined;

  const artists = [...new Set(visibleSongs.map((song) => song.artist))].sort();
  const tags = [...new Set(visibleSongs.flatMap((song) => song.tags))].sort();
  const filteredSongs = useMemo(() => filterSongs(visibleSongs, filters), [visibleSongs, filters]);
  const activeWorkspace = workspaces.find((workspace) => workspace.groupId === session.groupId);

  async function persistSong(song: Song) {
    if (syncMode !== 'supabase') return;
    try {
      await upsertSong(song);
      setSyncMessage('Cancion sincronizada.');
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'No se pudo sincronizar la cancion.');
    }
  }

  async function persistSetlist(setlist: Setlist) {
    if (syncMode !== 'supabase') return;
    try {
      await upsertSetlist(setlist);
      setSyncMessage('Repertorio sincronizado.');
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'No se pudo sincronizar el repertorio.');
    }
  }

  async function handleSignIn() {
    const credentials = getAuthCredentials();
    if (!credentials) return;
    setAuthSubmitting('signIn');
    try {
      await signInWithPassword(credentials.email, credentials.password);
      await openRemoteWorkspaceAfterAuth('Te uniste al grupo.');
    } catch (error) {
      setSyncMessage(getFriendlyAuthError(error, 'No se pudo iniciar sesion.'));
    } finally {
      setAuthSubmitting(null);
    }
  }

  async function handleSignUp() {
    const credentials = getAuthCredentials();
    if (!credentials) return;
    setAuthSubmitting('signUp');
    try {
      const signUpData = await signUpWithPassword(credentials.email, credentials.password);
      if (!signUpData.session) {
        setSyncMessage('Cuenta creada. Revisa tu correo para confirmarla y despues pulsa Entrar.');
        return;
      }

      await openRemoteWorkspaceAfterAuth('Cuenta creada y conectada.');
    } catch (error) {
      setSyncMessage(getFriendlyAuthError(error, 'No se pudo crear la cuenta.'));
    } finally {
      setAuthSubmitting(null);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setSyncMode('local');
      setInviteCode('');
      setUserEmail('');
      setJoinGroupCode('');
      setNewGroupName('');
      setWorkspaces([]);
      setSession(defaultSession);
      setSongs(loadSongs());
      setSetlists(loadSetlists());
      setSyncMessage('Sesion cerrada. Usando datos locales.');
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'No se pudo cerrar sesion.');
    }
  }

  async function handleSaveSong(input: SongInput) {
    if (!canManageSongs(session)) {
      setDuplicateWarning('Tu rol actual solo permite consultar canciones.');
      return;
    }

    const inputWithScope = { ...input, groupId: session.groupId, createdBy: session.userId };
    const duplicate = findDuplicateSong(visibleSongs, inputWithScope, editingSong?.id);
    if (duplicate) {
      setDuplicateWarning('');
      setDuplicatePrompt({
        message: `Ya existe una cancion llamada "${duplicate.title}" de ${duplicate.artist}.`,
        actionLabel: 'Crear version 2',
        inputs: [{ ...inputWithScope, title: getVersionTitle(input.title, input.artist, visibleSongs) }],
      });
      return;
    }

    setDuplicateWarning('');
    setDuplicatePrompt(null);
    setDiscardEditorRequested(false);
    setDraftSong(null);
    if (editingSong) {
      const saved = updateSong(editingSong, inputWithScope);
      setSongs((current) => current.map((song) => (song.id === saved.id ? saved : song)));
      setSelectedSongId(saved.id);
      setActiveView('song');
      await persistSong(saved);
    } else {
      const saved = createSong(inputWithScope);
      setSongs((current) => [saved, ...current]);
      setSelectedSongId(saved.id);
      setActiveView('song');
      await persistSong(saved);
    }
    setEditingSongId(undefined);
  }

  async function handleImportFiles(fileList: FileList | null) {
    if (!canManageSongs(session)) {
      setImportError('Tu rol actual solo permite consultar canciones.');
      return;
    }
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    try {
      setImportError('');
      setDuplicateWarning('');
      setDuplicatePrompt(null);
      const importedInputs = await Promise.all(files.map((file) => importSongFile(file)));
      const acceptedInputs: SongInput[] = [];
      const duplicateInputs: SongInput[] = [];

      for (const input of importedInputs) {
        const inputWithScope = { ...input, groupId: session.groupId, createdBy: session.userId };
        const duplicate = findDuplicateSongInputs(visibleSongs, acceptedInputs, inputWithScope);
        if (duplicate) {
          duplicateInputs.push({
            ...inputWithScope,
            title: getVersionTitle(input.title, input.artist, visibleSongs, acceptedInputs),
          });
        } else {
          acceptedInputs.push(inputWithScope);
        }
      }

      if (duplicateInputs.length > 0) {
        setDuplicatePrompt({
          message:
            duplicateInputs.length === 1
              ? `Ya existe esa cancion. Puedes importarla como "${duplicateInputs[0].title}".`
              : `${duplicateInputs.length} canciones ya existen. Puedes importarlas como versiones nuevas.`,
          actionLabel: duplicateInputs.length === 1 ? 'Importar version 2' : 'Importar versiones',
          inputs: duplicateInputs,
        });
      }

      if (acceptedInputs.length === 0) return;

      setImportPreview(acceptedInputs[0]);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'No se pudo importar el archivo.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function openSong(songId: string) {
    setDraftSong(null);
    setSelectedSongId(songId);
    setActiveView('song');
  }

  async function deleteSong(songId: string) {
    if (!canDeleteSongs(session)) return;
    setSongs((current) => current.filter((song) => song.id !== songId));
    setSetlists((current) =>
      current.map((setlist) => ({
        ...setlist,
        items: setlist.items.filter((item) => item.songId !== songId),
      })),
    );
    setActiveView('library');
    setSongPendingDelete(null);
    if (syncMode === 'supabase') {
      try {
        await deleteSongRemote(songId);
        setSyncMessage('Cancion eliminada en Supabase.');
      } catch (error) {
        setSyncMessage(error instanceof Error ? error.message : 'No se pudo borrar en Supabase.');
      }
    }
  }

  async function createNewSetlist() {
    const setlist = createSetlist(
      `Repertorio ${visibleSetlists.length + 1}`,
      new Date().toISOString().slice(0, 10),
      undefined,
      session.groupId,
    );
    setSetlists((current) => [setlist, ...current]);
    setSelectedSetlistId(setlist.id);
    await persistSetlist(setlist);
  }

  function changeSongReaderKey(nextKey: SongInput['key']) {
    if (!renderedSelectedSong) return;
    setSongReaderSemitones((current) => current + getSemitoneDistance(renderedSelectedSong.key, nextKey));
  }

  function saveDuplicateVersions(inputs: SongInput[]) {
    const versionDraft = createSong(inputs[0]);
    setDraftSong(versionDraft);
    setEditingSongId(undefined);
    setActiveView('editor');
    setDuplicatePrompt(null);
    setDuplicateWarning('');
  }

  function openImportDraft(input: SongInput) {
    const importedDraft = createSong({ ...input, groupId: session.groupId, createdBy: session.userId });
    setDraftSong(importedDraft);
    setEditingSongId(undefined);
    setImportPreview(null);
    setPasteImportOpen(false);
    setPastedSongText('');
    setActiveView('editor');
  }

  function importPastedSong() {
    try {
      const input = songInputFromText(pastedSongText, 'Cancion pegada');
      const scopedInput = { ...input, groupId: session.groupId, createdBy: session.userId };
      const duplicate = findDuplicateSong(visibleSongs, scopedInput);
      setImportError('');
      if (duplicate) {
        setDuplicatePrompt({
          message: `Ya existe esa cancion. Puedes importarla como "${getVersionTitle(input.title, input.artist, visibleSongs)}".`,
          actionLabel: 'Importar version 2',
          inputs: [{ ...scopedInput, title: getVersionTitle(input.title, input.artist, visibleSongs) }],
        });
        setPasteImportOpen(false);
        return;
      }
      setImportPreview(scopedInput);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'No se pudo interpretar el texto pegado.');
    }
  }

  async function duplicateSelectedSong(song: Song) {
    if (!canManageSongs(session)) return;
    const copy = duplicateSong(song, getVersionTitle(song.title, song.artist, visibleSongs));
    setSongs((current) => [copy, ...current]);
    setSelectedSongId(copy.id);
    setActiveView('song');
    await persistSong(copy);
  }

  async function archiveSelectedSong(song: Song) {
    if (!canArchiveSongs(session)) return;
    const archivedSong = archiveSong(song);
    setSongs((current) => current.map((candidate) => (candidate.id === song.id ? archivedSong : candidate)));
    setSetlists((current) =>
      current.map((setlist) => ({
        ...setlist,
        items: setlist.items.filter((item) => item.songId !== song.id),
      })),
    );
    setActiveView('library');
    await persistSong(archivedSong);
  }

  function exportSong(song: Song) {
    const blob = new Blob([buildChordProExport(song)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getChordProFileName(song);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function requestCloseEditor() {
    setDiscardEditorRequested(true);
  }

  function discardEditorChanges() {
    setDraftSong(null);
    setEditingSongId(undefined);
    setDuplicatePrompt(null);
    setDuplicateWarning('');
    setDiscardEditorRequested(false);
    setActiveView('library');
  }

  const duplicateAlert = duplicatePrompt ? (
    <div className="validation validation--warning duplicate-alert" role="alert">
      <span>{duplicatePrompt.message}</span>
      <button className="secondary-button" type="button" onClick={() => saveDuplicateVersions(duplicatePrompt.inputs)}>
        {duplicatePrompt.actionLabel}
      </button>
      <button className="icon-button" type="button" onClick={() => setDuplicatePrompt(null)} aria-label="Cerrar alerta">
        <X size={16} />
      </button>
    </div>
  ) : duplicateWarning ? (
    <div className="validation validation--warning" role="alert">
      {duplicateWarning}
    </div>
  ) : null;

  if (isSupabaseConfigured && authBootstrapping && syncMode !== 'supabase') {
    return (
      <main className="auth-screen">
        <section className="auth-card auth-card--loading" aria-live="polite">
          <div className="auth-brand">
            <div className="brand-mark">VS</div>
            <div>
              <strong>ViveSong</strong>
              <span>Repertorios en vivo</span>
            </div>
          </div>
          <div className="auth-copy">
            <p className="eyebrow">Sesion guardada</p>
            <h1>Abriendo ViveSong...</h1>
            <p>Estamos comprobando si este dispositivo ya tiene una sesion activa.</p>
          </div>
        </section>
      </main>
    );
  }

  if (isSupabaseConfigured && syncMode !== 'supabase') {
    return (
      <main className="auth-screen">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-brand">
            <div className="brand-mark">VS</div>
            <div>
              <strong>ViveSong</strong>
              <span>Repertorios en vivo</span>
            </div>
          </div>
            <div className="auth-copy">
              <p className="eyebrow">Acceso al grupo</p>
              <h1 id="auth-title">Inicia sesion para continuar</h1>
            <p>Entra con tu cuenta. Despues podras crear tu espacio o unirte al grupo que te hayan compartido.</p>
          </div>

          {syncMessage ? (
            <div className="validation" role="alert">
              {syncMessage}
            </div>
          ) : null}
          <p className="auth-hint">
            Para pruebas con el grupo, puedes desactivar la confirmacion por correo en Supabase y las cuentas entraran al momento.
          </p>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSignIn();
            }}
          >
            <label>
              Correo electronico
              <input
                autoComplete="email"
                inputMode="email"
                required
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="tu@email.com"
              />
            </label>
            <label>
              Contrasena
              <input
                autoComplete="current-password"
                minLength={6}
                required
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Minimo 6 caracteres"
              />
            </label>
            <div className="auth-actions">
              <button className="primary-button" disabled={authSubmitting !== null} type="submit">
                <LogIn size={18} /> {authSubmitting === 'signIn' ? 'Entrando...' : 'Entrar'}
              </button>
              <button className="secondary-button" disabled={authSubmitting !== null} type="button" onClick={() => void handleSignUp()}>
                {authSubmitting === 'signUp' ? 'Creando...' : 'Crear cuenta'}
              </button>
            </div>
          </form>
          <p className="auth-note">Tus canciones y repertorios se guardaran en Supabase para poder usarlos fuera de tu red local.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">VS</div>
          <div>
            <strong>ViveSong</strong>
            <span>Repertorios en vivo</span>
          </div>
        </div>
        <nav aria-label="Principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view || (activeView === 'song' && item.view === 'library');
            return (
              <button
                className={isActive ? 'nav-button is-active' : 'nav-button'}
                key={item.view}
                onClick={() => setActiveView(item.view)}
              >
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>
        {syncMode === 'supabase' ? null : (
          <label className="role-switcher">
            Rol local
            <select
              aria-label="Rol local"
              value={session.role}
              onChange={(event) => setSession((current) => ({ ...current, role: event.target.value as GroupRole }))}
            >
              {(['admin', 'editor', 'musician'] as GroupRole[]).map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="sidebar-summary">
          {syncMode === 'supabase' ? <span>{activeWorkspace?.name ?? 'Sin grupo activo'}</span> : null}
          {syncMode === 'supabase' && userEmail ? <span>{userEmail}</span> : null}
          <span>{visibleSongs.length} canciones</span>
          <span>{visibleSetlists.length} repertorios</span>
          {syncMode === 'supabase' ? (
            <button className="sidebar-link-button" type="button" onClick={() => void handleSignOut()}>
              Salir
            </button>
          ) : null}
        </div>
      </aside>

      <main>
        {activeView === 'library' ? (
          <section className="workspace">
            <div className="workspace-header">
              <div>
                <p className="eyebrow">Biblioteca</p>
                <h1>Cancionero compartido</h1>
              </div>
              <div className="toolbar">
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  multiple
                  accept=".txt,.cho,.chordpro,.pro,.pdf,text/plain,application/pdf"
                  onChange={(event) => void handleImportFiles(event.target.files)}
                />
                <button className="secondary-button" disabled={!canManageSongs(session)} onClick={() => setPasteImportOpen(true)}>
                  <FileText size={18} /> Pegar texto
                </button>
                <button className="secondary-button" disabled={!canManageSongs(session)} onClick={() => fileInputRef.current?.click()}>
                  <Upload size={18} /> Importar cancion
                </button>
                <button
                  className="primary-button"
                  disabled={!canManageSongs(session)}
                  onClick={() => {
                    setEditingSongId(undefined);
                    setDraftSong(null);
                    setActiveView('editor');
                  }}
                >
                  <Plus size={18} /> Nueva cancion
                </button>
              </div>
            </div>

            {!canManageSongs(session) ? (
              <div className="validation validation--warning" role="status">
                Estas en modo Musico: puedes consultar y transponer en tu vista, pero no modificar canciones.
              </div>
            ) : null}

            {importError ? (
              <div className="validation" role="alert">
                {importError}
              </div>
            ) : null}

            {duplicateAlert}

            <div className="filters">
              <label className="search-box">
                <Search size={18} />
                <input
                  aria-label="Buscar canciones"
                  placeholder="Buscar por titulo, artista, etiqueta o letra"
                  value={filters.query}
                  onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                />
              </label>
              <select
                aria-label="Filtrar por artista"
                value={filters.artist}
                onChange={(event) => setFilters((current) => ({ ...current, artist: event.target.value }))}
              >
                <option value="">Todos los artistas</option>
                {artists.map((artist) => (
                  <option key={artist}>{artist}</option>
                ))}
              </select>
              <select
                aria-label="Filtrar por tonalidad"
                value={filters.key}
                onChange={(event) => setFilters((current) => ({ ...current, key: event.target.value }))}
              >
                <option value="">Todas las tonalidades</option>
                {musicalKeys.map((key) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
              <select
                aria-label="Filtrar por etiqueta"
                value={filters.tag}
                onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}
              >
                <option value="">Todas las etiquetas</option>
                {tags.map((tag) => (
                  <option key={tag}>{tag}</option>
                ))}
              </select>
            </div>

            <div className="library-only-layout">
              <div className="song-table" role="list" aria-label="Listado de canciones">
                <div className="song-table-header" aria-hidden="true">
                  <span>Cancion</span>
                  <span>Tono</span>
                  <span>Tempo</span>
                  <span>Etiquetas</span>
                  <span>Duracion</span>
                  <span />
                </div>
                {filteredSongs.map((song) => (
                  <button className="song-table-row" key={song.id} onClick={() => openSong(song.id)}>
                    <span className="song-title-cell">
                      <strong>{song.title}</strong>
                      <small>{song.artist}</small>
                    </span>
                    <span className="key-pill" translate="no">
                      {song.key}
                    </span>
                    <span className="song-tempo-cell" translate="no">
                      {song.tempo} BPM
                    </span>
                    <span className="song-tags-cell">
                      {song.tags.slice(0, 3).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </span>
                    <span className="song-duration-cell">{formatDuration(song.durationSeconds)}</span>
                    <ChevronRight size={18} className="row-chevron" />
                  </button>
                ))}
                {filteredSongs.length === 0 ? <div className="empty-state">No hay canciones visibles con estos filtros.</div> : null}
              </div>
            </div>
          </section>
        ) : null}

        {activeView === 'song' && selectedSong && renderedSelectedSong ? (
          <section className="workspace">
            <article className="song-detail song-detail--reader">
              <div className="song-reader-header">
                <div className="song-reader-title">
                  <button className="secondary-button back-button" onClick={() => setActiveView('library')}>
                    <ArrowLeft size={18} /> Biblioteca
                  </button>
                  <p className="eyebrow">{selectedSong.artist}</p>
                  <h1>{selectedSong.title}</h1>
                  <div className="meta-strip">
                    <span translate="no">{renderedSelectedSong.key}</span>
                    <span translate="no">{selectedSong.tempo} BPM</span>
                    <span translate="no">{selectedSong.timeSignature}</span>
                    <span>{formatDuration(selectedSong.durationSeconds)}</span>
                  </div>
                </div>
                <div className="song-reader-actions">
                  <div className="transpose-control transpose-control--compact" aria-label="Cambiar tono">
                    <span>Cambiar tono</span>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => setSongReaderSemitones((value) => value - 1)}
                      aria-label="Bajar tono"
                    >
                      -
                    </button>
                    <select
                      aria-label="Cambiar tono de la cancion"
                      translate="no"
                      value={renderedSelectedSong.key}
                      onChange={(event) => changeSongReaderKey(event.target.value as SongInput['key'])}
                    >
                      {musicalKeys.map((key) => (
                        <option key={key}>{key}</option>
                      ))}
                    </select>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => setSongReaderSemitones((value) => value + 1)}
                      aria-label="Subir tono"
                    >
                      +
                    </button>
                  </div>
                  <button className="secondary-button" onClick={() => setSongReaderSemitones(0)}>
                    Reiniciar tono
                  </button>
                  <button className="secondary-button" onClick={() => exportSong(selectedSong)}>
                    <Download size={17} /> Exportar
                  </button>
                  <button className="secondary-button" disabled={!canManageSongs(session)} onClick={() => duplicateSelectedSong(selectedSong)}>
                    <Copy size={17} /> Duplicar
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!canEditSong(session, selectedSong)}
                    onClick={() => {
                      setEditingSongId(selectedSong.id);
                      setActiveView('editor');
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!canArchiveSongs(session)}
                    onClick={() => archiveSelectedSong(selectedSong)}
                  >
                    <Archive size={17} /> Archivar
                  </button>
                  <button
                    className="icon-button danger"
                    disabled={!canDeleteSongs(session)}
                    aria-label="Eliminar cancion"
                    title="Eliminar"
                    onClick={() => setSongPendingDelete(selectedSong)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="song-reader-content">
                <div className="tag-list">
                  {selectedSong.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                {selectedSong.notes.trim() ? <p className="song-notes">{selectedSong.notes}</p> : null}
                <ChordPreview source={renderedSelectedSong.chordPro} />
              </div>
            </article>
          </section>
        ) : null}

        {activeView === 'editor' ? (
          <>
            {duplicateAlert ? <div className="editor-alert">{duplicateAlert}</div> : null}
            <SongEditor
              key={editorSong?.id ?? 'new-song'}
              song={editorSong}
              onCancel={requestCloseEditor}
              onSave={handleSaveSong}
            />
          </>
        ) : null}

        {activeView === 'groups' ? (
          <section className="workspace">
            <div className="workspace-header">
              <div>
                <p className="eyebrow">Grupos</p>
                <h1>Gestiona equipos y accesos</h1>
              </div>
              <button className="secondary-button" type="button" onClick={() => void loadRemoteWorkspace()}>
                Actualizar
              </button>
            </div>

            {syncMode === 'supabase' && syncMessage ? <p className="page-status">{syncMessage}</p> : null}

            <section className="group-detail-panel">
              <div className="group-detail-header">
                <div>
                  <p className="eyebrow">Grupo activo</p>
                  <h2>{activeWorkspace?.name ?? 'Sin grupo activo'}</h2>
                </div>
                <div className="group-header-actions">
                  <div className="group-code-box">
                    <span>Codigo</span>
                    <strong translate="no">{inviteCode || 'Sin codigo'}</strong>
                  </div>
                  <button className="secondary-button" type="button" disabled={!inviteCode} onClick={() => void copyInviteCode(inviteCode)}>
                    <Copy size={17} /> Copiar
                  </button>
                  {activeWorkspace?.role === 'admin' ? (
                    <button className="danger-button" type="button" onClick={() => setGroupPendingDelete(activeWorkspace)}>
                      <Trash2 size={17} /> Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="group-summary-strip">
                <span>{visibleSongs.length} canciones disponibles</span>
                <span>{visibleSetlists.length} repertorios del grupo</span>
                <span>{roleLabel(session.role)}</span>
              </div>
              <div className="group-content-grid">
                <section>
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Cancionero</p>
                      <h3>Canciones disponibles</h3>
                    </div>
                    <button className="secondary-button" type="button" onClick={() => setActiveView('library')}>
                      Biblioteca
                    </button>
                  </div>
                  <div className="group-mini-list">
                    {visibleSongs.slice(0, 8).map((song) => (
                      <button
                        className={selectedGroupSong?.id === song.id ? 'is-active' : ''}
                        key={song.id}
                        type="button"
                        onClick={() => setSelectedGroupSongId(song.id)}
                      >
                        <span>
                          <strong>{song.title}</strong>
                          <small>{song.artist}</small>
                        </span>
                        <span translate="no">{song.key}</span>
                      </button>
                    ))}
                    {visibleSongs.length === 0 ? <p className="empty-state">No hay canciones subidas en la biblioteca.</p> : null}
                  </div>
                </section>

                <section className="group-song-panel">
                  {selectedGroupSong ? (
                    <>
                      <div className="panel-header">
                        <div>
                          <p className="eyebrow">Cancion seleccionada</p>
                          <h3>{selectedGroupSong.title}</h3>
                        </div>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={!canEditSong(session, selectedGroupSong)}
                          onClick={() => {
                            setEditingSongId(selectedGroupSong.id);
                            setActiveView('editor');
                          }}
                        >
                          Editar
                        </button>
                      </div>
                      <div className="meta-strip">
                        <span>{selectedGroupSong.artist}</span>
                        <span translate="no">{selectedGroupSong.key}</span>
                        <span>{formatDuration(selectedGroupSong.durationSeconds)}</span>
                      </div>
                      <div className="group-song-preview">
                        <ChordPreview source={selectedGroupSong.chordPro} />
                      </div>
                    </>
                  ) : (
                    <p className="empty-state">Selecciona una cancion para verla dentro del grupo.</p>
                  )}
                </section>
              </div>

              <section className="group-repertoire-strip">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Repertorios</p>
                    <h3>Del grupo activo</h3>
                  </div>
                  <button className="secondary-button" type="button" onClick={() => setActiveView('setlists')}>
                    Ver repertorios
                  </button>
                </div>
                <div className="group-mini-list group-mini-list--inline">
                  {visibleSetlists.slice(0, 4).map((setlist) => (
                    <button
                      key={setlist.id}
                      type="button"
                      onClick={() => {
                        setSelectedSetlistId(setlist.id);
                        setActiveView('setlists');
                      }}
                    >
                      <span>
                        <strong>{setlist.name}</strong>
                        <small>{setlist.date}</small>
                      </span>
                      <span>{setlist.items.length}</span>
                    </button>
                  ))}
                  {visibleSetlists.length === 0 ? <p className="empty-state">Este grupo todavia no tiene repertorios.</p> : null}
                </div>
              </section>
            </section>

            <details className="group-management-panel">
              <summary>Administrar grupos</summary>
              <div className="groups-layout">
              <section className="form-panel group-form-panel">
                <div>
                  <p className="eyebrow">Nuevo grupo</p>
                  <h2>Crear grupo</h2>
                </div>
                <label>
                  Nombre del grupo
                  <input
                    autoComplete="off"
                    maxLength={80}
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    placeholder="Vive Worship"
                  />
                </label>
                <button className="primary-button" type="button" onClick={() => void handleCreateWorkspace()}>
                  <Plus size={18} /> Crear grupo
                </button>
              </section>

              <section className="form-panel group-form-panel">
                <div>
                  <p className="eyebrow">Invitacion</p>
                  <h2>Unirme a un grupo</h2>
                </div>
                <label>
                  Codigo del administrador
                  <input
                    autoComplete="off"
                    value={joinGroupCode}
                    onChange={(event) => setJoinGroupCode(event.target.value)}
                    placeholder="Ej. F889F42F"
                  />
                </label>
                <button className="secondary-button" type="button" onClick={() => void handleJoinWorkspace()}>
                  Unirme
                </button>
              </section>
              </div>
            </details>

            <section className="group-list-section">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Mis grupos</p>
                  <h2>Espacios compartidos</h2>
                </div>
              </div>
              <div className="group-card-grid">
                {workspaces.map((workspace) => (
                  <article className={workspace.groupId === session.groupId ? 'group-card is-active' : 'group-card'} key={workspace.groupId}>
                    <div>
                      <strong>{workspace.name}</strong>
                      <span>{roleLabel(workspace.role)}</span>
                    </div>
                    <code translate="no">{workspace.inviteCode}</code>
                    <div className="toolbar">
                      <button className="secondary-button" type="button" onClick={() => void switchWorkspace(workspace)}>
                        Abrir grupo
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Copiar codigo de ${workspace.name}`}
                        title="Copiar codigo"
                        onClick={() => void copyInviteCode(workspace.inviteCode)}
                      >
                        <Copy size={17} />
                      </button>
                      {workspace.role === 'admin' ? (
                        <button
                          className="icon-button danger"
                          type="button"
                          aria-label={`Eliminar ${workspace.name}`}
                          title="Eliminar grupo"
                          onClick={() => setGroupPendingDelete(workspace)}
                        >
                          <Trash2 size={17} />
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
                {workspaces.length === 0 ? <p className="empty-state">Crea un grupo o unete con un codigo para empezar.</p> : null}
              </div>
            </section>
          </section>
        ) : null}

        {activeView === 'profile' ? (
          <section className="workspace">
            <div className="workspace-header">
              <div>
                <p className="eyebrow">Perfil</p>
                <h1>Cuenta y preferencias</h1>
              </div>
              <button className="secondary-button" type="button" onClick={() => void loadRemoteWorkspace()}>
                Actualizar
              </button>
            </div>

            {syncMessage ? <p className="page-status">{syncMessage}</p> : null}

            <div className="profile-layout">
              <section className="profile-card profile-card--hero">
                <div className="profile-avatar" aria-hidden="true">
                  {(userEmail || 'VS').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="eyebrow">Usuario</p>
                  <h2>{userEmail || 'Usuario local'}</h2>
                  <span>{syncMode === 'supabase' ? 'Conectado con Supabase' : 'Modo local'}</span>
                </div>
              </section>

              <section className="profile-card">
                <p className="eyebrow">Sesion</p>
                <div className="profile-field-list">
                  <div>
                    <span>Rol actual</span>
                    <strong>{roleLabel(session.role)}</strong>
                  </div>
                  <div>
                    <span>Grupo activo</span>
                    <strong>{activeWorkspace?.name ?? 'Sin grupo activo'}</strong>
                  </div>
                  <div>
                    <span>Identificador</span>
                    <strong translate="no">{session.userId}</strong>
                  </div>
                </div>
              </section>

              <section className="profile-card">
                <p className="eyebrow">Actividad</p>
                <div className="profile-stat-grid">
                  <div>
                    <strong>{visibleSongs.length}</strong>
                    <span>Canciones</span>
                  </div>
                  <div>
                    <strong>{visibleSetlists.length}</strong>
                    <span>Repertorios</span>
                  </div>
                  <div>
                    <strong>{workspaces.length}</strong>
                    <span>Grupos</span>
                  </div>
                </div>
              </section>

              <section className="profile-card">
                <p className="eyebrow">Acciones</p>
                <div className="profile-actions">
                  <button className="secondary-button" type="button" onClick={() => setActiveView('groups')}>
                    <UsersRound size={17} /> Gestionar grupos
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setActiveView('library')}>
                    <Library size={17} /> Abrir biblioteca
                  </button>
                  {syncMode === 'supabase' ? (
                    <button className="danger-button" type="button" onClick={() => void handleSignOut()}>
                      Salir
                    </button>
                  ) : null}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeView === 'setlists' ? (
          <section className="workspace">
            <div className="workspace-header">
              <div>
                <p className="eyebrow">Repertorios</p>
                <h1>Ordena el servicio antes de salir al escenario</h1>
              </div>
              <button className="primary-button" onClick={createNewSetlist}>
                <Plus size={18} /> Nuevo repertorio
              </button>
            </div>

            <div className="setlist-layout">
              <div className="song-list">
                {visibleSetlists.map((setlist) => (
                  <button
                    className={selectedSetlist?.id === setlist.id ? 'song-row is-selected' : 'song-row'}
                    key={setlist.id}
                    onClick={() => setSelectedSetlistId(setlist.id)}
                  >
                    <span>
                      <strong>{setlist.name}</strong>
                      <small>{setlist.date}</small>
                    </span>
                      <span className="song-meta">{formatDuration(getSetlistDurationSeconds(setlist, visibleSongs))}</span>
                  </button>
                ))}
              </div>

              {selectedSetlist ? (
                <article className="song-detail">
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">{selectedSetlist.date}</p>
                      <h2>{selectedSetlist.name}</h2>
                      <div className="meta-strip">
                        <span>{selectedSetlist.items.length} canciones</span>
                        <span>{formatDuration(getSetlistDurationSeconds(selectedSetlist, visibleSongs))}</span>
                      </div>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setPerformanceIndex(0);
                        setActiveView('performance');
                      }}
                    >
                      Abrir directo
                    </button>
                  </div>

                  <div className="setlist-builder">
                    <div>
                      <h3>Canciones disponibles</h3>
                      {visibleSongs.map((song) => (
                        <button
                          key={song.id}
                          className="compact-row"
                          onClick={() => {
                            const updatedSetlist = addSongToSetlist(selectedSetlist, song.id);
                            setSetlists((current) =>
                              current.map((setlist) => (setlist.id === selectedSetlist.id ? updatedSetlist : setlist)),
                            );
                            void persistSetlist(updatedSetlist);
                          }}
                        >
                          <Plus size={16} /> {song.title}
                        </button>
                      ))}
                    </div>
                    <div>
                      <h3>Orden del repertorio</h3>
                      {selectedSetlist.items.map((item, index) => {
                        const song = visibleSongs.find((candidate) => candidate.id === item.songId);
                        if (!song) return null;
                        return (
                          <div className="setlist-item" key={item.songId}>
                            <span>
                              {index + 1}. {song.title}
                              <small>{item.notes}</small>
                            </span>
                            <div className="toolbar">
                              <select
                                aria-label={`Tono de ${song.title} en repertorio`}
                                value={item.performanceKey ?? song.key}
                                onChange={(event) => {
                                  const updatedSetlist = setSetlistSongKey(
                                    selectedSetlist,
                                    song.id,
                                    event.target.value as SongInput['key'],
                                  );
                                  setSetlists((current) =>
                                    current.map((setlist) =>
                                      setlist.id === selectedSetlist.id ? updatedSetlist : setlist,
                                    ),
                                  );
                                  void persistSetlist(updatedSetlist);
                                }}
                              >
                                {musicalKeys.map((key) => (
                                  <option key={key}>{key}</option>
                                ))}
                              </select>
                              <button
                                className="icon-button"
                                aria-label="Subir cancion"
                                title="Subir"
                                onClick={() => {
                                  const updatedSetlist = moveSetlistItem(selectedSetlist, index, index - 1);
                                  setSetlists((current) =>
                                    current.map((setlist) =>
                                      setlist.id === selectedSetlist.id ? updatedSetlist : setlist,
                                    ),
                                  );
                                  void persistSetlist(updatedSetlist);
                                }}
                              >
                                <ArrowUp size={16} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label="Bajar cancion"
                                title="Bajar"
                                onClick={() => {
                                  const updatedSetlist = moveSetlistItem(selectedSetlist, index, index + 1);
                                  setSetlists((current) =>
                                    current.map((setlist) =>
                                      setlist.id === selectedSetlist.id ? updatedSetlist : setlist,
                                    ),
                                  );
                                  void persistSetlist(updatedSetlist);
                                }}
                              >
                                <ArrowDown size={16} />
                              </button>
                              <button
                                className="icon-button danger"
                                aria-label="Quitar cancion"
                                title="Quitar"
                                onClick={() => {
                                  const updatedSetlist = removeSongFromSetlist(selectedSetlist, song.id);
                                  setSetlists((current) =>
                                    current.map((setlist) =>
                                      setlist.id === selectedSetlist.id ? updatedSetlist : setlist,
                                    ),
                                  );
                                  void persistSetlist(updatedSetlist);
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeView === 'performance' && renderedPerformanceSong ? (
          <section className="performance-view">
            <div className="performance-topbar">
              <button className="secondary-button" onClick={() => setActiveView('setlists')}>
                <ArrowLeft size={18} /> Repertorios
              </button>
              <div>
                <p>{selectedSetlist?.name ?? 'Biblioteca'}</p>
                <h1>{renderedPerformanceSong.title}</h1>
              </div>
              <div className="toolbar">
                <button
                  className="icon-button"
                  aria-label="Bajar tono"
                  title="Bajar tono"
                  onClick={() => setPerformanceSemitones((value) => value - 1)}
                >
                  -
                </button>
                <span className="transpose-badge" translate="no">
                  {renderedPerformanceSong.key}
                </span>
                <button
                  className="icon-button"
                  aria-label="Subir tono"
                  title="Subir tono"
                  onClick={() => setPerformanceSemitones((value) => value + 1)}
                >
                  +
                </button>
                <Moon size={18} />
              </div>
            </div>
            <ChordPreview source={renderedPerformanceSong.chordPro} large />
            <div className="performance-footer">
              <button
                className="secondary-button"
                disabled={performanceIndex === 0}
                onClick={() => setPerformanceIndex((index) => Math.max(0, index - 1))}
              >
                <ArrowLeft size={18} /> Anterior
              </button>
              <span>
                {performanceIndex + 1} / {Math.max(performanceSongs.length, 1)}
              </span>
              <button
                className="secondary-button"
                disabled={performanceIndex >= performanceSongs.length - 1}
                onClick={() => setPerformanceIndex((index) => Math.min(performanceSongs.length - 1, index + 1))}
              >
                Siguiente <ArrowRight size={18} />
              </button>
            </div>
          </section>
        ) : null}
      </main>

      {songPendingDelete ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-song-title">
            <div>
              <p className="eyebrow">Confirmar borrado</p>
              <h2 id="delete-song-title">Eliminar cancion</h2>
            </div>
            <p>
              Vas a borrar <strong>{songPendingDelete.title}</strong>. Esta accion tambien la quitara de los repertorios.
            </p>
            <div className="toolbar confirm-actions">
              <button className="secondary-button" onClick={() => setSongPendingDelete(null)}>
                Cancelar
              </button>
              <button className="danger-button" onClick={() => deleteSong(songPendingDelete.id)}>
                Eliminar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {groupPendingDelete ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-group-title">
            <div>
              <p className="eyebrow">Confirmar borrado</p>
              <h2 id="delete-group-title">Eliminar grupo</h2>
            </div>
            <p>
              Vas a quitar <strong>{groupPendingDelete.name}</strong> de la app. Sus canciones y repertorios se conservaran
              en Supabase.
            </p>
            <div className="toolbar confirm-actions">
              <button className="secondary-button" onClick={() => setGroupPendingDelete(null)}>
                Cancelar
              </button>
              <button className="danger-button" onClick={() => void handleDeleteWorkspace()}>
                Eliminar grupo
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {discardEditorRequested ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="discard-editor-title">
            <div>
              <p className="eyebrow">Cambios sin guardar</p>
              <h2 id="discard-editor-title">Descartar cambios</h2>
            </div>
            <p>Si sales ahora, los cambios no guardados se perderan. La cancion solo se guardara cuando pulses Guardar.</p>
            <div className="toolbar confirm-actions">
              <button className="secondary-button" onClick={() => setDiscardEditorRequested(false)}>
                Cancelar
              </button>
              <button className="danger-button" onClick={discardEditorChanges}>
                Descartar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {pasteImportOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="paste-import-title">
            <div>
              <p className="eyebrow">Importar cancion</p>
              <h2 id="paste-import-title">Pegar letra o ChordPro</h2>
            </div>
            <textarea
              aria-label="Texto de la cancion"
              value={pastedSongText}
              onChange={(event) => setPastedSongText(event.target.value)}
              placeholder="{title: Gracia sublime}\n{artist: Equipo}\n{key: G}\n\n[G]Sublime gracia del [C]Senor"
            />
            <div className="toolbar confirm-actions">
              <button className="secondary-button" onClick={() => setPasteImportOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button" onClick={importPastedSong}>
                Previsualizar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {importPreview ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
            <div>
              <p className="eyebrow">Vista previa</p>
              <h2 id="import-preview-title">{importPreview.title}</h2>
            </div>
            <div className="import-summary">
              <span>{importPreview.artist}</span>
              <span translate="no">{importPreview.key}</span>
              <span translate="no">{importPreview.tempo} BPM</span>
            </div>
            <div className="import-preview-box">
              <ChordPreview source={importPreview.chordPro} />
            </div>
            <div className="toolbar confirm-actions">
              <button className="secondary-button" onClick={() => setImportPreview(null)}>
                Cancelar
              </button>
              <button className="primary-button" onClick={() => openImportDraft(importPreview)}>
                Abrir en editor
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;

function findDuplicateSong(songs: Song[], input: SongInput, ignoreSongId?: string): Song | undefined {
  const nextIdentity = getSongIdentity(input.title, input.artist);
  return songs.find((song) => song.id !== ignoreSongId && getSongIdentity(song.title, song.artist) === nextIdentity);
}

function findDuplicateSongInputs(songs: Song[], acceptedInputs: SongInput[], input: SongInput): boolean {
  const nextIdentity = getSongIdentity(input.title, input.artist);
  return (
    songs.some((song) => getSongIdentity(song.title, song.artist) === nextIdentity) ||
    acceptedInputs.some((accepted) => getSongIdentity(accepted.title, accepted.artist) === nextIdentity)
  );
}

function getVersionTitle(title: string, artist: string, songs: Song[], acceptedInputs: SongInput[] = []): string {
  let version = 2;
  let candidate = `${title} Version ${version}`;
  while (
    songs.some((song) => getSongIdentity(song.title, song.artist) === getSongIdentity(candidate, artist)) ||
    acceptedInputs.some((input) => getSongIdentity(input.title, input.artist) === getSongIdentity(candidate, artist))
  ) {
    version += 1;
    candidate = `${title} Version ${version}`;
  }
  return candidate;
}

function getSongIdentity(title: string, artist: string): string {
  return `${normalizeSongIdentityPart(title)}::${normalizeSongIdentityPart(artist)}`;
}

function normalizeSongIdentityPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
