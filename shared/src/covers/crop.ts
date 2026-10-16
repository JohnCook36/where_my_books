export interface CropRect { originX: number; originY: number; width: number; height: number }
/** Pixel coordinates; integer bounds accepted by native image decoders. */
export function coverCrop(width: number, height: number, aspect: number | null, zoom = 1, x = 0.5, y = 0.5): CropRect {
  if (![width, height, zoom, x, y].every(Number.isFinite) || width < 1 || height < 1 || (aspect !== null && (!Number.isFinite(aspect) || aspect <= 0))) throw new Error('Invalid crop geometry');
  const ratio = aspect ?? width / height;
  const cropWidth = Math.max(1, Math.min(Math.floor(width), Math.floor(Math.min(width, height * ratio) / Math.max(1, zoom))));
  const cropHeight = Math.max(1, Math.min(Math.floor(height), Math.floor(cropWidth / ratio)));
  return { width: cropWidth, height: cropHeight, originX: Math.round((Math.floor(width) - cropWidth) * Math.max(0, Math.min(1, x))), originY: Math.round((Math.floor(height) - cropHeight) * Math.max(0, Math.min(1, y))) };
}
