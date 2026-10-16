// Runs against a disposable PostgreSQL database. Never uses external catalog availability as a test gate.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL || process.env.WMB_INTEGRATION_TEST !== '1') throw new Error('Set DATABASE_URL to a disposable DB and WMB_INTEGRATION_TEST=1');
const prisma = new PrismaClient(); const port = '3197'; const base = `http://127.0.0.1:${port}/api`;
let child; let output = ''; const users = [];
const start = async () => {
  child = spawn(process.execPath, ['dist/main.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: port, JWT_ACCESS_SECRET: 'integration-only-secret-never-use-in-production' }, stdio: ['ignore', 'pipe', 'pipe'] });
  output = ''; child.stdout.on('data', (chunk) => { output = (output + chunk).slice(-5000); }); child.stderr.on('data', (chunk) => { output = (output + chunk).slice(-5000); });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`API exited: ${output}`);
    try { const response = await fetch(`${base}/health`); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API did not start: ${output}`);
};
const stop = async () => { if (child && child.exitCode === null) { const done = new Promise((resolve) => child.once('exit', resolve)); child.kill('SIGTERM'); await done; } };
async function call(path, { token, method = 'GET', body, status = 200 } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text(); assert.equal(response.status, status, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : undefined;
}
try {
  await start();
  const a = await call('/auth/register', { method: 'POST', status: 201, body: { email: `a-${randomUUID()}@example.test`, password: 'Test-only-passphrase-9274' } }); users.push(a.user.id);
  const b = await call('/auth/register', { method: 'POST', status: 201, body: { email: `b-${randomUUID()}@example.test`, password: 'Test-only-passphrase-9274' } }); users.push(b.user.id);
  await call('/books', { status: 401 });
  const payload = { title: 'Real database book', author: 'Author A', authors: ['Author A', 'Author B'], totalPages: 120, isbn: '0-306-40615-2', publisher: 'Test publisher', publicationYear: 1980, catalogSource: 'open_library', externalId: '/books/TEST', coverUri: 'https://covers.openlibrary.org/b/id/1-L.jpg', clientRequestId: randomUUID() };
  const [one, replay] = await Promise.all([call('/books', { token: a.accessToken, method: 'POST', status: 201, body: payload }), call('/books', { token: a.accessToken, method: 'POST', status: 201, body: payload })]);
  assert.equal(one.id, replay.id);
  await call('/books', { token: a.accessToken, method: 'POST', status: 409, body: { ...payload, title: 'Changed retry payload' } });
  await call(`/books/${one.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { title: null } }); assert.equal(one.edition.isbn, '9780306406157'); assert.equal(one.work.authors.length, 2); assert.equal(one.coverUri, payload.coverUri);
  assert.equal((await call('/books', { token: a.accessToken })).books.length, 1);
  const second = await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: { ...payload, clientRequestId: randomUUID(), editionId: one.editionId } });
  assert.notEqual(one.id, second.id); assert.equal(one.editionId, second.editionId);
  await call(`/books/${one.id}`, { token: a.accessToken, method: 'PATCH', body: { title: 'Personal correction', totalPages: 130 } });
  assert.equal((await call(`/books/${second.id}`, { token: a.accessToken })).work.title, payload.title);
  await call(`/books/${one.id}/progress`, { token: a.accessToken, method: 'PATCH', body: { currentPage: 20 } });
  await call(`/books/${one.id}/progress`, { token: a.accessToken, method: 'PATCH', status: 400, body: { currentPage: 999 } });
  assert.equal((await call('/books', { token: b.accessToken })).books.length, 0);
  for (const [method, body] of [['GET', undefined], ['PATCH', { title: 'Not yours' }], ['DELETE', undefined]]) await call(`/books/${one.id}`, { token: b.accessToken, method, body, status: 403 });
  await call('/books', { token: b.accessToken, method: 'POST', status: 404, body: { ...payload, editionId: one.editionId } });
  await call('/books', { token: a.accessToken, method: 'POST', status: 400, body: { ...payload, clientRequestId: randomUUID(), coverUri: 'https://127.0.0.1/private' } });
  await call('/books', { token: a.accessToken, method: 'POST', status: 400, body: { ...payload, clientRequestId: randomUUID(), isbn: '4006381333931' } });
  const unknown = await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: { title: 'Unknown edition', author: 'Manually entered', totalPages: 0, clientRequestId: randomUUID() } });
  assert.equal(unknown.progress.totalPages, 0);
  const [draft, repeatedDraft] = await Promise.all([call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: payload.isbn } }), call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: one.edition.isbn } })]);
  assert.equal(draft.id, repeatedDraft.id);
  assert.equal((await call('/scan-drafts', { token: b.accessToken })).drafts.length, 0);
  await call(`/scan-drafts/${draft.id}`, { token: b.accessToken, method: 'DELETE' });
  assert.equal((await call('/scan-drafts', { token: a.accessToken })).drafts.length, 1);
  await call('/catalog?isbn=4006381333931', { token: a.accessToken, status: 400 });
  await stop(); await start();
  assert.equal((await call(`/books/${one.id}`, { token: a.accessToken })).progress.currentPage, 20);
  assert.equal((await call(`/books/${one.id}`, { token: a.accessToken })).coverUri, payload.coverUri);
  assert.equal((await call('/scan-drafts', { token: a.accessToken })).drafts[0].id, draft.id);
  const confirmed = await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: { ...payload, clientRequestId: draft.id } });
  const confirmedAgain = await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: { ...payload, clientRequestId: draft.id } });
  assert.equal(confirmed.id, confirmedAgain.id);
  assert.equal((await call('/scan-drafts', { token: a.accessToken })).drafts.length, 0);
  await call(`/scan-drafts/${draft.id}`, { token: a.accessToken, method: 'DELETE' });
  assert.equal((await call('/scan-drafts', { token: a.accessToken })).drafts.length, 0);
  console.log('PASS: PostgreSQL/HTTP auth, ownership, CRUD, ISBN/cover persistence, concurrent replay, independent copies, progress bounds, durable queue and API restart');
} finally {
  await stop();
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
}
