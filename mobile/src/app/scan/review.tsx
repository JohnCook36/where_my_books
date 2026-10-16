import { useLocalSearchParams } from 'expo-router';
import { AddBookScreen } from '../../features/catalog/AddBookScreen';
export default function ScanReview() {
  const { isbn, draftId } = useLocalSearchParams<{ isbn: string; draftId: string }>();
  return <AddBookScreen initialIsbn={isbn ?? ''} draftId={draftId} />;
}
