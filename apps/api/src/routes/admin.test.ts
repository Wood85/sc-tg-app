import type { AdminPriceItemDto, AdminUserDto, CatalogDto, MeDto, WageRates } from '@sc/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, createCatalog, createUser, mockTelegram, resetDb } from '../../test/helpers.ts';
import { buildApp } from '../app.ts';
import { client } from '../db/index.ts';
import type { User } from '../db/schema.ts';

const telegram = mockTelegram();

let app: FastifyInstance;
let admin: User;
let installer: User;

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
  admin = await createUser('Админ', 2001, 'admin');
  installer = await createUser('Монтажник', 2002);
});

function api<T>(telegramId: number, method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown) {
  return app
    .inject({ method, url, headers: authHeader(telegramId), payload: body as object })
    .then((res) => ({ status: res.statusCode, body: res.json() as T }));
}

const work = { category: 'conditioning', name: 'Монтаж блоков', unit: 'шт', price: 5000 } as const;

describe('admin access', () => {
  it('is forbidden for installers', async () => {
    expect((await api(installer.telegramId, 'GET', '/api/admin/price-items')).status).toBe(403);
    expect((await api(installer.telegramId, 'POST', '/api/admin/users', { telegramId: 1, name: 'X' })).status).toBe(403);
  });
});

describe('price items', () => {
  it('creates, edits and hides items; the report form sees only active ones', async () => {
    const created = await api<AdminPriceItemDto>(admin.telegramId, 'POST', '/api/admin/price-items', work);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ...work, isActive: true });

    const updated = await api<AdminPriceItemDto>(admin.telegramId, 'PUT', `/api/admin/price-items/${created.body.id}`, {
      ...work,
      price: 6000,
      isActive: false,
    });
    expect(updated.body).toMatchObject({ price: 6000, isActive: false });

    const catalog = await api<CatalogDto>(installer.telegramId, 'GET', '/api/catalog');
    expect(catalog.body.priceItems).toEqual([]);
    const all = await api<AdminPriceItemDto[]>(admin.telegramId, 'GET', '/api/admin/price-items');
    expect(all.body).toHaveLength(1);
  });

  it('rejects duplicates within a category and unknown ids', async () => {
    await api(admin.telegramId, 'POST', '/api/admin/price-items', work);
    expect((await api(admin.telegramId, 'POST', '/api/admin/price-items', work)).status).toBe(409);
    // В другой категории то же название допустимо.
    expect((await api(admin.telegramId, 'POST', '/api/admin/price-items', { ...work, category: 'ventilation' })).status).toBe(201);
    expect((await api(admin.telegramId, 'PUT', '/api/admin/price-items/999', work)).status).toBe(404);
    expect((await api(admin.telegramId, 'POST', '/api/admin/price-items', { ...work, price: -1 })).status).toBe(400);
  });

  it('appends new items to the end of their category', async () => {
    await createCatalog();
    await api(admin.telegramId, 'POST', '/api/admin/price-items', { ...work, name: 'Пайка трубок' });
    const catalog = await api<CatalogDto>(admin.telegramId, 'GET', '/api/catalog');
    expect(catalog.body.priceItems.filter((i) => i.category === 'conditioning').map((i) => i.name)).toEqual([
      'Монтаж блоков',
      'Пайка трубок',
    ]);
  });
});

describe('tiered price items', () => {
  it('stores tiers and uses the first tier as the display price', async () => {
    const tiers = [
      { upTo: 50, price: 600 },
      { upTo: null, price: 550 },
    ];
    const created = await api<AdminPriceItemDto>(admin.telegramId, 'POST', '/api/admin/price-items', {
      ...work,
      name: 'Прокладка гибкого воздуховода',
      unit: 'м',
      price: 0,
      tiers,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ price: 600, tiers });

    const bad = await api(admin.telegramId, 'POST', '/api/admin/price-items', { ...work, name: 'X', tiers: [{ upTo: 5, price: 1 }, { upTo: 3, price: 1 }] });
    expect(bad.status).toBe(400);

    const flat = await api<AdminPriceItemDto>(admin.telegramId, 'PUT', `/api/admin/price-items/${created.body.id}`, {
      ...work,
      name: 'Прокладка гибкого воздуховода',
      price: 500,
      tiers: null,
    });
    expect(flat.body).toMatchObject({ price: 500, tiers: null });
  });
});

describe('deleting catalog items', () => {
  it('deletes unused items but refuses items used in reports', async () => {
    const { blocks, drilling, pipe } = await createCatalog();
    const del = (path: string) =>
      app.inject({ method: 'DELETE', url: path, headers: authHeader(admin.telegramId) }).then((r) => r.statusCode);

    await app.inject({
      method: 'POST',
      url: '/api/reports',
      headers: authHeader(installer.telegramId),
      payload: { workDate: '2026-10-25', works: [{ priceItemId: blocks.id, qty: 1 }], materials: [{ materialId: pipe.id, qty: 1 }] },
    });

    expect(await del(`/api/admin/price-items/${blocks.id}`)).toBe(409);
    expect(await del(`/api/admin/materials/${pipe.id}`)).toBe(409);
    expect(await del(`/api/admin/price-items/${drilling.id}`)).toBe(204);
    expect(await del(`/api/admin/price-items/${drilling.id}`)).toBe(404);

    const catalog = await api<CatalogDto>(admin.telegramId, 'GET', '/api/catalog');
    expect(catalog.body.priceItems.map((i) => i.id)).toEqual([blocks.id]);
  });

  it('is forbidden for installers', async () => {
    const { drilling } = await createCatalog();
    const res = await app.inject({ method: 'DELETE', url: `/api/admin/price-items/${drilling.id}`, headers: authHeader(installer.telegramId) });
    expect(res.statusCode).toBe(403);
  });
});

describe('wage rates', () => {
  it('lets admins change the rates and shows them in the catalog', async () => {
    const defaults = await api<WageRates>(admin.telegramId, 'GET', '/api/admin/wage-rates');
    expect(defaults.body).toEqual({ weekday: 7_000, weekend: 10_000 });

    const updated = await api<WageRates>(admin.telegramId, 'PUT', '/api/admin/wage-rates', { weekday: 7_500, weekend: 11_000 });
    expect(updated.body).toEqual({ weekday: 7_500, weekend: 11_000 });
    const catalog = await api<CatalogDto>(installer.telegramId, 'GET', '/api/catalog');
    expect(catalog.body.wageRates).toEqual({ weekday: 7_500, weekend: 11_000 });

    expect((await api(admin.telegramId, 'PUT', '/api/admin/wage-rates', { weekday: -1, weekend: 1 })).status).toBe(400);
    expect((await api(installer.telegramId, 'PUT', '/api/admin/wage-rates', { weekday: 1, weekend: 1 })).status).toBe(403);
  });
});

describe('materials', () => {
  it('creates and edits materials', async () => {
    const material = { category: 'ventilation', name: 'Труба ⌀110', unit: 'м' };
    const created = await api<{ id: number }>(admin.telegramId, 'POST', '/api/admin/materials', material);
    expect(created.status).toBe(201);
    const updated = await api(admin.telegramId, 'PUT', `/api/admin/materials/${created.body.id}`, { ...material, unit: 'п.м.' });
    expect(updated.body).toMatchObject({ unit: 'п.м.', isActive: true });
    expect((await api(admin.telegramId, 'POST', '/api/admin/materials', material)).status).toBe(409);
  });
});

describe('users', () => {
  it('adds an installer who can then use the app and gets notified', async () => {
    const created = await api<AdminUserDto>(admin.telegramId, 'POST', '/api/admin/users', { telegramId: 3003, name: 'Новичок' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ telegramId: 3003, role: 'installer', isActive: true });

    const me = await api<MeDto>(3003, 'GET', '/api/me');
    expect(me.body.name).toBe('Новичок');

    await expect.poll(() => telegram.sent.length).toBe(1);
    expect(telegram.sent[0]!.chat_id).toBe(3003);
  });

  it('deactivated users lose access', async () => {
    await api(admin.telegramId, 'PUT', `/api/admin/users/${installer.id}`, {
      telegramId: installer.telegramId,
      name: installer.name,
      isActive: false,
    });
    expect((await api(installer.telegramId, 'GET', '/api/me')).status).toBe(403);
  });

  it('prevents duplicates and locking yourself out', async () => {
    expect((await api(admin.telegramId, 'POST', '/api/admin/users', { telegramId: installer.telegramId, name: 'Дубль' })).status).toBe(409);

    const self = { telegramId: admin.telegramId, name: 'Админ' };
    expect((await api(admin.telegramId, 'PUT', `/api/admin/users/${admin.id}`, { ...self, role: 'installer' })).status).toBe(400);
    expect((await api(admin.telegramId, 'PUT', `/api/admin/users/${admin.id}`, { ...self, role: 'admin', isActive: false })).status).toBe(400);
    expect((await api(admin.telegramId, 'PUT', `/api/admin/users/${admin.id}`, { ...self, name: 'Главный', role: 'admin' })).status).toBe(200);
  });
});
