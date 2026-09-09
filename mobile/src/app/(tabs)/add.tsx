import styled from '@emotion/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { colors, spacing } from '@where-my-books/ui';
import { AppHeader, PillButton, ScreenContainer, ScreenContent } from '@where-my-books/ui/native';
import { api } from '../../api/client';
const Field = styled(TextInput)({ backgroundColor: colors.paper, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, padding: spacing.md, marginTop: spacing.md });
const Note = styled.Text({ color: colors.inkSecondary, marginTop: spacing.md });
export default function AddScreen() { const router = useRouter(); const [title, setTitle] = useState(''); const [author, setAuthor] = useState(''); const [pages, setPages] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const submit = async () => { setBusy(true); setError(''); try { const book = await api.addBook({ title, author, totalPages: Number(pages) }); router.replace(`/books/${book.id}`); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось добавить книгу'); } finally { setBusy(false); } }; return <ScreenContainer><ScreenContent><AppHeader title="Добавить книгу" subtitle="Ручной ввод" /><Field placeholder="Название" placeholderTextColor={colors.inkMuted} value={title} onChangeText={setTitle} /><Field placeholder="Автор" placeholderTextColor={colors.inkMuted} value={author} onChangeText={setAuthor} /><Field keyboardType="number-pad" placeholder="Количество страниц" placeholderTextColor={colors.inkMuted} value={pages} onChangeText={setPages} /><Note>{error}</Note><PillButton label={busy ? 'Сохраняем…' : 'Добавить книгу'} disabled={busy || !title || !author || Number(pages) < 1} onPress={submit} /></ScreenContent></ScreenContainer>; }
