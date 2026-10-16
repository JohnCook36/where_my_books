import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ScanDraft } from '@where-my-books/shared';
import { AppHeader, PillButton, ScreenContainer, ScreenContent } from '@/components';
import { api } from '../../api/client';
import { AddBookScreen } from '../../features/catalog/AddBookScreen';
import { Note } from '../../features/catalog/styles';

export default function ScanReview() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const router = useRouter(); const [draft, setDraft] = useState<ScanDraft>();
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void api.scanDraft(draftId).then((value) => { if (active) { setDraft(value); setError(''); } })
      .catch(() => { if (active) setError('Не удалось загрузить черновик. Возможно, он уже сохранён или удалён.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [draftId, attempt]);
  if (draft && !loading && !error) return <AddBookScreen key={`${draft.id}:${attempt}`} initialIsbn={draft.isbn} initialDraft={draft} onReloadDraft={() => { setLoading(true); setAttempt((value) => value + 1); }} />;
  return <ScreenContainer><ScreenContent><AppHeader title="Проверка книги" /><Note accessibilityRole="alert">{loading ? 'Загружаем сохранённые данные…' : error}</Note><PillButton label="Повторить загрузку" disabled={loading} onPress={() => { setLoading(true); setAttempt((value) => value + 1); }} /><PillButton label="К очереди" variant="secondary" onPress={() => router.replace('/scan/queue')} /><PillButton label="Открыть библиотеку" variant="secondary" onPress={() => router.replace('/(tabs)/library')} /></ScreenContent></ScreenContainer>;
}
