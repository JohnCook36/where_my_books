import { useLocalSearchParams } from 'expo-router';
import { AddBookScreen } from '../../features/catalog/AddBookScreen';
export default function AddEdition() {
  const { isbn } = useLocalSearchParams<{ isbn?: string }>();
  return <AddBookScreen key={isbn ?? 'manual'} initialIsbn={typeof isbn === 'string' ? isbn : ''} />;
}
