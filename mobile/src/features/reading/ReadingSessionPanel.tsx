import styled from '@emotion/native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import type { ReadingHistoryResponse, ReadingSessionResponse } from '@where-my-books/shared';
import { EmptyState, ErrorState, LoadingState, PillButton, SurfaceCard } from '@/components';
import { colors, radii, spacing, typography } from '@/theme';
import { api } from '../../api/client';

const Container = styled.View({ gap: spacing.md, marginTop: spacing.lg });
const Row = styled.View({ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' });
const Header = styled.Text({ color: colors.ink, ...typography.heading });
const Caption = styled.Text({ color: colors.inkSecondary, ...typography.caption });
const Body = styled.Text({ color: colors.ink, ...typography.body });
const Field = styled(TextInput)({ color: colors.ink, backgroundColor: colors.paper, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, ...typography.body });
const timeText = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':');
};
const errorText = (err: unknown) => err instanceof Error ? err.message : 'Не удалось выполнить действие';

export function ReadingSessionPanel({ bookId, currentPage, totalPages, onProgressSaved }: {
  bookId: string;
  currentPage: number;
  totalPages: number;
  onProgressSaved: () => void;
}) {
  const [history, setHistory] = useState<ReadingHistoryResponse>({ sessions: [], events: [] });
  const [endPage, setEndPage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void api.readingHistory(bookId).then(value => {
      if (!active) return;
      setHistory(value);
      setError(undefined);
      setNow(Date.now());
    }).catch(err => { if (active) setError(errorText(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookId, refresh]));

  useEffect(() => {
    if (!history.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [history.active]);

  const session: ReadingSessionResponse | undefined = history.active;
  const elapsed = session ? Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000)) : 0;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setRefresh(value => value + 1);
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  };
  const start = () => void run(async () => { await api.startReading(bookId); setEndPage(''); onProgressSaved(); });
  const finish = () => {
    if (!session) return;
    const page = Number(endPage);
    if (!endPage.trim() || !Number.isInteger(page) || page < 0 || page > totalPages) {
      setError('Укажите страницу от 0 до ' + totalPages);
      return;
    }
    void run(async () => { await api.finishReading(bookId, session.id, page); setEndPage(''); onProgressSaved(); });
  };
  const cancel = () => {
    if (!session) return;
    Alert.alert('Отменить сессию?', 'Таймер будет удалён. Прогресс книги сохранится без изменений.', [
      { text: 'Назад', style: 'cancel' },
      { text: 'Отменить сессию', style: 'destructive', onPress: () => void run(async () => { await api.cancelReading(bookId, session.id); setEndPage(''); }) },
    ]);
  };
  return <Container>
    <Header>Сессии чтения</Header>
    <Caption>Таймер хранится на сервере и восстанавливается после возвращения в приложение. Он работает, пока сессия не завершена или не отменена.</Caption>
    {loading ? <LoadingState /> : session ? <SurfaceCard>
      <Caption>Чтение начато со страницы {session.startPage}</Caption>
      <Header>{timeText(elapsed)}</Header>
      {elapsed >= 12 * 3600 ? <Caption>Сессия идёт более 12 часов. Проверьте фактическое время перед сохранением.</Caption> : null}
      <Field accessibilityLabel="Страница после чтения" value={endPage} onChangeText={setEndPage} keyboardType="number-pad" placeholder={'Последняя страница (до ' + totalPages + ')'} placeholderTextColor={colors.inkMuted} />
      <Row>
        <PillButton label={busy ? 'Сохраняем…' : 'Завершить чтение'} disabled={busy} onPress={finish} />
        <PillButton label="Отменить" variant="secondary" disabled={busy} onPress={cancel} />
      </Row>
    </SurfaceCard> : <SurfaceCard>
      <Body>Текущая страница: {currentPage} из {totalPages}</Body>
      <PillButton label="Начать чтение" disabled={busy} onPress={start} />
    </SurfaceCard>}
    {error ? <ErrorState message={error} /> : null}
    <Header>История прогресса</Header>
    {history.events.length === 0 ? <EmptyState title="История пока пуста" message="Изменение страницы или завершение чтения создаст первую запись." /> : history.events.map(event => <SurfaceCard key={event.id}>
      <Body>{event.fromPage} → {event.toPage} стр.</Body>
      <Caption>{event.source === 'session' ? 'Сессия чтения' : 'Изменение вручную'} · {new Date(event.createdAt).toLocaleString()}</Caption>
    </SurfaceCard>)}
    <Header>Завершённые сессии</Header>
    {history.sessions.length === 0 ? <Caption>Пока нет завершённых сессий.</Caption> : history.sessions.map(item => <SurfaceCard key={item.id}>
      <Body>{item.startPage} → {item.endPage ?? item.startPage} стр. · {timeText(item.durationSeconds ?? 0)}</Body>
      <Caption>{new Date(item.finishedAt ?? item.startedAt).toLocaleString()}</Caption>
    </SurfaceCard>)}
    {(history.events.length === 50 || history.sessions.length === 50) ? <Caption>Показаны последние 50 записей каждого типа.</Caption> : null}
  </Container>;
}
