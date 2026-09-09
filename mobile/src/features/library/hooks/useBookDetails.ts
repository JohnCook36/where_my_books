import { useEffect, useState } from 'react';
import { getBookById } from '../../../db';
import { useDatabase } from '../../../db/DatabaseProvider';
import type { LibraryBook } from '@where-my-books/shared';

export const useBookDetails = (id: string) => {
  const { isReady } = useDatabase();
  const [book, setBook] = useState<LibraryBook | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => { if (!isReady) return; const timer = setTimeout(() => { try { setBook(getBookById(id)); } catch (nextError) { setError(nextError instanceof Error ? nextError : new Error('Не удалось загрузить книгу')); } }, 0); return () => clearTimeout(timer); }, [id, isReady]);
  return { book, error, isLoading: !isReady };
};
