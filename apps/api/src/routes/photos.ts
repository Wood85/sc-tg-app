import type { PhotoDto } from '@sc/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { reportParticipants, reportPhotos, reports } from '../db/schema.ts';
import { HttpError, parseOrThrow } from '../errors.ts';
import { readPhoto, removePhoto, savePhoto } from '../photos/storage.ts';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

// Клиент сжимает фото в JPEG перед загрузкой; другие форматы Telegram в альбоме не всегда принимает.
function isJpeg(data: Uint8Array): boolean {
  return data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
}

export async function photoRoutes(app: FastifyInstance) {
  app.post('/photos', async (req, reply): Promise<PhotoDto> => {
    const file = await req.file();
    if (!file) throw new HttpError(400, 'Файл не передан');
    const data = await file.toBuffer();
    if (!isJpeg(data)) throw new HttpError(400, 'Нужна фотография в формате JPEG');

    const storageKey = await savePhoto(data);
    const [photo] = await db
      .insert(reportPhotos)
      .values({ uploaderId: req.user.id, storageKey })
      .returning({ id: reportPhotos.id });
    reply.code(201);
    return { id: photo!.id };
  });

  // Фото видят загрузивший и участники отчёта, к которому оно прикреплено.
  app.get('/photos/:id', async (req, reply) => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    const [photo] = await db.select().from(reportPhotos).where(eq(reportPhotos.id, id));
    let allowed = photo?.uploaderId === req.user.id;
    if (photo && !allowed && photo.reportId !== null) {
      const [participant] = await db
        .select()
        .from(reportParticipants)
        .where(and(eq(reportParticipants.reportId, photo.reportId), eq(reportParticipants.userId, req.user.id)));
      allowed = Boolean(participant);
    }
    if (!photo || !allowed) throw new HttpError(404, 'Фото не найдено');

    return reply.type('image/jpeg').header('cache-control', 'private, max-age=86400').send(readPhoto(photo.storageKey));
  });

  app.delete('/photos/:id', async (req, reply) => {
    const { id } = parseOrThrow(paramsSchema, req.params);
    const [photo] = await db
      .select({ storageKey: reportPhotos.storageKey, uploaderId: reportPhotos.uploaderId, status: reports.status })
      .from(reportPhotos)
      .leftJoin(reports, eq(reports.id, reportPhotos.reportId))
      .where(eq(reportPhotos.id, id));
    if (!photo || photo.uploaderId !== req.user.id) throw new HttpError(404, 'Фото не найдено');
    if (photo.status && photo.status !== 'draft') throw new HttpError(409, 'Отчёт уже отправлен');

    await db.delete(reportPhotos).where(eq(reportPhotos.id, id));
    await removePhoto(photo.storageKey);
    return reply.code(204).send();
  });
}
