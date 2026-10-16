import { describe, expect, it } from 'vitest';
import { isbn13, normalizeIsbn } from './isbn.js';

describe('ISBN validation', () => {
  it.each(['9780306406157', '9791090636071', '0306406152', '0-8044-2957-X'])('accepts %s', (isbn) => expect(normalizeIsbn(isbn)).not.toBeNull());
  it.each(['9780306406158', '4006381333931', '123', 'ISBN 9780306406157', '978030640615X', '030640615X', '9780306406157!'])('rejects %s', (isbn) => expect(normalizeIsbn(isbn)).toBeNull());
  it('matches equivalent editions using ISBN13', () => expect(isbn13('0-306-40615-2')).toBe('9780306406157'));
  it('does not convert 979 to an invented ISBN10', () => expect(isbn13('9791090636071')).toBe('9791090636071'));
});
