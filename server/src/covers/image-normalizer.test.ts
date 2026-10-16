import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizeUserCover, MAX_UPLOAD_BYTES } from './image-normalizer.js';
describe('private cover normalization', () => {
  it.each(['jpeg', 'png', 'webp'] as const)('decodes %s and stores a bounded JPEG without metadata', async (format) => {
    const source = await sharp({ create: { width: 1800, height: 2400, channels: 3, background: '#923541' } }).toFormat(format).withMetadata({ exif: { IFD0: { Artist: 'Private test identity' } } }).toBuffer();
    const result = await normalizeUserCover(source, `image/${format}`);
    const metadata = await sharp(result.bytes).metadata();
    expect(result.width).toBe(1200); expect(result.height).toBe(1600);
    expect(result.byteSize).toBe(result.bytes.length); expect(metadata.format).toBe('jpeg');
    expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
  });
  it('applies EXIF orientation before resizing and removes the tag', async () => {
    const source = await sharp({ create: { width: 400, height: 600, channels: 3, background: '#fff' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await normalizeUserCover(source, 'image/jpeg');
    expect([result.width, result.height]).toEqual([600, 400]); expect((await sharp(result.bytes).metadata()).orientation).toBeUndefined();
  });
  it('rejects excessive decoded dimensions even when the compressed file is tiny', async () => {
    const source = await sharp({ create: { width: 6000, height: 5000, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(normalizeUserCover(source, 'image/png')).rejects.toThrow('Не удалось прочитать');
  });
  it('rejects a mismatched declared MIME', async () => {
    const source = await sharp({ create: { width: 2, height: 3, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(normalizeUserCover(source, 'image/jpeg')).rejects.toThrow('не соответствует');
  });
  it.each([[Buffer.alloc(0), 'image/jpeg'], [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/jpeg'], [Buffer.from([255, 216, 255, 0]), 'image/jpeg'], [Buffer.from('file'), 'application/pdf']])('rejects empty, forged or corrupt input', async (bytes, mime) => { await expect(normalizeUserCover(bytes, mime)).rejects.toThrow(); });
  it('rejects oversized input before image decoding', async () => { await expect(normalizeUserCover(Buffer.alloc(MAX_UPLOAD_BYTES + 1), 'image/jpeg')).rejects.toThrow('8 МБ'); });
});
