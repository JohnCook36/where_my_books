import { AppHeader, EmptyState, ScreenContainer, ScreenContent } from '@where-my-books/ui/native';
export default function StatsScreen() { return <ScreenContainer><ScreenContent><AppHeader title="Статистика" /><EmptyState title="Статистика появится позже" message="Сначала соберём твою библиотеку и историю чтения." /></ScreenContent></ScreenContainer>; }
