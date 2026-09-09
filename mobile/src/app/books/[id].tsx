import { AppHeader, EmptyState, ScreenContainer, ScreenContent } from '@where-my-books/ui/native';
import { useLocalSearchParams } from 'expo-router';
import { initialBooks } from '../../features/library/mockBooks';
export default function BookDetailsScreen() { const { id } = useLocalSearchParams<{ id: string }>(); const book = initialBooks.find((item) => item.id === id); return <ScreenContainer><ScreenContent><AppHeader back title={book?.title ?? 'Книга'} {...(book ? { subtitle: book.author } : {})} />{book ? <EmptyState title={book.status} message={`${book.currentPage} / ${book.totalPages} страниц`} /> : <EmptyState title="Книга не найдена" />}</ScreenContent></ScreenContainer>; }
