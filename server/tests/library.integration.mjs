// Runs against a disposable PostgreSQL database. Never uses external catalog availability as a test gate.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { testShelves } from './shelves.integration.mjs';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL || process.env.WMB_INTEGRATION_TEST !== '1') throw new Error('Set DATABASE_URL to a disposable DB and WMB_INTEGRATION_TEST=1');
const prisma = new PrismaClient(); const port = '3197'; const base = `http://127.0.0.1:${port}/api`;
let child; let output = ''; const users = [];
const start = async () => {
  child = spawn(process.execPath, ['--import', './tests/catalog-provider-fixture.mjs', 'dist/main.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: port, JWT_ACCESS_SECRET: 'integration-only-secret-never-use-in-production' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
async function uploadCover(token, bytes, { source = 'gallery', mime = 'image/jpeg', status = 201, extraField = false, extraFile = false } = {}) {
  const form = new FormData(); form.append('source', source); form.append('file', new Blob([bytes], { type: mime }), 'private-photo');
  if (extraField) form.append('unexpected', 'value');
  if (extraFile) form.append('file', new Blob([bytes], { type: mime }), 'second-photo');
  const response = await fetch(`${base}/covers`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  const text = await response.text(); assert.equal(response.status, status, `POST /covers: ${text}`);
  return text ? JSON.parse(text) : undefined;
}

try {
  await start();
  const a = await call('/auth/register', { method: 'POST', status: 201, body: { email: `a-${randomUUID()}@example.test`, password: 'Test-only-passphrase-9274' } }); users.push(a.user.id);
  const b = await call('/auth/register', { method: 'POST', status: 201, body: { email: `b-${randomUUID()}@example.test`, password: 'Test-only-passphrase-9274' } }); users.push(b.user.id);
  // Use a dedicated account for refresh/revocation tests: library accounts retain
  // their original active sessions throughout the long persistence suite.
  const c = await call('/auth/register', { method: 'POST', status: 201, body: { email: `c-${randomUUID()}@example.test`, password: 'Test-only-passphrase-9274' } }); users.push(c.user.id);
  const d = await call('/auth/register', { method: 'POST', status: 201, body: { email: `d-${randomUUID()}@example.test`, password: 'Test-only-passphrase-9274' } }); users.push(d.user.id);
  const dSecondDevice = await call('/auth/login', { method: 'POST', status: 201, body: { email: d.user.email, password: 'Test-only-passphrase-9274' } });
  await call('/auth/me', { token: d.accessToken });
  await call('/auth/me', { token: dSecondDevice.accessToken });
  const dSessions = await call('/auth/sessions', { token: d.accessToken });
  assert.equal(dSessions.sessions.length, 2);
  assert.equal(dSessions.sessions.filter((session) => session.isCurrent).length, 1);
  const secondSession = dSessions.sessions.find((session) => !session.isCurrent);
  assert.ok(secondSession);
  await call('/auth/sessions', { status: 401 });
  assert.equal((await call('/auth/sessions', { token: a.accessToken })).sessions.length, 1);
  await call('/auth/sessions/' + secondSession.id, { token: a.accessToken, method: 'DELETE', status: 204 });
  await call('/auth/me', { token: dSecondDevice.accessToken });
  await call('/auth/sessions/' + dSessions.sessions.find((session) => session.isCurrent).id, { token: d.accessToken, method: 'DELETE', status: 409 });
  await call('/auth/sessions/' + secondSession.id, { token: d.accessToken, method: 'DELETE', status: 204 });
  await call('/auth/me', { token: dSecondDevice.accessToken, status: 401 });
  assert.equal((await call('/auth/sessions', { token: d.accessToken })).sessions.length, 1);
  assert.equal((await call('/auth/sessions', { token: a.accessToken })).sessions.length, 1);
  await call('/auth/logout-all', { token: d.accessToken, method: 'POST', status: 204 });
  await call('/auth/me', { token: d.accessToken, status: 401 });
  await call('/auth/me', { token: dSecondDevice.accessToken, status: 401 });
  await call('/auth/refresh', { method: 'POST', body: { refreshToken: dSecondDevice.refreshToken }, status: 401 });
  await call('/auth/refresh', { method: 'POST', body: { refreshToken: d.refreshToken }, status: 401 });
  await call('/auth/me', { token: a.accessToken });
  await call('/auth/me', { token: b.accessToken });
  // Refresh tokens are single-use even when two requests race on PostgreSQL.
  const refreshOnce = () => fetch(base + '/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: c.refreshToken }),
  });
  const [rotatedA, rotatedB] = await Promise.all([refreshOnce(), refreshOnce()]);
  assert.deepEqual([rotatedA.status, rotatedB.status].sort(), [201, 401]);
  const renewed = await (rotatedA.status === 201 ? rotatedA : rotatedB).json();
  assert.equal(typeof renewed.refreshToken, 'string');
  await call('/auth/me', { token: c.accessToken, status: 401 });
  await call('/auth/me', { token: renewed.accessToken });
  await call('/auth/refresh', { method: 'POST', body: { refreshToken: c.refreshToken }, status: 401 });
  await call('/auth/logout', { method: 'POST', body: { refreshToken: renewed.refreshToken }, status: 201 });
  await call('/auth/refresh', { method: 'POST', body: { refreshToken: renewed.refreshToken }, status: 401 });
  await call('/auth/me', { token: renewed.accessToken, status: 401 });

  // Exact browser origin policy: permitted localhost and denied unrelated origins.
  const acceptedOrigin = await fetch(base + '/health', { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(acceptedOrigin.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const deniedOrigin = await fetch(base + '/health', { headers: { Origin: 'https://attacker.invalid' } });
  assert.equal(deniedOrigin.headers.get('access-control-allow-origin'), null);
  const nativeOrigin = await fetch(base + '/health');
  assert.equal(nativeOrigin.status, 200);
  // No email provider configured in CI: recovery never claims to have sent a link.
  await call('/auth/password-reset/request', { method: 'POST', status: 503, body: { email: a.user.email } });
  await call('/auth/password-reset/request', { method: 'POST', status: 400, body: { email: 'invalid' } });
  await call('/auth/password-reset/confirm', { method: 'POST', status: 401, body: { token: 'unrecognized-reset-token-123456789012345678901234', newPassword: 'new-passphrase-123' } });

  // Rate guard returns 429 on public auth routes, but does not affect private books.
  for (let attempt = 0; attempt < 29; attempt++) {
    await call('/auth/login', { method: 'POST', status: 401, body: { email: 'nonexistent@example.test', password: 'wrong-password-123' } });
  }
  await call('/auth/login', { method: 'POST', status: 429, body: { email: 'nonexistent@example.test', password: 'wrong-password-123' } });
    await call('/sync/bootstrap', { status: 401 });
  await call('/sync/changes?after=0', { status: 401 });
  const emptySync = await call('/sync/bootstrap', { token: a.accessToken });
  assert.deepEqual(emptySync.books, []);
  assert.equal(emptySync.cursor, '0');
  await call('/sync/changes?after=abc', { token: a.accessToken, status: 400 });
  await call('/sync/changes?after=999999', { token: a.accessToken, status: 400 });
  await call('/books', { status: 401 });
  const payload = { title: 'Real database book', author: 'Author A', authors: ['Author A', 'Author B'], totalPages: 120, isbn: '0-306-40615-2', publisher: 'Test publisher', publicationYear: 1980, catalogSource: 'open_library', externalId: '/books/TEST', coverUri: 'https://covers.openlibrary.org/b/id/1-L.jpg', clientRequestId: randomUUID() };
  const [one, replay] = await Promise.all([call('/books', { token: a.accessToken, method: 'POST', status: 201, body: payload }), call('/books', { token: a.accessToken, method: 'POST', status: 201, body: payload })]);
  assert.equal(one.id, replay.id);
  const syncA = await call('/sync/changes?after=0', { token: a.accessToken });
  assert.equal(syncA.changes.length, 1);
  assert.equal(syncA.changes[0].action, 'upsert');
  assert.equal(syncA.changes[0].copyId, one.id);
  const syncB = await call('/sync/changes?after=0', { token: b.accessToken });
  assert.deepEqual(syncB.changes, []);
  assert.equal(syncB.serverCursor, '0');
  const bootstrapWithBook = await call('/sync/bootstrap', { token: a.accessToken });
  assert.equal(bootstrapWithBook.books.length, 1);
  assert.equal(bootstrapWithBook.cursor, syncA.cursor);
  const noneAfter = await call('/sync/changes?after=' + syncA.cursor, { token: a.accessToken });
  assert.deepEqual(noneAfter.changes, []);

  await call('/books', { token: a.accessToken, method: 'POST', status: 409, body: { ...payload, title: 'Changed retry payload' } });
  await call(`/books/${one.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { title: null } }); assert.equal(one.edition.isbn, '9780306406157'); assert.equal(one.work.authors.length, 2); assert.equal(one.coverUri, payload.coverUri);
  assert.equal((await call('/books', { token: a.accessToken })).books.length, 1);
  const second = await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: { ...payload, clientRequestId: randomUUID(), editionId: one.editionId } });
  const afterSecond = await call('/sync/changes?after=' + syncA.cursor, { token: a.accessToken });
  assert.equal(afterSecond.changes.length, 1);
  assert.equal(afterSecond.changes[0].copyId, second.id);
  assert.notEqual(one.id, second.id); assert.equal(one.editionId, second.editionId);
  await call(`/books/${one.id}`, { token: a.accessToken, method: 'PATCH', body: { title: 'Personal correction', totalPages: 130 } });
  assert.equal((await call(`/books/${second.id}`, { token: a.accessToken })).work.title, payload.title);
  await call(`/books/${one.id}/progress`, { token: a.accessToken, method: 'PATCH', body: { currentPage: 20 } });
  await call(`/books/${one.id}/progress`, { token: a.accessToken, method: 'PATCH', status: 400, body: { currentPage: 999 } });
  // Real PostgreSQL reading timer and durable progress audit.
  await call('/books/' + one.id + '/reading', { status: 401 });
  assert.equal((await call('/books/' + one.id + '/reading', { token: a.accessToken })).events[0].source, 'manual');
  const [started, startedRetry] = await Promise.all([
    call('/books/' + one.id + '/reading/sessions/start', { token: a.accessToken, method: 'POST', status: 201 }),
    call('/books/' + one.id + '/reading/sessions/start', { token: a.accessToken, method: 'POST', status: 201 }),
  ]);
  assert.equal(started.id, startedRetry.id);
  assert.equal(started.startPage, 20);
  await call('/books/' + second.id + '/reading/sessions/start', { token: a.accessToken, method: 'POST', status: 409 });
  await call('/books/' + one.id + '/reading', { token: b.accessToken, status: 404 });
  await call('/books/' + one.id + '/reading/sessions/start', { token: b.accessToken, method: 'POST', status: 404 });
  await call('/books/' + one.id + '/reading/sessions/' + started.id + '/finish', { token: a.accessToken, method: 'POST', status: 400, body: { endPage: 131 } });
  await call('/books/' + one.id + '/progress', { token: a.accessToken, method: 'PATCH', body: { currentPage: 21 } });
  await call('/books/' + one.id + '/reading/sessions/' + started.id + '/finish', { token: a.accessToken, method: 'POST', status: 409, body: { endPage: 23 } });
  await call('/books/' + one.id + '/progress', { token: a.accessToken, method: 'PATCH', body: { currentPage: 20 } });
  const finished = await call('/books/' + one.id + '/reading/sessions/' + started.id + '/finish', { token: a.accessToken, method: 'POST', status: 201, body: { endPage: 23 } });
  const replayFinish = await call('/books/' + one.id + '/reading/sessions/' + started.id + '/finish', { token: a.accessToken, method: 'POST', status: 201, body: { endPage: 23 } });
  assert.deepEqual(finished, replayFinish);
  assert.equal(finished.currentPage, 23);
  await call('/books/' + one.id + '/reading/sessions/' + started.id + '/finish', { token: a.accessToken, method: 'POST', status: 409, body: { endPage: 24 } });
  await call('/books/' + one.id + '/reading/sessions/' + started.id, { token: a.accessToken, method: 'DELETE', status: 404 });
  const savedHistory = await call('/books/' + one.id + '/reading', { token: a.accessToken });
  assert.equal(savedHistory.active, undefined);
  assert.equal(savedHistory.sessions.length, 1);
  assert.equal(savedHistory.sessions[0].endPage, 23);
  assert.equal(savedHistory.events[0].source, 'session');
  assert.equal(savedHistory.events[0].fromPage, 20);
  assert.equal(savedHistory.events[0].toPage, 23);
  // Real analytics and account-owned goals, never mock client counters.
  await call('/statistics', { status: 401 });
  const statsA = await call('/statistics', { token: a.accessToken });
  assert.equal(statsA.booksTotal, 2);
  assert.equal(statsA.booksReading, 1);
  assert.equal(statsA.booksFinished, 0);
  assert.equal(statsA.completedSessions, 1);
  assert.ok(statsA.totalPagesAdvanced >= 23);
  assert.equal(statsA.daily.length, 7);
  assert.deepEqual(statsA.goals, { finishedBooksTarget: 12, weeklyMinutesTarget: 180 });
  const statsB = await call('/statistics', { token: b.accessToken });
  assert.equal(statsB.booksTotal, 0);
  assert.equal(statsB.completedSessions, 0);
  assert.equal(statsB.totalPagesAdvanced, 0);
  await call('/statistics/goals', { token: b.accessToken, method: 'PATCH', status: 400, body: { finishedBooksTarget: 0, weeklyMinutesTarget: 180 } });
  await call('/statistics/goals', { token: a.accessToken, method: 'PATCH', status: 400, body: { finishedBooksTarget: 13, weeklyMinutesTarget: 10081 } });
  await call('/statistics/goals', { token: a.accessToken, method: 'PATCH', status: 400, body: { finishedBooksTarget: '14', weeklyMinutesTarget: 240 } });
  const goalChange = await call('/statistics/goals', { token: a.accessToken, method: 'PATCH', body: { finishedBooksTarget: 24, weeklyMinutesTarget: 300 } });
  assert.deepEqual(goalChange, { finishedBooksTarget: 24, weeklyMinutesTarget: 300 });
  assert.deepEqual((await call('/statistics', { token: a.accessToken })).goals, goalChange);
  assert.deepEqual((await call('/statistics', { token: b.accessToken })).goals, { finishedBooksTarget: 12, weeklyMinutesTarget: 180 });

  await call('/books/' + one.id + '/progress', { token: a.accessToken, method: 'PATCH', body: { currentPage: 20 } });
  const runningUntilRestart = await call('/books/' + one.id + '/reading/sessions/start', { token: a.accessToken, method: 'POST', status: 201 });
  assert.equal(runningUntilRestart.startPage, 20);

  assert.equal((await call('/books', { token: b.accessToken })).books.length, 0);
  for (const [method, body] of [['GET', undefined], ['PATCH', { title: 'Not yours' }], ['DELETE', undefined]]) await call(`/books/${one.id}`, { token: b.accessToken, method, body, status: 403 });
  await call('/books', { token: b.accessToken, method: 'POST', status: 404, body: { ...payload, editionId: one.editionId } });
  await call('/books', { token: a.accessToken, method: 'POST', status: 400, body: { ...payload, clientRequestId: randomUUID(), coverUri: 'https://127.0.0.1/private' } });
  await call('/books', { token: a.accessToken, method: 'POST', status: 400, body: { ...payload, clientRequestId: randomUUID(), isbn: '4006381333931' } });
  const unknown = await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: { title: 'Unknown edition', author: 'Manually entered', totalPages: 0, clientRequestId: randomUUID() } });
  assert.equal(unknown.progress.totalPages, 0);

  // Real PostgreSQL journal: private note/quote CRUD, page bounds and account isolation.
  await call(`/books/${one.id}/journal`, { status: 401 });
  const note = await call(`/books/${one.id}/journal`, { token: a.accessToken, method: 'POST', status: 201, body: { kind: 'note', body: '  My first impression  ', page: 17 } });
  assert.equal(note.body, 'My first impression'); assert.equal(note.page, 17);
  const quote = await call(`/books/${one.id}/journal`, { token: a.accessToken, method: 'POST', status: 201, body: { kind: 'quote', body: 'A highlighted passage', page: 35 } });
  assert.equal((await call(`/books/${one.id}/journal`, { token: a.accessToken })).entries.length, 2);
  await call(`/books/${one.id}/journal`, { token: b.accessToken, status: 404 });
  await call(`/books/${one.id}/journal`, { token: b.accessToken, method: 'POST', status: 404, body: { kind: 'note', body: 'Foreign' } });
  await call(`/books/${one.id}/journal/${note.id}`, { token: b.accessToken, method: 'PATCH', status: 404, body: { body: 'Foreign update' } });
  await call(`/books/${one.id}/journal/${note.id}`, { token: b.accessToken, method: 'DELETE', status: 404 });
  await call(`/books/${one.id}/journal`, { token: a.accessToken, method: 'POST', status: 400, body: { kind: 'note', body: ' ' } });
  await call(`/books/${one.id}/journal`, { token: a.accessToken, method: 'POST', status: 400, body: { kind: 'quote', body: 'Out of range', page: 131 } });
  await call(`/books/${one.id}/journal/${note.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { page: 131 } });
  const revisedNote = await call(`/books/${one.id}/journal/${note.id}`, { token: a.accessToken, method: 'PATCH', body: { body: 'Revised impression', page: null } });
  assert.equal(revisedNote.body, 'Revised impression'); assert.equal(revisedNote.page, undefined);
  await call(`/books/${one.id}/journal/${quote.id}`, { token: a.accessToken, method: 'DELETE' });
  assert.equal((await call(`/books/${one.id}/journal`, { token: a.accessToken })).entries.length, 1);


  // PostgreSQL search: owner isolation, pagination, sorting and runtime validation.
  await call('/books/search', { status: 401 });
  const byTitle = await call('/books/search?query=PERSONAL', { token: a.accessToken });
  assert.equal(byTitle.total, 1); assert.equal(byTitle.books[0].id, one.id);
  const firstPage = await call('/books/search?query=author%20a&sort=title&order=asc&limit=1&page=1', { token: a.accessToken });
  const secondPage = await call('/books/search?query=author%20a&sort=title&order=asc&limit=1&page=2', { token: a.accessToken });
  assert.equal(firstPage.total, 2); assert.equal(firstPage.books.length, 1); assert.equal(firstPage.hasMore, true);
  assert.equal(secondPage.total, 2); assert.equal(secondPage.hasMore, false);
  assert.notEqual(firstPage.books[0].id, secondPage.books[0].id);
  assert.equal((await call('/books/search?query=9780306406157', { token: a.accessToken })).total, 2);
  assert.equal((await call('/books/search?query=test%20PUBLISHER', { token: a.accessToken })).total, 2);
  const byStatus = await call('/books/search?status=want_to_read&sort=year&order=desc&limit=2', { token: a.accessToken });
  assert.equal(byStatus.total, 2); assert.equal(byStatus.books.length, 2); assert.equal(byStatus.hasMore, false);
  assert.equal((await call('/books/search?status=reading', { token: a.accessToken })).total, 1);
  assert.equal((await call('/books/search?query=nonexistent', { token: a.accessToken })).total, 0);
  assert.equal((await call('/books/search?query=author', { token: b.accessToken })).total, 0);
  for (const query of ['page=0', 'page=abc', 'limit=51', 'limit=-1', 'status=invalid', 'sort=random', 'order=up', 'query=' + 'a'.repeat(201)]) {
    await call('/books/search?' + query, { token: a.accessToken, status: 400 });
  }
  const [draft, repeatedDraft] = await Promise.all([call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: payload.isbn } }), call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: one.edition.isbn } })]);
  assert.equal(draft.id, repeatedDraft.id);
  assert.equal((await call('/scan-drafts', { token: b.accessToken })).drafts.length, 0);
  await call(`/scan-drafts/${draft.id}`, { token: b.accessToken, method: 'DELETE' });
  assert.equal((await call('/scan-drafts', { token: a.accessToken })).drafts.length, 1);
  await call('/catalog?isbn=4006381333931', { token: a.accessToken, status: 400 });
  await stop(); await start();
  assert.equal((await call(`/books/${one.id}`, { token: a.accessToken })).progress.currentPage, 20);
  assert.deepEqual((await call('/statistics', { token: a.accessToken })).goals, { finishedBooksTarget: 24, weeklyMinutesTarget: 300 });
  const restoredHistory = await call('/books/' + one.id + '/reading', { token: a.accessToken });
  assert.equal(restoredHistory.active.id, runningUntilRestart.id);
  assert.equal(restoredHistory.sessions.length, 1);
  await call('/books/' + one.id + '/reading/sessions/' + runningUntilRestart.id, { token: b.accessToken, method: 'DELETE', status: 404 });
  await call('/books/' + one.id + '/reading/sessions/' + runningUntilRestart.id, { token: a.accessToken, method: 'DELETE', status: 204 });
  assert.equal((await call('/books/' + one.id + '/reading', { token: a.accessToken })).active, undefined);

  assert.equal((await call(`/books/${one.id}/journal`, { token: a.accessToken })).entries[0].body, 'Revised impression');
  assert.equal((await call(`/books/${one.id}`, { token: a.accessToken })).coverUri, payload.coverUri);
  assert.equal((await call('/scan-drafts', { token: a.accessToken })).drafts[0].id, draft.id);
  const confirmed = await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: { ...payload, clientRequestId: draft.id } });
  const confirmedAgain = await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: { ...payload, clientRequestId: draft.id } });
  assert.equal(confirmed.id, confirmedAgain.id);
  assert.equal((await call('/scan-drafts', { token: a.accessToken })).drafts.length, 0);
  await call(`/scan-drafts/${draft.id}`, { token: a.accessToken, method: 'DELETE' });
  assert.equal((await call('/scan-drafts', { token: a.accessToken })).drafts.length, 0);
  const beforeBatch = (await call('/books', { token: a.accessToken })).books.length;
  const draftOne = await call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: '9780140328721' } });
  const draftTwo = await call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: '9780261103573' } });
  const draftThree = await call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: payload.isbn } });
  const partial = { baseRevision: 0, reviewed: false, payload: { title: 'Edited draft' } };
  const partialSaved = await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', body: partial });
  assert.equal(partialSaved.revision, 1);
  assert.equal((await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', body: partial })).revision, 1);
  await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', status: 409, body: { ...partial, payload: { title: 'Stale change' } } });
  await call(`/scan-drafts/${draftOne.id}`, { token: b.accessToken, status: 404 });
  await call(`/scan-drafts/${draftOne.id}`, { token: b.accessToken, method: 'PATCH', status: 404, body: partial });
  await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { baseRevision: 1, reviewed: true, payload: { title: 'Missing author' } } });
  await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { baseRevision: 1, reviewed: false, payload: null } });
  await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { baseRevision: 1, reviewed: false, payload: { title: null } } });
  await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { baseRevision: 1, reviewed: false, payload: { clientRequestId: draftTwo.id } } });
  await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { baseRevision: 1, reviewed: false, payload: { isbn: '9780261103573' } } });
  await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { baseRevision: 1, reviewed: false, payload: { coverUri: 'https://127.0.0.1/private' } } });
  const reviewedPayload = { title: 'Personal review snapshot', author: 'Author A; Author B', authors: ['Author A', 'Author B'], totalPages: 0, coverUri: payload.coverUri, catalogSource: 'open_library', externalId: '/books/TEST-REVIEW', publisher: 'Edited publisher' };
  const reviewedOne = await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', body: { baseRevision: 1, reviewed: true, payload: reviewedPayload } });
  const reviewedThree = await call(`/scan-drafts/${draftThree.id}`, { token: a.accessToken, method: 'PATCH', body: { baseRevision: 0, reviewed: true, payload: { title: 'Third book', author: 'Batch author', totalPages: 100 } } });
  await call('/books', { token: a.accessToken, method: 'POST', status: 409, body: { ...payload, clientRequestId: draftOne.id } });
  await stop(); await start();
  const persistedReview = await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken });
  assert.deepEqual(persistedReview.payload, reviewedPayload); assert.equal(persistedReview.revision, reviewedOne.revision); assert.equal(persistedReview.reviewed, true);
  const batchItems = [{ id: draftOne.id, revision: 1 }, { id: draftTwo.id, revision: 0 }, { id: draftThree.id, revision: reviewedThree.revision }];
  const partialBatch = await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 201, body: { items: batchItems } });
  assert.deepEqual(partialBatch.results.map((r) => r.status), ['conflict', 'invalid', 'saved']);
  const replayedBatch = await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 201, body: { items: batchItems } });
  assert.equal(replayedBatch.results[2].copyId, partialBatch.results[2].copyId);
  assert.equal((await call('/books', { token: a.accessToken })).books.length, beforeBatch + 1);
  const finalItems = [{ id: draftOne.id, revision: reviewedOne.revision }, { id: draftThree.id, revision: reviewedThree.revision }];
  const [batchA, batchB] = await Promise.all([1, 2].map(() => call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 201, body: { items: finalItems } })));
  assert.deepEqual(batchA.results, batchB.results); assert.ok(batchA.results.every((r) => r.status === 'saved'));
  const snapshotCopy = await call(`/books/${batchA.results[0].copyId}`, { token: a.accessToken });
  assert.equal(snapshotCopy.work.title, reviewedPayload.title); assert.equal(snapshotCopy.coverUri, reviewedPayload.coverUri); assert.equal(snapshotCopy.edition.externalId, reviewedPayload.externalId);
  assert.equal((await call('/books', { token: a.accessToken })).books.length, beforeBatch + 2);
  assert.deepEqual((await call('/scan-drafts', { token: a.accessToken })).drafts.map((d) => d.id), [draftTwo.id]);
  const deniedBatch = await call('/scan-drafts/confirm', { token: b.accessToken, method: 'POST', status: 201, body: { items: finalItems } });
  assert.ok(deniedBatch.results.every((r) => r.status === 'not_found' && !r.copyId));
  await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 400, body: { items: [finalItems[0], finalItems[0]] } });
  await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 400, body: { items: [] } });
  await call(`/scan-drafts/${draftOne.id}`, { token: a.accessToken, method: 'PATCH', status: 404, body: partial });
  // Force a real PostgreSQL failure after metadata creation, then verify rollback and row isolation.
  const blockedDraft = await call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: '9780140328721' } });
  const allowedDraft = await call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: payload.isbn } });
  const blockedReady = await call(`/scan-drafts/${blockedDraft.id}`, { token: a.accessToken, method: 'PATCH', body: { baseRevision: 0, reviewed: true, payload: { title: 'Must roll back', author: `Rollback-only author ${randomUUID()}`, totalPages: 10 } } });
  const allowedReady = await call(`/scan-drafts/${allowedDraft.id}`, { token: a.accessToken, method: 'PATCH', body: { baseRevision: 0, reviewed: true, payload: { title: 'Survives another failure', author: 'Author A', totalPages: 10 } } });
  const worksBefore = await prisma.bookWork.count(); const editionsBefore = await prisma.edition.count();
  // UUID is generated by this test. This DDL only runs on its explicitly opted-in disposable DB.
  await prisma.$executeRawUnsafe(`ALTER TABLE "BookCopy" ADD CONSTRAINT "WmbIntegrationRejectCopy" CHECK ("clientRequestId" IS DISTINCT FROM '${blockedDraft.id}'::uuid)`);
  try {
    const failedBatch = await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 201, body: { items: [{ id: blockedDraft.id, revision: blockedReady.revision }, { id: allowedDraft.id, revision: allowedReady.revision }] } });
    assert.deepEqual(failedBatch.results.map((r) => r.status), ['failed', 'saved']);
    assert.equal(await prisma.bookWork.count(), worksBefore + 1); assert.equal(await prisma.edition.count(), editionsBefore + 1);
    assert.equal((await call(`/scan-drafts/${blockedDraft.id}`, { token: a.accessToken })).reviewed, true);
  } finally { await prisma.$executeRawUnsafe('ALTER TABLE "BookCopy" DROP CONSTRAINT IF EXISTS "WmbIntegrationRejectCopy"'); }
  const retryFailed = await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 201, body: { items: [{ id: blockedDraft.id, revision: blockedReady.revision }] } });
  assert.equal(retryFailed.results[0].status, 'saved');
  // Exercise the complete supported batch size, not only a three-book sample.
  await call(`/scan-drafts/${draftTwo.id}`, { token: a.accessToken, method: 'DELETE' });
  const fixtureIsbn = (index) => {
    const prefix = `978180000${String(index).padStart(3, '0')}`;
    const sum = [...prefix].reduce((total, digit, position) => total + Number(digit) * (position % 2 ? 3 : 1), 0);
    return `${prefix}${(10 - sum % 10) % 10}`;
  };
  const fullBatch = [];
  for (let index = 0; index < 50; index++) {
    const staged = await call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: fixtureIsbn(index) } });
    const checked = await call(`/scan-drafts/${staged.id}`, { token: a.accessToken, method: 'PATCH', body: { baseRevision: 0, reviewed: true, payload: { title: `Batch fixture ${index}`, author: 'Batch capacity test author', totalPages: 100 } } });
    fullBatch.push({ id: checked.id, revision: checked.revision });
  }
  assert.equal((await call('/scan-drafts', { token: a.accessToken })).drafts.length, 50);
  assert.equal((await call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: fixtureIsbn(0) } })).id, fullBatch[0].id);
  await call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 400, body: { isbn: fixtureIsbn(50) } });
  await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 400, body: { items: [...fullBatch, { id: randomUUID(), revision: 0 }] } });
  const copiesBeforeFullBatch = (await call('/books', { token: a.accessToken })).books.length;
  const fullResult = await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 201, body: { items: fullBatch } });
  assert.equal(fullResult.results.length, 50); assert.ok(fullResult.results.every((result) => result.status === 'saved'));
  assert.equal(new Set(fullResult.results.map((result) => result.copyId)).size, 50);
  assert.equal((await call('/scan-drafts', { token: a.accessToken })).drafts.length, 0);
  const fullReplay = await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 201, body: { items: fullBatch } });
  assert.deepEqual(fullReplay.results, fullResult.results);
  assert.equal((await call('/books', { token: a.accessToken })).books.length, copiesBeforeFullBatch + 50);

  // Real multipart image processing and owner authorization, using bytes rather than URL mocks.
  const photo = await sharp({ create: { width: 1600, height: 2400, channels: 3, background: '#884433' } }).jpeg().withMetadata({ exif: { IFD0: { Artist: 'Private owner metadata' } } }).toBuffer();
  await uploadCover(undefined, photo, { status: 401 });
  await uploadCover(a.accessToken, photo, { source: 'external_url', status: 400 });
  await uploadCover(a.accessToken, photo, { mime: 'image/png', status: 400 });
  await uploadCover(a.accessToken, photo, { extraField: true, status: 400 });
  await uploadCover(a.accessToken, photo, { extraFile: true, status: 400 });
  await uploadCover(a.accessToken, Buffer.from('<svg/>'), { status: 400 });
  await uploadCover(a.accessToken, Buffer.from([255, 216, 255, 0]), { status: 400 });
  await uploadCover(a.accessToken, Buffer.alloc(8_000_001), { status: 413 });
  const hugePixels = await sharp({ create: { width: 6000, height: 5000, channels: 3, background: '#ffffff' } }).png().toBuffer();
  await uploadCover(a.accessToken, hugePixels, { mime: 'image/png', status: 400 });
  const [asset, assetReplay] = await Promise.all([uploadCover(a.accessToken, photo), uploadCover(a.accessToken, photo)]);
  assert.equal(asset.id, assetReplay.id); assert.equal(asset.mimeType, 'image/jpeg'); assert.equal(asset.width, 1200); assert.equal(asset.height, 1800);
  assert.equal(asset.bytes, undefined); assert.equal(asset.userId, undefined);
  const bAsset = await uploadCover(b.accessToken, photo, { source: 'camera' }); assert.notEqual(asset.id, bAsset.id);
  for (const path of [`/covers/${asset.id}`, `/covers/${asset.id}/image`]) {
    await call(path, { status: 401 }); await call(path, { token: b.accessToken, status: 404 });
  }
  await call(`/covers/${asset.id}`, { token: b.accessToken, method: 'DELETE', status: 404 });
  const image = await fetch(`${base}/covers/${asset.id}/image`, { headers: { Authorization: `Bearer ${a.accessToken}` } });
  assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/jpeg'); assert.equal(image.headers.get('cache-control'), 'private, no-store'); assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  const storedImage = Buffer.from(await image.arrayBuffer()); const imageMetadata = await sharp(storedImage).metadata();
  assert.equal(storedImage.length, asset.byteSize); assert.equal(imageMetadata.exif, undefined);
  const baseline = (await call(`/books/${second.id}`, { token: a.accessToken })).editionId;
  const withPhoto = await call(`/books/${second.id}`, { token: a.accessToken, method: 'PATCH', body: { coverMode: 'custom', coverAssetId: asset.id, coverUri: null } });
  assert.equal(withPhoto.coverMode, 'custom'); assert.equal(withPhoto.coverAssetId, asset.id); assert.equal(withPhoto.editionId, baseline);
  assert.equal((await call(`/books/${one.id}`, { token: a.accessToken })).coverAssetId, undefined);
  await call(`/covers/${asset.id}`, { token: a.accessToken, method: 'DELETE', status: 409 });
  await call('/books', { token: b.accessToken, method: 'POST', status: 404, body: { title: 'Foreign photo', author: 'B', totalPages: 0, coverMode: 'custom', coverAssetId: asset.id } });
  await call(`/books/${one.id}`, { token: a.accessToken, method: 'PATCH', status: 404, body: { coverMode: 'custom', coverAssetId: bAsset.id } });
  await call(`/books/${one.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { coverMode: 'custom', coverAssetId: null } });
  const photoDraft = await call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: '9780140328721' } });
  await call(`/scan-drafts/${photoDraft.id}`, { token: a.accessToken, method: 'PATCH', status: 404, body: { baseRevision: 0, reviewed: true, payload: { title: 'Foreign photo draft', author: 'A', coverMode: 'custom', coverAssetId: bAsset.id } } });
  const photoReady = await call(`/scan-drafts/${photoDraft.id}`, { token: a.accessToken, method: 'PATCH', body: { baseRevision: 0, reviewed: true, payload: { title: 'Private cover in batch', author: 'A', coverMode: 'custom', coverAssetId: asset.id, automaticCoverUri: payload.coverUri } } });
  const placeholder = await call(`/books/${second.id}`, { token: a.accessToken, method: 'PATCH', body: { coverMode: 'placeholder', coverAssetId: null, coverUri: null } });
  assert.equal(placeholder.coverMode, 'placeholder'); assert.equal(placeholder.coverAssetId, undefined); assert.equal(placeholder.edition.coverUri, payload.coverUri);
  await call(`/covers/${asset.id}`, { token: a.accessToken, method: 'DELETE', status: 409 }); // The draft also holds a protected reference.
  await stop(); await start();
  assert.equal((await call(`/scan-drafts/${photoDraft.id}`, { token: a.accessToken })).payload.coverAssetId, asset.id);
  assert.equal((await call(`/covers/${asset.id}`, { token: a.accessToken })).byteSize, asset.byteSize);
  const photoBatch = await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 201, body: { items: [{ id: photoReady.id, revision: photoReady.revision }] } });
  assert.equal(photoBatch.results[0].status, 'saved');
  const photoCopy = await call(`/books/${photoBatch.results[0].copyId}`, { token: a.accessToken }); assert.equal(photoCopy.coverAssetId, asset.id); assert.equal(photoCopy.coverMode, 'custom');
  const reset = await call(`/books/${photoCopy.id}`, { token: a.accessToken, method: 'PATCH', body: { coverMode: 'automatic', coverAssetId: null, coverUri: null } });
  assert.equal(reset.coverMode, 'automatic'); assert.equal(reset.coverAssetId, undefined); assert.equal(reset.edition.coverUri, payload.coverUri); assert.equal(reset.editionId, photoCopy.editionId);
  await call(`/covers/${asset.id}`, { token: a.accessToken, method: 'DELETE' });
  await call(`/covers/${asset.id}`, { token: a.accessToken, status: 404 });
  await call(`/covers/${bAsset.id}`, { token: b.accessToken, method: 'DELETE' });

  // Catalog provider responses are isolated in the test preload; HTTP/auth/PostgreSQL remain real.
  await call('/catalog/search?title=WMB', { status: 401 });
  for (const query of ['title=x', 'page=0&title=WMB', 'page=21&title=WMB', 'title[]=WMB', `title=${'x'.repeat(201)}`]) await call(`/catalog/search?${query}`, { token: a.accessToken, status: 400 });
  const searchPath = '/catalog/search?title=WMB%20catalog%20fixture&author=Fixture%20author';
  const searchA = await call(searchPath, { token: a.accessToken }); const searchB = await call(searchPath, { token: b.accessToken });
  assert.equal(searchA.hits.length, 20); assert.equal(searchA.hasMore, true); assert.equal(searchA.page, 1);
  const editionHit = searchA.hits.find((hit) => hit.source === 'google_books' && hit.edition?.isbn === '9780306406157');
  const workHit = searchA.hits.find((hit) => hit.source === 'open_library' && hit.isbns.includes('9780306406157'));
  assert.ok(editionHit); assert.ok(workHit); assert.equal(workHit.kind, 'work'); assert.equal(workHit.edition, undefined); assert.equal(workHit.covers, undefined);
  assert.ok(editionHit.existingCopies.some((copy) => copy.id === second.id)); assert.ok(searchB.hits.every((hit) => hit.existingCopies.length === 0));
  const nextPage = await call(`${searchPath}&page=2`, { token: a.accessToken }); assert.equal(nextPage.page, 2); assert.equal(nextPage.hits.length, 2); assert.equal(nextPage.hasMore, false);
  const chosen = editionHit.edition;
  const fromSearch = { title: chosen.title, author: chosen.authors.join('; '), authors: chosen.authors, totalPages: chosen.pageCount ?? 0, isbn: chosen.isbn, publisher: chosen.publisher, publicationYear: chosen.publicationYear, catalogSource: chosen.source, externalId: chosen.externalId, automaticCoverUri: chosen.covers[0]?.uri, coverMode: 'placeholder', coverStyle: 'forest', clientRequestId: randomUUID() };
  const styledCopy = await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: fromSearch });
  assert.equal(styledCopy.edition.isbn, chosen.isbn); assert.equal(styledCopy.edition.externalId, chosen.externalId); assert.equal(styledCopy.coverStyle, 'forest'); assert.equal(styledCopy.coverMode, 'placeholder');
  assert.equal((await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: fromSearch })).id, styledCopy.id);
  await call(`/books/${styledCopy.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { coverStyle: 'arbitrary-css' } });
  await call(`/books/${styledCopy.id}`, { token: a.accessToken, method: 'PATCH', status: 400, body: { coverStyle: null } });
  const copyWithSharedEdition = await call('/books', { token: a.accessToken, method: 'POST', status: 201, body: { ...fromSearch, clientRequestId: randomUUID(), editionId: styledCopy.editionId, coverStyle: 'parchment' } });
  const changedStyle = await call(`/books/${styledCopy.id}`, { token: a.accessToken, method: 'PATCH', body: { coverStyle: 'burgundy' } });
  assert.equal(changedStyle.editionId, styledCopy.editionId); assert.equal((await call(`/books/${copyWithSharedEdition.id}`, { token: a.accessToken })).coverStyle, 'parchment');
  await call(`/books/${styledCopy.id}`, { token: b.accessToken, method: 'PATCH', status: 403, body: { coverStyle: 'midnight' } });
  const styleDraft = await call('/scan-drafts', { token: a.accessToken, method: 'POST', status: 201, body: { isbn: payload.isbn } });
  const styleReady = await call(`/scan-drafts/${styleDraft.id}`, { token: a.accessToken, method: 'PATCH', body: { baseRevision: 0, reviewed: true, payload: { title: workHit.title, author: workHit.authors.join('; '), coverMode: 'placeholder', coverStyle: 'midnight' } } });
  await stop(); await start();
  assert.equal((await call(`/books/${styledCopy.id}`, { token: a.accessToken })).coverStyle, 'burgundy');
  const restoredStyle = await call(`/scan-drafts/${styleDraft.id}`, { token: a.accessToken }); assert.equal(restoredStyle.payload.coverStyle, 'midnight'); assert.equal(restoredStyle.isbn, '9780306406157');
  const styleConfirmation = await call('/scan-drafts/confirm', { token: a.accessToken, method: 'POST', status: 201, body: { items: [{ id: styleReady.id, revision: styleReady.revision }] } });
  assert.equal(styleConfirmation.results[0].status, 'saved'); const styleSaved = await call(`/books/${styleConfirmation.results[0].copyId}`, { token: a.accessToken }); assert.equal(styleSaved.coverStyle, 'midnight'); assert.equal(styleSaved.edition.isbn, '9780306406157');
  // Owner-bound offline mutation receipts survive replay and API restarts.
  const offlineOpId = randomUUID();
  const offlineBook = await call('/books/' + second.id, { token: a.accessToken });
  const offlineOp = {
    operationId: offlineOpId,
    copyId: offlineBook.id,
    baseUpdatedAt: offlineBook.updatedAt,
    kind: 'progress',
    currentPage: 7,
  };
  await call('/sync/mutations', { method: 'POST', body: offlineOp, status: 401 });
  await call('/sync/mutations', { method: 'POST', token: b.accessToken, body: offlineOp, status: 404 });
  const mutation = await call('/sync/mutations', { method: 'POST', token: a.accessToken, status: 201, body: offlineOp });
  assert.equal(mutation.currentPage, 7);
  assert.equal(mutation.operationId, offlineOpId);
  assert.deepEqual(await call('/sync/mutations', { method: 'POST', token: a.accessToken, status: 201, body: offlineOp }), mutation);
  await call('/sync/mutations', { method: 'POST', token: a.accessToken, status: 409, body: { ...offlineOp, currentPage: 8 } });
  await call('/sync/mutations', { method: 'POST', token: a.accessToken, status: 409, body: { ...offlineOp, operationId: randomUUID(), currentPage: 8 } });
  await call('/sync/mutations', { method: 'POST', token: a.accessToken, status: 400, body: { ...offlineOp, operationId: randomUUID(), currentPage: -1 } });
  const statusOffline = await call('/sync/mutations', { method: 'POST', token: a.accessToken, status: 201, body: {
    operationId: randomUUID(), copyId: offlineBook.id, baseUpdatedAt: mutation.updatedAt,
    kind: 'status', status: 'reading',
  } });
  assert.equal(statusOffline.status, 'reading');
  await stop(); await start();
  assert.deepEqual(await call('/sync/mutations', { method: 'POST', token: a.accessToken, status: 201, body: offlineOp }), mutation);
  assert.equal((await call('/books/' + offlineBook.id, { token: a.accessToken })).progress.currentPage, 7);
  assert.equal((await call('/books/' + offlineBook.id, { token: a.accessToken })).status, 'reading');
  await testShelves({ call, a, b, restart: async () => { await stop(); await start(); }, prisma });
  console.log('PASS: PostgreSQL/HTTP auth, isolation, CRUD, ISBN/cover persistence, concurrent replay, progress bounds, reviewed draft persistence/CAS, partial batch results, concurrent batch replay, API restart and complete 50-book capacity/replay; private image upload/normalization, bounds, ACL, draft confirmation, copy override/reset and protected deletion; catalog search/pagination/owner matches, search-to-copy snapshot and per-copy/draft cover styles');

} finally {
  await stop();
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
}
