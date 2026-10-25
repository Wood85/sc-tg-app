import { and, isNull, lt } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { reportPhotos } from '../db/schema.ts';
import { removePhoto } from './storage.ts';

// Фото без отчёта старше двух суток: загрузили и передумали, или черновик удалён.
// Двое суток — запас на случай, если отчёт заполняют несколько дней.
const ORPHAN_TTL_MS = 2 * 24 * 60 * 60 * 1000;

export async function deleteOrphanPhotos(now = new Date()): Promise<number> {
  const orphans = await db
    .delete(reportPhotos)
    .where(and(isNull(reportPhotos.reportId), lt(reportPhotos.createdAt, new Date(now.getTime() - ORPHAN_TTL_MS))))
    .returning({ storageKey: reportPhotos.storageKey });
  await Promise.all(orphans.map((p) => removePhoto(p.storageKey)));
  return orphans.length;
}
