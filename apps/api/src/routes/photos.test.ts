import type { PhotoDto, ReportDraftInput, ReportDto } from '@sc/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, createCatalog, createUser, fakeJpeg, mockTelegram, multipartBody, resetDb } from '../../test/helpers.ts';
import { buildApp } from '../app.ts';
import { client, db } from '../db/index.ts';
import { reportPhotos, type User } from '../db/schema.ts';
import { deleteOrphanPhotos } from '../photos/cleanup.ts';
import { photoPath } from '../photos/storage.ts';

const telegram = mockTelegram();

let app: FastifyInstance;
let ivan: User;
let sergey: User;
let outsider: User;
let catalog: Awaited<ReturnType<typeof createCatalog>>;

beforeAll(async () => {
  app = await buildApp({ logger: false });
});

afterAll(async () => {
  await app.close();
  await client.end();
});

beforeEach(async () => {
  await resetDb();
  telegram.sent.length = 0;
  telegram.media.length = 0;
  ivan = await createUser('Иван', 4001);
  sergey = await createUser('Сергей', 4002);
  outsider = await createUser('Посторонний', 4003);
  catalog = await createCatalog();
});

async function upload(user: User, data = fakeJpeg) {
  const { payload, headers } = multipartBody(data);
  const res = await app.inject({ method: 'POST', url: '/api/photos', payload, headers: { ...headers, ...authHeader(user.telegramId) } });
  return { status: res.statusCode, body: res.json() as PhotoDto };
}

function api<T>(user: User, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown) {
  return app
    .inject({ method, url, headers: authHeader(user.telegramId), payload: body as object })
    .then((res) => ({
      status: res.statusCode,
      body: (res.headers['content-type']?.toString().includes('json') ? res.json() : undefined) as T,
      raw: res.rawPayload,
    }));
}

function draft(overrides: Partial<ReportDraftInput> = {}): ReportDraftInput {
  return {
    address: 'Багратиони 196И',
    workDate: '2026-10-25',
    participantIds: [sergey.id],
    works: [{ priceItemId: catalog.blocks.id, qty: 1 }],
    ...overrides,
  };
}

async function storageKey(photoId: number) {
  const [row] = await db.select().from(reportPhotos).where(eq(reportPhotos.id, photoId));
  return row?.storageKey;
}

describe('uploading photos', () => {
  it('stores JPEGs and shows them only to the uploader and report participants', async () => {
    const photo = await upload(ivan);
    expect(photo.status).toBe(201);
    expect(existsSync(photoPath((await storageKey(photo.body.id))!))).toBe(true);

    const own = await api(ivan, 'GET', `/api/photos/${photo.body.id}`);
    expect(own.status).toBe(200);
    expect(Buffer.from(own.raw).equals(fakeJpeg)).toBe(true);
    expect((await api(sergey, 'GET', `/api/photos/${photo.body.id}`)).status).toBe(404);

    // После прикрепления к отчёту фото видит и участник.
    await api(ivan, 'POST', '/api/reports', draft({ photoIds: [photo.body.id] }));
    expect((await api(sergey, 'GET', `/api/photos/${photo.body.id}`)).status).toBe(200);
    expect((await api(outsider, 'GET', `/api/photos/${photo.body.id}`)).status).toBe(404);
  });

  it('rejects files that are not JPEG', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((await upload(ivan, png)).status).toBe(400);
  });
});

describe('photos in reports', () => {
  it('keeps the chosen order and refuses photos of other people or other reports', async () => {
    const [a, b] = [(await upload(ivan)).body.id, (await upload(ivan)).body.id];
    const created = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ photoIds: [b, a] }));
    expect(created.body.photos).toEqual([{ id: b }, { id: a }]);

    const foreign = (await upload(sergey)).body.id;
    expect((await api(ivan, 'POST', '/api/reports', draft({ photoIds: [foreign] }))).status).toBe(400);
    expect((await api(ivan, 'POST', '/api/reports', draft({ photoIds: [a] }))).status).toBe(400);
    expect((await api(ivan, 'POST', '/api/reports', draft({ photoIds: Array.from({ length: 11 }, (_, i) => i + 1) }))).status).toBe(400);
  });

  it('sends several photos as an album with the report as caption', async () => {
    const ids = [(await upload(ivan)).body.id, (await upload(ivan)).body.id];
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ photoIds: ids }));
    const sent = await api<ReportDto>(ivan, 'POST', `/api/reports/${report.id}/send`);

    expect(sent.body.status).toBe('sent');
    expect(telegram.media).toEqual([
      { method: 'sendMediaGroup', chat_id: -1001, photos: 2, caption: expect.stringContaining('📍 <b>Багратиони 196И</b>') },
    ]);
    expect(telegram.sent).toHaveLength(0);
    const rows = await db.select().from(reportPhotos).orderBy(reportPhotos.sortOrder);
    expect(rows.map((r) => r.tgFileId)).toEqual([expect.stringMatching(/^file-/), expect.stringMatching(/^file-/)]);
  });

  it('sends a single photo with sendPhoto', async () => {
    const id = (await upload(ivan)).body.id;
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ photoIds: [id] }));
    await api(ivan, 'POST', `/api/reports/${report.id}/send`);
    expect(telegram.media).toMatchObject([{ method: 'sendPhoto', photos: 1 }]);
    expect(telegram.sent).toHaveLength(0);
  });

  it('sends a long report as a separate message after the album', async () => {
    const ids = [(await upload(ivan)).body.id, (await upload(ivan)).body.id];
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ photoIds: ids, comment: 'а'.repeat(1000) }));
    await api(ivan, 'POST', `/api/reports/${report.id}/send`);
    expect(telegram.media).toMatchObject([{ method: 'sendMediaGroup', photos: 2, caption: undefined }]);
    expect(telegram.sent).toHaveLength(1);
  });
});

describe('removing photos', () => {
  it('deletes own photos from drafts but not from sent reports', async () => {
    const id = (await upload(ivan)).body.id;
    const key = (await storageKey(id))!;
    expect((await api(sergey, 'DELETE', `/api/photos/${id}`)).status).toBe(404);
    expect((await api(ivan, 'DELETE', `/api/photos/${id}`)).status).toBe(204);
    expect(existsSync(photoPath(key))).toBe(false);

    const kept = (await upload(ivan)).body.id;
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ photoIds: [kept] }));
    await api(ivan, 'POST', `/api/reports/${report.id}/send`);
    expect((await api(ivan, 'DELETE', `/api/photos/${kept}`)).status).toBe(409);
  });

  it('cleans up photos left without a report after two days', async () => {
    const [kept, dropped] = [(await upload(ivan)).body.id, (await upload(ivan)).body.id];
    // Загружено, но так и не прикреплено к отчёту.
    await upload(ivan);
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ photoIds: [kept, dropped] }));
    // Фото убрали из черновика — оно отвязывается.
    await api(ivan, 'PUT', `/api/reports/${report.id}`, draft({ photoIds: [kept] }));
    const droppedKey = (await storageKey(dropped))!;

    // Пока не прошло двух суток, ничего не удаляется.
    expect(await deleteOrphanPhotos(new Date())).toBe(0);
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    expect(await deleteOrphanPhotos(threeDaysLater)).toBe(2);

    const left = await db.select({ id: reportPhotos.id }).from(reportPhotos);
    expect(left).toEqual([{ id: kept }]);
    expect(existsSync(photoPath(droppedKey))).toBe(false);
  });

  it('detaches photos when a draft is deleted', async () => {
    const id = (await upload(ivan)).body.id;
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ photoIds: [id] }));
    await api(ivan, 'DELETE', `/api/reports/${report.id}`);
    const [row] = await db.select().from(reportPhotos).where(eq(reportPhotos.id, id));
    expect(row?.reportId).toBeNull();
  });
});
