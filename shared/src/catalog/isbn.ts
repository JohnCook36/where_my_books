/** Separators only: reject letters/punctuation rather than silently changing a code. */
export function normalizeIsbn(input: string): string | null {
  const value = input.replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(value)) {
    const sum = [...value].reduce((n, digit, i) => n + (digit === 'X' ? 10 : Number(digit)) * (10 - i), 0);
    return sum % 11 === 0 ? value : null;
  }
  if (!/^(978|979)\d{10}$/.test(value)) return null;
  const sum = [...value].reduce((n, digit, i) => n + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0 ? value : null;
}

/** Canonical matching key for ISBN-10 and its equivalent 978 ISBN-13. */
export function isbn13(input: string): string | null {
  const isbn = normalizeIsbn(input);
  if (!isbn || isbn.length === 13) return isbn;
  const prefix = `978${isbn.slice(0, 9)}`;
  const sum = [...prefix].reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0);
  return `${prefix}${(10 - sum % 10) % 10}`;
}
