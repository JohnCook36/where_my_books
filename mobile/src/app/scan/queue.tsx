import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ConfirmScanDraftItem, ScanConfirmationResult, ScanDraft } from '@where-my-books/shared';
import { AppHeader, PillButton, ScreenContainer, ScreenContent, ScreenScroll } from '@/components';
import { api } from '../../api/client';
import { BookCover } from '../../features/catalog/BookCover';
import { Choice, Note, Row } from '../../features/catalog/styles';

export default function ScanQueue() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ScanDraft[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ScanConfirmationResult[]>([]);
  const [pendingBatch, setPendingBatch] = useState<ConfirmScanDraftItem[] | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const fetchDrafts = useCallback(async () => { setDrafts((await api.scanDrafts()).drafts); }, []);
  const reload = useCallback(async () => {
    setBusy(true); setError('');
    try { await fetchDrafts(); } catch { setError('Не удалось загрузить очередь. Повторите после восстановления сети.'); }
    finally { setBusy(false); }
  }, [fetchDrafts]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const ready = drafts.filter((draft) => draft.reviewed);
  const remove = async (id: string) => {
    setBusy(true); setError('');
    try { await api.removeScanDraft(id); await fetchDrafts(); }
    catch { setError('Не удалось удалить черновик. Повторите.'); } finally { setBusy(false); }
  };
  const confirm = async () => {
    if (busy) return;
    const items = pendingBatch ?? ready.map(({ id, revision }) => ({ id, revision }));
    if (!items.length) return;
    setBusy(true); setError(''); setPendingBatch(items);
    setTitles((previous) => ({ ...previous, ...Object.fromEntries(drafts.map((draft) => [draft.id, draft.payload?.title || `ISBN ${draft.isbn}`])) }));
    try {
      const response = await api.confirmScanDrafts(items);
      setResults(response.results); setPendingBatch(null);
      try { await fetchDrafts(); } catch { setError('Результат сохранён. Не удалось обновить очередь — нажмите «Обновить».'); }
    } catch { setError('Ответ о партии не получен. Повторите проверку результата: уже сохранённые книги не добавятся второй раз.'); }
    finally { setBusy(false); }
  };
  return <ScreenContainer><ScreenScroll><ScreenContent>
    <PillButton label="Назад к добавлению" variant="secondary" disabled={busy} onPress={() => router.replace('/(tabs)/add')} />
    <AppHeader title="Очередь сканирования" subtitle={`Всего ${drafts.length} · Подтверждено для партии ${ready.length}`} />
    <Note>Откройте книгу, проверьте данные и нажмите «Подтвердить для партии». Только подтверждённые записи будут добавлены в библиотеку.</Note>
    <PillButton label={busy ? 'Обрабатываем…' : pendingBatch ? 'Повторить проверку результата партии' : `Сохранить все подтверждённые (${ready.length})`} disabled={busy || (!pendingBatch && !ready.length)} onPress={() => void confirm()} />
    {error ? <Note accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Note> : null}
    {results.length ? <><Note accessibilityLiveRegion="polite">Сохранено: {results.filter((result) => result.status === 'saved').length}. Требует внимания: {results.filter((result) => result.status !== 'saved').length}.</Note>{results.map((result) => <Choice key={result.id}><Note>{titles[result.id] ?? 'Книга'} · {result.status === 'saved' ? 'В библиотеке' : result.message}</Note>{result.status === 'saved' ? <PillButton label="Открыть сохранённый экземпляр" disabled={busy} variant="secondary" onPress={() => router.push(`/books/${result.copyId}`)} /> : null}</Choice>)}</> : null}
    {!busy && !error && !drafts.length ? <Note>Очередь пуста. Сохранённые экземпляры доступны в библиотеке.</Note> : null}
    {drafts.map((draft) => <Choice key={draft.id}>
      {draft.payload ? <BookCover mode={draft.payload.coverMode} assetId={draft.payload.coverAssetId ?? undefined} uri={draft.payload.coverMode === 'automatic' ? draft.payload.automaticCoverUri ?? undefined : draft.payload.coverUri ?? undefined} title={draft.payload.title ?? `ISBN ${draft.isbn}`} author={draft.payload.author} /> : null}
      <Note>{draft.payload?.title || `ISBN ${draft.isbn}`} · {draft.reviewed ? 'Подтверждено для партии' : 'Нужна проверка'}</Note>
      <Row><PillButton label="Проверить / редактировать" disabled={busy || !!pendingBatch} onPress={() => router.push({ pathname: '/scan/review', params: { draftId: draft.id } })} /><PillButton label="Убрать из очереди" variant="secondary" disabled={busy || !!pendingBatch} onPress={() => void remove(draft.id)} /></Row>
    </Choice>)}
    <PillButton label="Продолжить сканирование" disabled={busy || !!pendingBatch} onPress={() => router.push('/scan?bulk=1')} />
    <PillButton label="Обновить очередь" disabled={busy} variant="secondary" onPress={() => void reload()} />
  </ScreenContent></ScreenScroll></ScreenContainer>;
}
