import styled from '@emotion/native';
import type { LibraryBookResponse } from '@where-my-books/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { AppHeader, EmptyState, ErrorState, LoadingState, ScreenContainer, ScreenContent, ScreenScroll, SurfaceCard } from '@/components';
import { colors, spacing, typography } from '@/theme';
import { api } from '../../api/client';
import { useAuth } from '../../features/auth/AuthProvider';
const Title = styled.Text({ color: colors.ink, ...typography.heading });
const Meta = styled.Text({ color: colors.inkSecondary, ...typography.caption, marginTop: spacing.xs });
const List = styled.View({ gap: spacing.sm, marginTop: spacing.lg });
export default function LibraryScreen() { const auth = useAuth(); const router = useRouter(); const [books, setBooks] = useState<LibraryBookResponse[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const load = useCallback(() => { if (!auth.user) return; setLoading(true); setError(null); void api.books().then((value) => setBooks(value.books)).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Ошибка загрузки')).finally(() => setLoading(false)); }, [auth.user]); useFocusEffect(useCallback(() => { load(); }, [load])); if (auth.loading) return <ScreenContainer><LoadingState /></ScreenContainer>; if (!auth.user) return null; return <ScreenContainer><ScreenScroll><ScreenContent><AppHeader title="Библиотека" subtitle={`${books.length} книг`} />{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : books.length === 0 ? <EmptyState title="Библиотека пока пуста" message="Добавь первую книгу вручную." /> : <List>{books.map((book) => <Pressable key={book.id} onPress={() => router.push(`/books/${book.id}`)}><SurfaceCard><Title>{book.work.title}</Title><Meta>{book.work.authors.map((author) => author.name).join(', ')} · {book.progress.currentPage} / {book.progress.totalPages} стр.</Meta></SurfaceCard></Pressable>)}</List>}</ScreenContent></ScreenScroll></ScreenContainer>; }
