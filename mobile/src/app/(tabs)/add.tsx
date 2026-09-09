import { AppHeader, EmptyState, ScreenContainer, ScreenContent } from '@where-my-books/ui/native';
export default function AddScreen() { return <ScreenContainer><ScreenContent><AppHeader title="Добавить книгу" /><EmptyState title="Выбери способ добавления" message="Поиск, сканирование ISBN и ручной ввод появятся на следующем этапе." /></ScreenContent></ScreenContainer>; }
