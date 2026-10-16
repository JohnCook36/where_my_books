// Runs against a disposable PostgreSQL database. Never uses external catalog availability as a test gate.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
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
  console.log('PASS: PostgreSQL/HTTP auth, isolation, CRUD, ISBN/cover persistence, concurrent replay, progress bounds, reviewed draft persistence/CAS, partial batch results, concurrent batch replay, API restart and complete 50-book capacity/replay; private image upload/normalization, bounds, ACL, draft confirmation, copy override/reset and protected deletion; catalog search/pagination/owner matches, search-to-copy snapshot and per-copy/draft cover styles');

} finally {
  await stop();
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
}
