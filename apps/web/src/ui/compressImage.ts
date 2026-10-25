// Фото с телефона весят 3–10 МБ. Уменьшаем до 1600 px по длинной стороне и пережимаем в JPEG:
// получается около 300 КБ — грузится и на плохой связи, а для Telegram качества хватает.
const MAX_SIDE = 1600;
const QUALITY = 0.82;

export async function compressImage(file: Blob): Promise<Blob> {
  // from-image — учитываем поворот из EXIF, иначе вертикальные фото лягут на бок.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode JPEG'))), 'image/jpeg', QUALITY),
  );
}
