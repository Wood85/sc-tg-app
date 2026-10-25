import {
  addDays,
  type PayrollSendResultDto,
  type PayrollStatementDto,
  type PayrollUserDto,
  type ReportDraftInput,
  type ReportDto,
  today,
  weekRange,
} from '@sc/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeader, createCatalog, createUser, mockTelegram, resetDb } from '../../test/helpers.ts';
import { buildApp } from '../app.ts';
import { client, db } from '../db/index.ts';
import { materials, payrollStatements, type User, users } from '../db/schema.ts';

const telegram = mockTelegram();

let app: FastifyInstance;
let ivan: User;
let sergey: User;
let admin: User;
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
  telegram.down = false;
  ivan = await createUser('Иван Петров', 6001);
  sergey = await createUser('Сергей Ким', 6002);
  admin = await createUser('Админ', 6003, 'admin');
  // Отключённый админ сообщений не получает.
  const retired = await createUser('Бывший админ', 6004, 'admin');
  await db.update(users).set({ isActive: false }).where(eq(users.id, retired.id));
  catalog = await createCatalog();
});

function api<T>(user: Pick<User, 'telegramId'>, method: 'GET' | 'POST', url: string, body?: unknown) {
  return app
    .inject({ method, url, headers: authHeader(user.telegramId), payload: body as object })
    .then((res) => ({ status: res.statusCode, body: res.json() as T }));
}

async function sendReport(author: User, overrides: Partial<ReportDraftInput>) {
  const { body } = await api<ReportDto>(author, 'POST', '/api/reports', {
    address: 'Багратиони 196И',
    workDate: '2026-10-19',
    works: [{ priceItemId: catalog.blocks.id, qty: 1 }], // 50 ₾
    ...overrides,
  });
  await api(author, 'POST', `/api/reports/${body.id}/send`);
}

// Неделя 19–25 октября 2026: понедельник 19-го (оклад 70 ₾) и суббота 24-го (оклад 100 ₾).
async function fillWeek() {
  await sendReport(ivan, { location: '10 этаж' });
  // Отчёт Сергея, где Иван в бригаде: 50 ₾ пополам.
  await sendReport(sergey, { address: 'Чавчавадзе 12', participantIds: [ivan.id] });
  const [pipe] = await db.select().from(materials);
  await sendReport(ivan, { address: 'Руставели 3', workDate: '2026-10-24', materials: [{ materialId: pipe!.id, qty: 2 }] });
  // Не входят в неделю: следующая неделя и черновик.
  await sendReport(ivan, { workDate: '2026-10-26' });
  await api(ivan, 'POST', '/api/reports', { address: 'Черновик', workDate: '2026-10-20', works: [{ priceItemId: catalog.blocks.id, qty: 9 }] });
  telegram.sent.length = 0;
}

describe('sending the weekly payroll', () => {
  it('collects the week by day with shares and wages and notifies active admins', async () => {
    await fillWeek();
    const { status, body } = await api<PayrollSendResultDto>(ivan, 'POST', '/api/payroll', { weekStart: '2026-10-19' });

    expect(status).toBe(200);
    expect(body.notifiedAdmins).toBe(1);
    const { statement } = body;
    expect(statement).toMatchObject({ weekStart: '2026-10-19', weekEnd: '2026-10-25', user: { name: 'Иван Петров' } });
    expect(statement.days.map((d) => [d.date, d.reports.map((r) => r.amount), d.wage, d.total])).toEqual([
      ['2026-10-19', [5_000, 2_500], 7_000, 14_500],
      ['2026-10-24', [5_000], 10_000, 15_000],
    ]);
    expect(statement.total).toBe(29_500);
    expect(statement.days[0]!.reports[0]).toMatchObject({
      address: 'Багратиони 196И',
      location: '10 этаж',
      works: [{ name: 'Монтаж блоков', qty: 1, unit: 'шт' }],
    });

    expect(telegram.sent.map((m) => m.chat_id)).toEqual([admin.telegramId]);
    const text = telegram.sent[0]!.text;
    expect(text).toContain('💰 <b>На выплату: Иван Петров</b>');
    expect(text).toContain('Неделя 19–25 октября');
    expect(text).toContain('📅 <b>Пн, 19 октября — 145,00 ₾</b>');
    expect(text).toContain('📍 Багратиони 196И · 10 этаж — 50,00 ₾');
    expect(text).toContain('  • Монтаж блоков — 1 шт');
    expect(text).toContain('Оклад: 100,00 ₾');
    expect(text).toContain('<b>Итого за неделю: 295,00 ₾</b>');
    expect(text).not.toContain('Труба'); // материалы в отчёт на выплату не входят
    expect(telegram.media).toHaveLength(0); // без фото
  });

  it('updates the statement when sent again', async () => {
    await fillWeek();
    await api(ivan, 'POST', '/api/payroll', { weekStart: '2026-10-19' });
    await sendReport(ivan, { workDate: '2026-10-21' });
    telegram.sent.length = 0;

    const again = await api<PayrollSendResultDto>(ivan, 'POST', '/api/payroll', { weekStart: '2026-10-19' });
    expect(again.body.statement.total).toBe(29_500 + 5_000 + 7_000);
    expect(telegram.sent[0]!.text).toContain('(обновлён)');
    expect(await db.select().from(payrollStatements)).toHaveLength(1);
  });

  it('is saved even if no admin can be reached', async () => {
    await fillWeek();
    telegram.down = true;
    const { body } = await api<PayrollSendResultDto>(ivan, 'POST', '/api/payroll', { weekStart: '2026-10-19' });
    expect(body.notifiedAdmins).toBe(0);
    expect((await api<PayrollStatementDto[]>(ivan, 'GET', '/api/payroll')).body).toHaveLength(1);
  });

  it('rejects weeks that do not start on Monday, are in the future or are empty', async () => {
    await fillWeek();
    expect((await api(ivan, 'POST', '/api/payroll', { weekStart: '2026-10-20' })).status).toBe(400);
    const future = addDays(weekRange(today()).from, 14);
    expect((await api(ivan, 'POST', '/api/payroll', { weekStart: future })).status).toBe(400);
    expect((await api(ivan, 'POST', '/api/payroll', { weekStart: '2026-10-05' })).status).toBe(400);
  });
});

describe('payroll for admins', () => {
  it('lists people with their latest statement and shows the latest N weeks', async () => {
    for (const weekStart of ['2026-09-28', '2026-10-05', '2026-10-12']) {
      await sendReport(ivan, { workDate: weekStart });
      await api(ivan, 'POST', '/api/payroll', { weekStart });
    }

    const people = await api<PayrollUserDto[]>(admin, 'GET', '/api/admin/payroll');
    expect(people.body[0]).toMatchObject({ user: { name: 'Иван Петров' }, last: { weekStart: '2026-10-12', total: 12_000 } });
    expect(people.body.find((p) => p.user.id === sergey.id)?.last).toBeNull();

    const latestTwo = await api<PayrollStatementDto[]>(admin, 'GET', `/api/admin/payroll/${ivan.id}?limit=2`);
    expect(latestTwo.body.map((s) => s.weekStart)).toEqual(['2026-10-12', '2026-10-05']);
    const byDefault = await api<PayrollStatementDto[]>(admin, 'GET', `/api/admin/payroll/${ivan.id}`);
    expect(byDefault.body).toHaveLength(3);

    expect((await api(ivan, 'GET', '/api/admin/payroll')).status).toBe(403);
    expect((await api(admin, 'GET', `/api/admin/payroll/${ivan.id}?limit=0`)).status).toBe(400);
  });
});
