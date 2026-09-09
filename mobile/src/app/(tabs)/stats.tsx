import { AppHeader, EmptyState, ScreenContainer, ScreenContent } from '@/components';
export default function StatsScreen() { return <ScreenContainer><ScreenContent><AppHeader title="Статистика" /><EmptyState title="Статистика появится позже" message="Сначала соберём твою библиотеку и историю чтения." /></ScreenContent></ScreenContainer>; }
