import styled from '@emotion/native';
import { useCallback, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { JournalEntryKind, JournalEntryResponse } from '@where-my-books/shared';
import { EmptyState, ErrorState, LoadingState, PillButton, SurfaceCard } from '@/components';
import { colors, radii, spacing, typography } from '@/theme';
import { api } from '../../api/client';

const Container = styled.View({ gap: spacing.md, marginTop: spacing.lg });
const Row = styled.View({ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' });
const Field = styled(TextInput)({ color: colors.ink, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, ...typography.body });
const Heading = styled.Text({ color: colors.ink, ...typography.heading });
const Caption = styled.Text({ color: colors.inkSecondary, ...typography.caption });
const EntryText = styled.Text({ color: colors.ink, ...typography.body, marginTop: spacing.xs });

export function BookJournal({ bookId, totalPages }: { bookId: string; totalPages: number }) {
  const [entries, setEntries] = useState<JournalEntryResponse[]>([]);
  const [kind, setKind] = useState<JournalEntryKind>('note');
  const [body, setBody] = useState('');
  const [page, setPage] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void api.journalEntries(bookId).then(({ entries: found }) => {
      if (active) { setEntries(found); setError(undefined); }
    }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : 'Не удалось загрузить записи');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookId, reload]));

  const reset = () => { setBody(''); setPage(''); setKind('note'); setEditingId(undefined); };
  const save = async () => {
    const trimmed = body.trim();
    if (!trimmed) { setError('Введите текст заметки или цитаты'); return; }
    const pageNumber = page.trim() ? Number(page) : null;
    if (pageNumber !== null && (!Number.isInteger(pageNumber) || pageNumber < 1 || (totalPages > 0 && pageNumber > totalPages))) {
      setError('Укажите корректный номер страницы'); return;
    }
    setBusy(true); setError(undefined);
    try {
      if (editingId) await api.updateJournalEntry(bookId, editingId, { body: trimmed, page: pageNumber });
      else await api.addJournalEntry(bookId, { kind, body: trimmed, page: pageNumber });
      reset();
      setReload((value) => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить запись'); }
    finally { setBusy(false); }
  };
  const edit = (entry: JournalEntryResponse) => {
    setEditingId(entry.id);
    setKind(entry.kind);
    setBody(entry.body);
    setPage(entry.page == null ? '' : String(entry.page));
    setError(undefined);
  };
  const remove = async (id: string) => {
    setBusy(true); setError(undefined);
    try {
      await api.deleteJournalEntry(bookId, id);
      if (editingId === id) reset();
      setReload((value) => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось удалить запись'); }
    finally { setBusy(false); }
  };
  return <Container>
    <Heading>Читательский дневник</Heading>
    <Caption>Приватные заметки и цитаты. Они доступны только вашему аккаунту.</Caption>
    <Row>
      <PillButton label="Заметка" variant={kind === 'note' ? 'primary' : 'secondary'} disabled={busy || !!editingId} onPress={() => setKind('note')} />
      <PillButton label="Цитата" variant={kind === 'quote' ? 'primary' : 'secondary'} disabled={busy || !!editingId} onPress={() => setKind('quote')} />
    </Row>
    <Field value={body} onChangeText={setBody} maxLength={5000} multiline textAlignVertical="top" placeholder={kind === 'note' ? 'Ваши впечатления…' : 'Текст цитаты…'} placeholderTextColor={colors.inkMuted} accessibilityLabel="Текст дневника" style={{ minHeight: 108 }} />
    <Field value={page} onChangeText={setPage} keyboardType="number-pad" placeholder="Страница (необязательно)" placeholderTextColor={colors.inkMuted} accessibilityLabel="Номер страницы" />
    <Row>
      <PillButton label={editingId ? 'Сохранить изменения' : 'Добавить запись'} disabled={busy || !body.trim()} onPress={() => void save()} />
      {editingId ? <PillButton label="Отменить редактирование" variant="secondary" disabled={busy} onPress={reset} /> : null}
    </Row>
    {error ? <ErrorState message={error} /> : null}
    {loading ? <LoadingState /> : entries.length === 0 ? <EmptyState title="Записей пока нет" message="Добавьте первую заметку или цитату из книги." /> : entries.map((entry) => <SurfaceCard key={entry.id}>
      <Caption>{entry.kind === 'quote' ? 'Цитата' : 'Заметка'}{entry.page == null ? '' : ` · Страница ${entry.page}`}</Caption>
      <EntryText>{entry.body}</EntryText>
      <Row>
        <PillButton label="Изменить" variant="secondary" disabled={busy} onPress={() => edit(entry)} />
        <PillButton label="Удалить" variant="secondary" disabled={busy} onPress={() => Alert.alert('Удалить запись?', 'Восстановить удалённую запись будет нельзя.', [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Удалить', style: 'destructive', onPress: () => void remove(entry.id) },
        ])} />
      </Row>
    </SurfaceCard>)}
  </Container>;
}
