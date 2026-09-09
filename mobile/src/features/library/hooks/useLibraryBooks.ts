import { useCallback, useEffect, useState } from 'react';
import { getBooks, updateReadingProgress } from '../../../db';
import type { LibraryBookPreview } from '../mockBooks';
import { useDatabase } from '../../../db/DatabaseProvider';

export const useLibraryBooks = () => {
  const { isReady } = useDatabase();
  const [books, setBooks] = useState<LibraryBookPreview[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const reload = useCallback(() => { if (!isReady) return; try { setBooks(getBooks().map((book) => ({ id: book.id, title: book.work.title, author: book.work.authors[0]?.name ?? 'Неизвестный автор', currentPage: book.progress.currentPage, totalPages: book.progress.totalPages, status: book.status, spineColor: book.spineColor, spineWidth: book.spineWidth, spineHeight: book.spineHeight }))); setError(null); } catch (nextError) { setError(nextError instanceof Error ? nextError : new Error('Не удалось загрузить книги')); } }, [isReady]);
  useEffect(() => { const timer = setTimeout(reload, 0); return () => clearTimeout(timer); }, [reload]);
  const addPages = useCallback((bookId: string, pages: number) => { const book = books.find((item) => item.id === bookId); if (!book) return; try { const nextPage = Math.min(book.currentPage + pages, book.totalPages); updateReadingProgress(bookId, nextPage); setBooks((current) => current.map((item) => item.id === bookId ? { ...item, currentPage: nextPage } : item)); } catch (nextError) { setError(nextError instanceof Error ? nextError : new Error('Не удалось сохранить прогресс')); } }, [books]);
  return { books, addPages, reload, error, isLoading: !isReady };
};
