import styled from '@emotion/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { AppHeader, PillButton, ScreenContainer, ScreenContent } from '@/components';
import { colors, spacing } from '@/theme';
import { api } from '../../api/client';

const Field = styled(TextInput)({ backgroundColor: colors.paper, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, padding: spacing.md, marginTop: spacing.md });
const Note = styled.Text({ color: colors.inkSecondary, marginTop: spacing.md });

export default function AddScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pages, setPages] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const normalizedTitle = title.trim();
    const normalizedAuthor = author.trim();
    const normalizedPages = pages.trim();
    const totalPages = Number(normalizedPages);

    setError('');
    if (!normalizedTitle) {
      setError('Введите название книги.');
      return;
    }
    if (!normalizedAuthor) {
      setError('Введите автора книги.');
      return;
    }
    if (!/^\d+$/.test(normalizedPages) || !Number.isSafeInteger(totalPages) || totalPages < 1) {
      setError('Количество страниц должно быть положительным целым числом.');
      return;
    }

    setBusy(true);
    try {
      const book = await api.addBook({ title: normalizedTitle, author: normalizedAuthor, totalPages });
      router.replace(`/books/${book.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить книгу. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return <ScreenContainer><ScreenContent><AppHeader title="Добавить книгу" subtitle="Ручной ввод" /><Field placeholder="Название" placeholderTextColor={colors.inkMuted} value={title} onChangeText={setTitle} /><Field placeholder="Автор" placeholderTextColor={colors.inkMuted} value={author} onChangeText={setAuthor} /><Field keyboardType="number-pad" placeholder="Количество страниц" placeholderTextColor={colors.inkMuted} value={pages} onChangeText={setPages} /><Note>{error}</Note><PillButton label={busy ? 'Сохраняем…' : 'Добавить книгу'} disabled={busy} onPress={submit} /></ScreenContent></ScreenContainer>;
}
