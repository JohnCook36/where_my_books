import { AppHeader, EmptyState, ScreenContainer, ScreenContent } from '@where-my-books/ui/native';
import { useLocalSearchParams } from 'expo-router';
export default function BookDetailsScreen() { const { id } = useLocalSearchParams<{ id: string }>(); return <ScreenContainer><ScreenContent><AppHeader back title="Книга" subtitle={`ID: ${id ?? 'неизвестно'}`} /><EmptyState title="Детали книги" message="Данные будут загружаться из локального хранилища на Этапе 2." /></ScreenContent></ScreenContainer>; }
