import type { EarningsDto, ReportDraftInput, ReportDto, ReportListItemDto } from '@sc/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, createCatalog, createUser, mockTelegram, resetDb } from '../../test/helpers.ts';
import { buildApp } from '../app.ts';
import { client, db } from '../db/index.ts';
import { priceItems, type User } from '../db/schema.ts';

const telegram = mockTelegram();
const sent = telegram.sent;

let app: FastifyInstance;
let ivan: User;
let sergey: User;
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
  sent.length = 0;
  telegram.down = false;
  ivan = await createUser('Иван Петров', 1001);
  sergey = await createUser('Сергей Ким', 1002);
  catalog = await createCatalog();
});

function api<T>(user: Pick<User, 'telegramId'>, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown) {
  return app
    .inject({ method, url, headers: authHeader(user.telegramId), payload: body as object })
    .then((res) => ({ status: res.statusCode, body: (res.body ? res.json() : undefined) as T }));
}

function draft(overrides: Partial<ReportDraftInput> = {}): ReportDraftInput {
  return {
    address: 'Багратиони 196И',
    location: '10 этаж',
    workDate: '2026-10-24',
    participantIds: [sergey.id],
    works: [
      { priceItemId: catalog.blocks.id, qty: 2 },
      { priceItemId: catalog.drilling.id, qty: 1 },
    ],
    materials: [{ materialId: catalog.pipe.id, qty: 0.3 }],
    comment: 'Приточка без монтажа',
    ...overrides,
  };
}

describe('reports', () => {
  it('creates a draft, splits the amount equally and publishes it to the group', async () => {
    const created = await api<ReportDto>(ivan, 'POST', '/api/reports', draft());
    expect(created.status).toBe(201);
    // 2 × 50 ₾ + 1 × 33,33 ₾ = 133,33 ₾; лишний тетри достаётся автору.
    expect(created.body.totalAmount).toBe(13_333);
    expect(created.body.participants).toEqual([
      { id: ivan.id, name: 'Иван Петров', amount: 6_667 },
      { id: sergey.id, name: 'Сергей Ким', amount: 6_666 },
    ]);

    const result = await api<ReportDto>(ivan, 'POST', `/api/reports/${created.body.id}/send`);
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('sent');
    expect(result.body.sentAt).not.toBeNull();

    expect(sent).toHaveLength(1);
    expect(sent[0]!.chat_id).toBe(-1001);
    expect(sent[0]!.text).toContain('👷 Иван Петров, Сергей Ким');
    expect(sent[0]!.text).toContain('• Труба ⌀110 — 0,3 м');
    expect(sent[0]!.text).not.toMatch(/₾|133/);
  });

  it('lets participants see the report but not edit or send it', async () => {
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft());

    expect((await api(sergey, 'GET', `/api/reports/${report.id}`)).status).toBe(200);
    expect((await api(sergey, 'PUT', `/api/reports/${report.id}`, draft())).status).toBe(403);
    expect((await api(sergey, 'POST', `/api/reports/${report.id}/send`)).status).toBe(403);

    const list = await api<ReportListItemDto[]>(sergey, 'GET', '/api/reports');
    expect(list.body).toMatchObject([{ id: report.id, myAmount: 6_666 }]);
  });

  it('hides reports from outsiders and rejects unregistered users', async () => {
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ participantIds: [] }));

    expect((await api(sergey, 'GET', `/api/reports/${report.id}`)).status).toBe(404);
    expect((await api({ telegramId: 9999 }, 'GET', '/api/reports')).status).toBe(403);
  });

  it('updates and deletes drafts but freezes sent reports', async () => {
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft());

    const updated = await api<ReportDto>(ivan, 'PUT', `/api/reports/${report.id}`, draft({ participantIds: [] }));
    expect(updated.body.participants).toEqual([{ id: ivan.id, name: 'Иван Петров', amount: 13_333 }]);

    await api(ivan, 'POST', `/api/reports/${report.id}/send`);
    expect((await api(ivan, 'PUT', `/api/reports/${report.id}`, draft())).status).toBe(409);
    expect((await api(ivan, 'DELETE', `/api/reports/${report.id}`)).status).toBe(409);

    const { body: other } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft());
    expect((await api(ivan, 'DELETE', `/api/reports/${other.id}`)).status).toBe(204);
    expect((await api(ivan, 'GET', `/api/reports/${other.id}`)).status).toBe(404);
  });

  it('validates input', async () => {
    const badQty = await api(ivan, 'POST', '/api/reports', draft({ works: [{ priceItemId: catalog.blocks.id, qty: 0.333 }] }));
    expect(badQty.status).toBe(400);
    expect((await api(ivan, 'POST', '/api/reports', draft({ participantIds: [12345] }))).status).toBe(400);
    expect((await api(ivan, 'POST', '/api/reports', draft({ works: [{ priceItemId: 12345, qty: 1 }] }))).status).toBe(400);

    const { body: empty } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ works: [], materials: [] }));
    expect((await api(ivan, 'POST', `/api/reports/${empty.id}/send`)).status).toBe(400);
    const { body: noAddress } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ address: '' }));
    expect((await api(ivan, 'POST', `/api/reports/${noAddress.id}/send`)).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('publishes only once on repeated or concurrent sends', async () => {
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft());
    const results = await Promise.all([
      api(ivan, 'POST', `/api/reports/${report.id}/send`),
      api(ivan, 'POST', `/api/reports/${report.id}/send`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(expect.arrayContaining([200]));
    for (const r of results) expect([200, 409]).toContain(r.status);

    const again = await api<ReportDto>(ivan, 'POST', `/api/reports/${report.id}/send`);
    expect(again.status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it('returns the report to draft when Telegram fails', async () => {
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft());
    telegram.down = true;

    const failed = await api(ivan, 'POST', `/api/reports/${report.id}/send`);
    expect(failed.status).toBe(502);
    expect((await api<ReportDto>(ivan, 'GET', `/api/reports/${report.id}`)).body.status).toBe('draft');

    telegram.down = false;
    expect((await api<ReportDto>(ivan, 'POST', `/api/reports/${report.id}/send`)).body.status).toBe('sent');
  });

  it('fixes prices at send time', async () => {
    const { body: report } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ participantIds: [], works: [{ priceItemId: catalog.blocks.id, qty: 1 }] }));
    expect(report.totalAmount).toBe(5_000);

    // Прайс поменялся, пока отчёт был черновиком: при отправке берётся новая цена.
    await db.update(priceItems).set({ price: 6_000 }).where(eq(priceItems.id, catalog.blocks.id));
    const sentReport = await api<ReportDto>(ivan, 'POST', `/api/reports/${report.id}/send`);
    expect(sentReport.body.totalAmount).toBe(6_000);

    // После отправки отчёт больше не зависит от прайса.
    await db.update(priceItems).set({ price: 7_000 }).where(eq(priceItems.id, catalog.blocks.id));
    const later = await api<ReportDto>(ivan, 'GET', `/api/reports/${report.id}`);
    expect(later.body.totalAmount).toBe(6_000);
    expect(later.body.works[0]!.unitPrice).toBe(6_000);
  });
});

describe('earnings', () => {
  it('sums sent reports by day within the range', async () => {
    const send = async (workDate: string, participantIds: number[]) => {
      const { body } = await api<ReportDto>(ivan, 'POST', '/api/reports', draft({ workDate, participantIds }));
      await api(ivan, 'POST', `/api/reports/${body.id}/send`);
    };
    await send('2026-10-24', [sergey.id]); // Иван 66,67 ₾, Сергей 66,66 ₾
    await send('2026-10-24', []); // Иван 133,33 ₾
    await send('2026-10-25', [sergey.id]);
    await send('2026-11-01', []); // вне диапазона
    await api(ivan, 'POST', '/api/reports', draft({ workDate: '2026-10-24' })); // черновик не считается

    const query = '/api/me/earnings?from=2026-10-01&to=2026-10-31';
    const mine = await api<EarningsDto>(ivan, 'GET', query);
    expect(mine.body).toEqual({
      days: [
        { date: '2026-10-24', amount: 20_000, reports: 2 },
        { date: '2026-10-25', amount: 6_667, reports: 1 },
      ],
      total: 26_667,
    });

    const his = await api<EarningsDto>(sergey, 'GET', query);
    expect(his.body.total).toBe(13_332);

    expect((await api(ivan, 'GET', '/api/me/earnings?from=2026-11-01&to=2026-10-01')).status).toBe(400);
  });
});
