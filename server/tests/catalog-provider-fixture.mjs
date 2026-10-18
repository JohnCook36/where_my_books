// Child-process HTTP integration harness only. No fixture hook exists in production code.
if (process.env.WMB_INTEGRATION_TEST !== '1') throw new Error('Catalog fixture requires disposable integration test opt-in');
const originalFetch = globalThis.fetch;
const fixtureIsbn = (index) => {
  if (index === 0) return '9780306406157';
  const prefix = `978190000${String(index).padStart(3, '0')}`;
  const sum = [...prefix].reduce((total, digit, position) => total + Number(digit) * (position % 2 ? 3 : 1), 0);
  return `${prefix}${(10 - sum % 10) % 10}`;
};
const googleVolume = (index) => ({ id: `fixture-${index}`, volumeInfo: { title: `WMB catalog fixture ${index}`, authors: ['Fixture author'], industryIdentifiers: [{ type: 'ISBN_13', identifier: fixtureIsbn(index) }], publisher: 'Edition publisher', publishedDate: '2020', pageCount: 120, imageLinks: { thumbnail: `https://books.google.com/books/content?id=fixture-${index}` } } });
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.origin === 'https://www.googleapis.com' && url.pathname === '/books/v1/volumes') {
    const offset = Number(url.searchParams.get('startIndex') ?? 0);
    return new Response(JSON.stringify({ totalItems: 11, items: url.searchParams.get('q')?.startsWith('isbn:') ? [googleVolume(0)] : offset === 0 ? Array.from({ length: 10 }, (_, i) => googleVolume(i)) : [googleVolume(10)] }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (url.origin === 'https://openlibrary.org' && url.pathname === '/search.json') {
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const docs = Array.from({ length: offset === 0 ? 10 : 1 }, (_, i) => ({ key: `/works/OL${offset + i + 1}W`, title: `WMB work fixture ${offset + i}`, author_name: ['Fixture author'], isbn: [fixtureIsbn(offset + i)], cover_i: 999 }));
    return new Response(JSON.stringify({ numFound: 11, docs }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (url.origin === 'https://openlibrary.org' && url.pathname === '/api/books') return new Response('{}');
  return originalFetch(input, init);
};
