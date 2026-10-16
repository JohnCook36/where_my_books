import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 8_000_000;
export const MAX_COVER_BYTES = 2_000_000;
const allowedFormats: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export async function normalizeUserCover(buffer: Buffer, declaredMime: string) {
  if (!buffer.length) throw new BadRequestException('Файл обложки пуст');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new PayloadTooLargeException('Изображение должно быть не больше 8 МБ');
  if (!Object.values(allowedFormats).includes(declaredMime)) throw new BadRequestException('Поддерживаются JPEG, PNG и WebP');
  const detected = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff ? 'image/jpeg' : buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png' : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
  if (detected !== declaredMime) throw new BadRequestException('Содержимое файла не соответствует формату изображения');
  try {
    const image = sharp(buffer, { limitInputPixels: 24_000_000, failOn: 'error', animated: false });
    const metadata = await image.metadata();
    if (allowedFormats[metadata.format ?? ''] !== declaredMime || (metadata.pages ?? 1) !== 1) throw new Error('Unsupported or mismatched image');
    // Decode and re-encode. No withMetadata(): EXIF, GPS and original filename are not retained.
    const { data, info } = await image.rotate().resize({ width: 1200, height: 1800, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
    if (data.length > MAX_COVER_BYTES) throw new Error('Normalized image too large');
    return { bytes: data, width: info.width, height: info.height, byteSize: data.length, mimeType: 'image/jpeg' as const };
  } catch {
    throw new BadRequestException('Не удалось прочитать изображение. Выберите корректный JPEG, PNG или WebP до 24 мегапикселей.');
  }
}
