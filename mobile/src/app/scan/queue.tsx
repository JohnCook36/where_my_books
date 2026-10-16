import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ScanDraft } from '@where-my-books/shared';
import { AppHeader, PillButton, ScreenContainer, ScreenContent, ScreenScroll } from '@/components';
import { api } from '../../api/client';
import { Choice, Note, Row } from '../../features/catalog/styles';
export default function ScanQueue() {
  const router = useRouter(); const [drafts, setDrafts] = useState<ScanDraft[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => { setBusy(true); setError(''); try { setDrafts((await api.scanDrafts()).drafts); } catch { setError('Не удалось загрузить очередь. Повторите после восстановления сети.'); } finally { setBusy(false); } }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const remove = async (id: string) => { setBusy(true); try { await api.removeScanDraft(id); await reload(); } catch { setError('Не удалось удалить черновик. Повторите.'); } finally { setBusy(false); } };
  return <ScreenContainer><ScreenScroll><ScreenContent><PillButton label="Назад к добавлению" variant="secondary" onPress={() => router.replace('/(tabs)/add')} /><AppHeader title="Очередь сканирования" subtitle="Проверьте издание и обложку каждой книги перед сохранением" />{busy ? <Note>Обновляем очередь…</Note> : null}{error ? <Note accessibilityRole="alert">{error}</Note> : null}{!busy && !error && !drafts.length ? <Note>Очередь пуста. Уже сохранённые экземпляры доступны в библиотеке.</Note> : null}{drafts.map((draft) => <Choice key={draft.id}><Note>ISBN {draft.isbn}</Note><Row><PillButton label="Проверить и сохранить" disabled={busy} onPress={() => router.push({ pathname: '/scan/review', params: { isbn: draft.isbn, draftId: draft.id } })} /><PillButton label="Убрать из очереди" variant="secondary" disabled={busy} onPress={() => void remove(draft.id)} /></Row></Choice>)}<PillButton label="Продолжить сканирование" onPress={() => router.push('/scan?bulk=1')} /><PillButton label="Обновить очередь" disabled={busy} variant="secondary" onPress={() => void reload()} /></ScreenContent></ScreenScroll></ScreenContainer>;
}
