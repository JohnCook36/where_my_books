import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import type { LibraryBookResponse, ProgressDisplayMode, ShelfAction, ShelfLayout, ShelfMutation, ShelfMutationResponse, ShelfTheme, StorageKind } from '@where-my-books/shared';
import { formatReadingProgress, insertCopies } from '@where-my-books/shared';
import { AppHeader, EmptyState, LoadingState, PillButton, ScreenContainer, ScreenContent, ScreenScroll, SegmentedControl } from '@/components';
import { shelfVisuals, typography } from '@/theme';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../auth/AuthProvider';
import { BookCover } from '../catalog/BookCover';
import { Field, Note, Row, Choice } from '../catalog/styles';
import { useReviewNavigationGuard } from '../catalog/useReviewNavigationGuard';
import { MotionShelfRow } from './MotionShelfRow';
import { MotionDialog } from './MotionDialog';
import { indexShelfLocations } from './location';
const emptyLayout: ShelfLayout = { revision: 0, rooms: [], shelves: [], sections: [], rows: [], placements: [] };
type Form = { type: 'create_room' | 'create_shelf' | 'create_section' | 'create_row' | 'rename'; kind?: StorageKind; id?: string };
const themes: { value: ShelfTheme; label: string }[] = [{ value: 'oak', label: 'Тёплый дуб' }, { value: 'ivory', label: 'Светлый' }, { value: 'night', label: 'Тёмный' }];
const short = (text: string) => text.length > 56 ? `${text.slice(0, 56)}…` : text || ' ';
export default function ShelvesScreen() {
  const { user } = useAuth();
  return <ShelfWorkspace key={user?.id ?? 'guest'} />;
}
function ShelfWorkspace() {
  const router = useRouter(); const params = useLocalSearchParams<{ copyId?: string; copyIds?: string }>(); const { height } = useWindowDimensions();
  const [layout, setLayout] = useState<ShelfLayout>(emptyLayout); const [books, setBooks] = useState<LibraryBookResponse[]>([]);
  const [mode, setMode] = useState<ProgressDisplayMode>('pages'); const [roomId, setRoomId] = useState(''); const [shelfId, setShelfId] = useState(''); const [sectionId, setSectionId] = useState(''); const [rowId, setRowId] = useState('');
  const [selectedId, setSelectedId] = useState<string>(); const [bookDialog, setBookDialog] = useState(false);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const inFlight = useRef(false); const bypass = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [pending, setPending] = useState<ShelfMutation | null>(null); const [receipt, setReceipt] = useState<ShelfMutationResponse>();
  const [query, setQuery] = useState(''); const [picker, setPicker] = useState(false); const [allBooks, setAllBooks] = useState(false); const [chosen, setChosen] = useState<string[]>([]);
  const [moveIds, setMoveIds] = useState<string[]>([]); const [destination, setDestination] = useState<string | null>(null); const [position, setPosition] = useState('');
  const [form, setForm] = useState<Form>(); const [name, setName] = useState(''); const [sections, setSections] = useState('2'); const [rows, setRows] = useState('4'); const [capacity, setCapacity] = useState('80'); const [theme, setTheme] = useState<ShelfTheme>('oak');
  const [manage, setManage] = useState(false); const [deleting, setDeleting] = useState<{ kind: StorageKind; id: string }>();
  useReviewNavigationGuard(false, bypass, busy);
  const focusRow = useCallback((data: ShelfLayout, id: string) => {
    const row = data.rows.find((r) => r.id === id); const section = data.sections.find((s) => s.id === row?.sectionId); const shelf = data.shelves.find((s) => s.id === section?.shelfId);
    if (row && section && shelf) { setRowId(row.id); setSectionId(section.id); setShelfId(shelf.id); setRoomId(shelf.roomId); }
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true; setLoading(true);
    void Promise.all([api.shelfLayout(), api.books(), api.settings()]).then(([data, library, settings]) => {
      if (!active) return; setLayout(data); setBooks(library.books); setMode(settings.settings.progressDisplayMode); setError('');
      const requested = (typeof params.copyIds === 'string' ? params.copyIds : typeof params.copyId === 'string' ? params.copyId : '').split(',').filter((id) => library.books.some((b) => b.id === id)).slice(0, 50);
      if (requested.length) {
        setSelectedId(requested[0]); const placement = data.placements.find((p) => p.copyId === requested[0]);
        if (placement && requested.length === 1) focusRow(data, placement.rowId); else { setMoveIds(requested); setDestination(null); }
      }
    }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Не удалось загрузить шкафы'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [focusRow, params.copyId, params.copyIds]));
  const room = layout.rooms.find((r) => r.id === roomId) ?? layout.rooms[0];
  const roomShelves = layout.shelves.filter((s) => s.roomId === room?.id); const shelf = roomShelves.find((s) => s.id === shelfId) ?? roomShelves[0];
  const shelfSections = layout.sections.filter((s) => s.shelfId === shelf?.id); const section = shelfSections.find((s) => s.id === sectionId) ?? shelfSections[0];
  const sectionRows = layout.rows.filter((r) => r.sectionId === section?.id); const row = sectionRows.find((r) => r.id === rowId) ?? sectionRows[0];
  const bookMap = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const locations = useMemo(() => indexShelfLocations(layout), [layout]);
  const copyLocation = (id: string) => locations.copies.get(id)?.path ?? 'Вне полок';
  const rowPath = (id: string) => locations.rows.get(id) ?? '';
  const rowBooks = row ? layout.placements.filter((p) => p.rowId === row.id).sort((a, b) => a.position - b.position).flatMap((p) => bookMap.get(p.copyId) ?? []) : [];
  const selected = books.find((b) => b.id === selectedId); const disabled = busy || !!pending;
  const searchText = query.trim().toLocaleLowerCase('ru');
  const matches = books.filter((book) => `${book.work.title} ${book.work.authors.map((a) => a.name).join(' ')} ${book.edition.isbn ?? ''} ${copyLocation(book.id)}`.toLocaleLowerCase('ru').includes(searchText));
  const loadLatest = async () => { const [data, library] = await Promise.all([api.shelfLayout(), api.books()]); setLayout(data); setBooks(library.books); return data; };
  const execute = async (request: ShelfMutation): Promise<boolean> => {
    if (inFlight.current) return false; inFlight.current = true; setBusy(true); setError(''); setNotice('Сохраняем расположение…');
    try {
      const result = await api.mutateShelf(request); const latest = await loadLatest(); setPending(null); setReceipt(result.canUndo && latest.revision === result.revision ? result : undefined); setNotice('Расположение сохранено');
      if (request.action.type === 'move' && request.action.rowId) { focusRow(latest, request.action.rowId); setSelectedId(request.action.copyIds[0]); }
      if (request.action.type.startsWith('create_') || request.action.type === 'rename') setForm(undefined);
      if (request.action.type === 'delete') { setDeleting(undefined); setManage(false); }
      if (request.action.type === 'move') { setPicker(false); setChosen([]); setMoveIds([]); setBookDialog(false); }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ответ не получен. Повторите подтверждение.'); setNotice('');
      if (err instanceof ApiError && err.status < 500) { setPending(null); setReceipt(undefined); await loadLatest().catch(() => {}); }
      else setPending(request);
      return false;
    } finally { setBusy(false); inFlight.current = false; }
  };
  const commit = async (action: ShelfAction) => {
    if (disabled || inFlight.current) return false;
    const request: ShelfMutation = { requestId: Crypto.randomUUID(), baseRevision: layout.revision, action };
    if (action.type === 'move' && action.rowId && action.copyIds.every((id) => layout.placements.some((p) => p.copyId === id && p.rowId === action.rowId))) {
      const ids = layout.placements.filter((p) => p.rowId === action.rowId).sort((a, b) => a.position - b.position).map((p) => p.copyId);
      const ordered = insertCopies(ids, action.copyIds, action.beforeCopyId ?? null);
      setLayout({ ...layout, placements: layout.placements.map((p) => p.rowId === action.rowId ? { ...p, position: ordered.indexOf(p.copyId) } : p) });
    }
    return execute(request);
  };
  const openForm = (value: Form, currentName = '') => { setForm(value); setName(currentName); setManage(false); setError(''); };
  const submitForm = async () => {
    if (!form) return; let action: ShelfAction;
    switch (form.type) {
      case 'create_room': action = { type: form.type, id: Crypto.randomUUID(), name }; break;
      case 'create_shelf': if (!room) return; action = { type: form.type, id: Crypto.randomUUID(), roomId: room.id, name, theme, sections: Number(sections), rows: Number(rows), capacity: Number(capacity) }; break;
      case 'create_section': if (!shelf) return; action = { type: form.type, id: Crypto.randomUUID(), shelfId: shelf.id, name }; break;
      case 'create_row': if (!section) return; action = { type: form.type, id: Crypto.randomUUID(), sectionId: section.id, name, capacity: Number(capacity) }; break;
      case 'rename': if (!form.kind || !form.id) return; action = { type: form.type, kind: form.kind, id: form.id, name }; break;
    }
    if (await commit(action)) setForm(undefined);
  };
  const changeMode = async (value: ProgressDisplayMode) => { if (inFlight.current) return; inFlight.current = true; setBusy(true); try { await api.updateSettings(value); setMode(value); } catch (err) { setError(err instanceof Error ? err.message : 'Настройка не сохранена'); } finally { inFlight.current = false; setBusy(false); } };
  const updateProgress = async () => {
    if (!selected || inFlight.current) return; inFlight.current = true; setBusy(true);
    try { const updated = await api.updateProgress(selected.id, Math.min(selected.progress.totalPages, selected.progress.currentPage + 10)); setBooks((current) => current.map((book) => book.id === updated.id ? updated : book)); setNotice('Прогресс сохранён'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Прогресс не сохранён'); } finally { inFlight.current = false; setBusy(false); }
  };
  const status = error || notice;
  const statusLine = <Note numberOfLines={1} accessibilityLiveRegion="polite" accessibilityLabel={status || 'Расположение синхронизируется с сервером'} style={{ minHeight: typography.body.lineHeight }}>{short(status)}</Note>;
  const placeChosen = async () => { if (!row || !chosen.length) return; if (await commit({ type: 'move', copyIds: chosen, rowId: row.id })) { setPicker(false); setChosen([]); } };
  const moveChosen = async () => {
    const existing = layout.placements.filter((p) => p.rowId === destination && !moveIds.includes(p.copyId)).sort((a, b) => a.position - b.position);
    const index = position.trim() ? Number(position) : existing.length + 1;
    if (destination && (!Number.isInteger(index) || index < 1 || index > existing.length + 1)) { setError('Укажите позицию от 1 до ' + (existing.length + 1)); return; }
    if (await commit({ type: 'move', copyIds: moveIds, rowId: destination, beforeCopyId: destination ? existing[index - 1]?.copyId ?? null : null })) { setMoveIds([]); setBookDialog(false); } };
  const descendantRows = deleting ? layout.rows.filter((r) => deleting.kind === 'row' ? r.id === deleting.id : deleting.kind === 'section' ? r.sectionId === deleting.id : deleting.kind === 'shelf' ? layout.sections.some((s) => s.id === r.sectionId && s.shelfId === deleting.id) : layout.sections.some((s) => s.id === r.sectionId && layout.shelves.some((c) => c.id === s.shelfId && c.roomId === deleting.id))).map((r) => r.id) : [];
  const deleteNode = async () => { if (!deleting) return; if (await commit({ type: 'delete', ...deleting, destinationRowId: destination })) { setDeleting(undefined); setManage(false); } };
  return <ScreenContainer><ScreenScroll keyboardShouldPersistTaps="handled"><ScreenContent>
    <AppHeader back title="Мои шкафы" subtitle="У каждой книги — своё место" />
    {loading ? <LoadingState /> : <>
      {statusLine}{pending ? <PillButton label="Повторить подтверждение расположения" disabled={busy} onPress={() => void execute(pending)} /> : <PillButton label="Обновить шкафы" variant="secondary" disabled={busy} onPress={() => { setBusy(true); void loadLatest().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Ошибка загрузки')).finally(() => setBusy(false)); }} />}
      <Row>{layout.rooms.map((value) => <PillButton key={value.id} label={value.name} variant={value.id === room?.id ? 'primary' : 'secondary'} disabled={disabled} onPress={() => setRoomId(value.id)} />)}<PillButton label="+ Комната" variant="secondary" disabled={disabled} onPress={() => openForm({ type: 'create_room' })} /></Row>
      {room ? <Row>{roomShelves.map((value) => <PillButton key={value.id} label={value.name} variant={value.id === shelf?.id ? 'primary' : 'secondary'} disabled={disabled} onPress={() => setShelfId(value.id)} />)}<PillButton label="+ Шкаф" variant="secondary" disabled={disabled} onPress={() => openForm({ type: 'create_shelf' })} /></Row> : <EmptyState title="Создайте первую комнату" message="Затем добавьте шкаф и повторите расположение домашних полок." />}
      {shelf ? <><Row>{shelfSections.map((value) => <PillButton key={value.id} label={value.name} variant={value.id === section?.id ? 'primary' : 'secondary'} disabled={disabled} onPress={() => setSectionId(value.id)} />)}<PillButton label="+ Секция" variant="secondary" disabled={disabled} onPress={() => openForm({ type: 'create_section' })} /></Row>
        <Row>{sectionRows.map((value) => <PillButton key={value.id} label={`${value.name} · ${layout.placements.filter((p) => p.rowId === value.id).length}/${value.capacity}`} variant={value.id === row?.id ? 'primary' : 'secondary'} disabled={disabled} onPress={() => setRowId(value.id)} />)}{section ? <PillButton label="+ Полка" variant="secondary" disabled={disabled} onPress={() => openForm({ type: 'create_row' })} /> : null}</Row></> : null}
      {row && shelf ? <><Note>{rowPath(row.id)}</Note><MotionShelfRow key={row.id} books={rowBooks} mode={mode} selectedId={selectedId} theme={shelf.theme} disabled={disabled} onSelect={(id) => { setSelectedId(id); setBookDialog(true); }} onReorder={(from, to) => { const rest = rowBooks.filter((_, index) => index !== from); const book = rowBooks[from]; if (book) void commit({ type: 'move', rowId: row.id, copyIds: [book.id], beforeCopyId: rest[to]?.id ?? null }); }} />
        {!rowBooks.length ? <Note>Полка пока пуста. Добавьте книги из библиотеки.</Note> : <Note>Удерживайте корешок и перетащите. Перенос между полками доступен в карточке книги.</Note>}
        <SegmentedControl value={mode} options={[{ value: 'percentage', label: '%' }, { value: 'pages', label: 'Страницы' }]} onChange={(value) => void changeMode(value)} />
        <Row><PillButton label="Разместить книги" disabled={disabled} onPress={() => { setPicker(true); setChosen([]); setQuery(''); }} /><PillButton label="По названию" variant="secondary" disabled={disabled || rowBooks.length < 2} onPress={() => void commit({ type: 'sort', rowId: row.id, by: 'title' })} /><PillButton label="По автору" variant="secondary" disabled={disabled || rowBooks.length < 2} onPress={() => void commit({ type: 'sort', rowId: row.id, by: 'author' })} /></Row>
      </> : null}
      {receipt?.canUndo && receipt.revision === layout.revision ? <PillButton label="Отменить последнее перемещение" variant="secondary" disabled={disabled} onPress={() => void commit({ type: 'undo', operationId: receipt.operationId })} /> : null}
      {room ? <PillButton label="Настроить место хранения" variant="secondary" disabled={disabled} onPress={() => setManage(true)} /> : null}
      <Field accessibilityLabel="Найти книгу и физическое место" placeholder="Название, автор, ISBN или место" value={query} onChangeText={setQuery} />
      {query.trim() ? <><Note>{matches.length} совпадений. Откройте поиск для просмотра всех.</Note><PillButton label="Показать найденные книги" variant="secondary" disabled={disabled} onPress={() => { setAllBooks(true); setPicker(true); setChosen([]); }} /></> : null}
    </>}
  </ScreenContent></ScreenScroll>
  <MotionDialog visible={!!form || manage || !!deleting || picker || (bookDialog && !!selected) || !!moveIds.length} title={form ? form.type === 'rename' ? 'Переименовать' : 'Новое место хранения' : manage ? 'Место хранения' : deleting ? 'Удаление места хранения' : picker ? 'Книги в библиотеке' : moveIds.length ? `Переместить книги · ${moveIds.length}` : selected?.work.title ?? 'Книга'} busy={busy} scroll={!picker} onClose={() => { setForm(undefined); setManage(false); setDeleting(undefined); setPicker(false); setBookDialog(false); setMoveIds([]); }}>
{!!form ? <>
    <Field accessibilityLabel="Название места хранения" placeholder="Название" maxLength={100} value={name} onChangeText={setName} editable={!disabled} />
    {form?.type === 'create_shelf' ? <><Note>Секций: от 1 до 8</Note><Field accessibilityLabel="Количество секций" keyboardType="number-pad" value={sections} onChangeText={setSections} /><Note>Полок в каждой секции: от 1 до 12</Note><Field accessibilityLabel="Количество полок в каждой секции" keyboardType="number-pad" value={rows} onChangeText={setRows} /><Row>{themes.map((value) => <PillButton key={value.value} label={value.label} variant={theme === value.value ? 'primary' : 'secondary'} onPress={() => setTheme(value.value)} />)}</Row></> : null}
    {form?.type === 'create_shelf' || form?.type === 'create_row' ? <><Note>Вместимость полки: от 1 до 200 книг</Note><Field accessibilityLabel="Вместимость полки в книгах" keyboardType="number-pad" value={capacity} onChangeText={setCapacity} /></> : null}
    {statusLine}<PillButton label={busy ? 'Сохраняем…' : 'Сохранить'} disabled={disabled || !name.trim()} onPress={() => void submitForm()} />
</> : null}
{manage ? <>
    {([{ kind: 'room', value: room }, { kind: 'shelf', value: shelf }, { kind: 'section', value: section }, { kind: 'row', value: row }] as const).map(({ kind, value }) => value ? <View key={kind}><Note>{value.name}</Note><Row><PillButton label="Переименовать" variant="secondary" disabled={disabled} onPress={() => openForm({ type: 'rename', kind, id: value.id }, value.name)} /><PillButton label="Удалить" variant="secondary" disabled={disabled} onPress={() => { setManage(false); setDeleting({ kind, id: value.id }); setDestination(null); }} /></Row></View> : null)}
</> : null}
{!!deleting ? <>
    <Note>Экземпляры сохранятся в библиотеке. Выберите другое место или явно снимите книги с полок. Отменить удаление контейнера нельзя.</Note>
    <PillButton label="Снять книги с полок" variant={destination === null ? 'primary' : 'secondary'} disabled={disabled} onPress={() => setDestination(null)} />
    {layout.rows.filter((r) => !descendantRows.includes(r.id)).map((r) => <PillButton key={r.id} label={rowPath(r.id)} variant={destination === r.id ? 'primary' : 'secondary'} disabled={disabled} onPress={() => { setDestination(r.id); setPosition(''); }} />)}
    {statusLine}<PillButton label="Подтвердить удаление и сохранить книги" disabled={disabled} onPress={() => void deleteNode()} />
</> : null}
{picker ? <>
    <Field accessibilityLabel="Поиск книг для размещения" placeholder="Название, автор, ISBN или место" value={query} onChangeText={setQuery} /><PillButton label={allBooks ? 'Показать только книги вне полок' : 'Показать все книги'} variant="secondary" disabled={disabled} onPress={() => setAllBooks(!allBooks)} />
    <FlatList style={{ height: Math.min(shelfVisuals.pickerMaxHeight, height * shelfVisuals.pickerScreenFraction) }} data={matches.filter((book) => allBooks || !layout.placements.some((p) => p.copyId === book.id))} keyExtractor={(book) => book.id} initialNumToRender={12} renderItem={({ item }) => <Choice accessibilityRole="checkbox" accessibilityState={{ checked: chosen.includes(item.id) }} disabled={disabled} onPress={() => setChosen((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : ids.length < 50 ? [...ids, item.id] : ids)}><Note>{chosen.includes(item.id) ? '✓ ' : ''}{item.work.title}</Note><Note>{copyLocation(item.id)}</Note><PillButton label="Показать место" variant="secondary" disabled={disabled} onPress={() => { setSelectedId(item.id); const place = layout.placements.find((p) => p.copyId === item.id); if (place) focusRow(layout, place.rowId); setPicker(false); setBookDialog(true); }} /></Choice>} ListEmptyComponent={<Note>Подходящих книг нет.</Note>} />
    {statusLine}<PillButton label={`Разместить на текущей полке · ${chosen.length}/50`} disabled={disabled || !row || !chosen.length} onPress={() => void placeChosen()} />
</> : null}
{bookDialog && !!selected ? <>
    {selected ? <><BookCover title={selected.work.title} author={selected.work.authors.map((a) => a.name).join('; ')} uri={selected.coverMode === 'automatic' ? selected.edition.coverUri : selected.coverUri} mode={selected.coverMode} assetId={selected.coverAssetId} coverStyle={selected.coverStyle} /><Note>{copyLocation(selected.id)}</Note><Note>{formatReadingProgress(selected.progress, mode)}</Note><Row><PillButton label="+10 страниц" disabled={disabled || selected.progress.totalPages <= 0} onPress={() => void updateProgress()} /><PillButton label="Переместить" variant="secondary" disabled={disabled} onPress={() => { setBookDialog(false); setMoveIds([selected.id]); setPosition(''); setDestination(layout.placements.find((p) => p.copyId === selected.id)?.rowId ?? null); }} /><PillButton label="Открыть карточку" variant="secondary" disabled={disabled} onPress={() => { setBookDialog(false); router.push(`/books/${selected.id}`); }} /></Row></> : null}{statusLine}
</> : null}
{!!moveIds.length ? <>
    <Note>Порядок выбранных книг сохранится. Перед подтверждением проверим вместимость.</Note><PillButton label="Вне полок" variant={destination === null ? 'primary' : 'secondary'} disabled={disabled} onPress={() => setDestination(null)} />
    {layout.rows.map((r) => <PillButton key={r.id} label={`${rowPath(r.id)} · ${layout.placements.filter((p) => p.rowId === r.id).length}/${r.capacity}`} variant={destination === r.id ? 'primary' : 'secondary'} disabled={disabled} onPress={() => { setDestination(r.id); setPosition(''); }} />)}
    {destination ? <><Note>Позиция на полке, начиная с 1. Пустое поле — в конец.</Note><Field accessibilityLabel="Позиция книги на целевой полке" keyboardType="number-pad" value={position} onChangeText={setPosition} editable={!disabled} /></> : null}
    {statusLine}<PillButton label="Подтвердить перемещение" disabled={disabled} onPress={() => void moveChosen()} />
</> : null}
    {pending ? <PillButton label="Повторить подтверждение без нового действия" disabled={busy} onPress={() => void execute(pending)} /> : null}
  </MotionDialog>
  </ScreenContainer>;
}
