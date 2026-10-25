import type { PayrollDay } from '@sc/shared';
import { and, asc, between, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { dailyWages, priceItems, reportParticipants, reports, reportWorks } from '../db/schema.ts';

// Заработок человека по дням за период: отправленные отчёты, где он участник, его доля и оклад.
export async function buildPayrollDays(userId: number, from: string, to: string): Promise<PayrollDay[]> {
  const rows = await db
    .select({
      reportId: reports.id,
      date: reports.workDate,
      address: reports.address,
      location: reports.location,
      amount: reportParticipants.amount,
    })
    .from(reportParticipants)
    .innerJoin(reports, eq(reports.id, reportParticipants.reportId))
    .where(and(eq(reportParticipants.userId, userId), eq(reports.status, 'sent'), between(reports.workDate, from, to)))
    .orderBy(asc(reports.workDate), asc(reports.sentAt), asc(reports.id));

  const works =
    rows.length > 0
      ? await db
          .select({ reportId: reportWorks.reportId, name: priceItems.name, qty: reportWorks.qty, unit: priceItems.unit })
          .from(reportWorks)
          .innerJoin(priceItems, eq(priceItems.id, reportWorks.priceItemId))
          .where(
            inArray(
              reportWorks.reportId,
              rows.map((r) => r.reportId),
            ),
          )
          .orderBy(asc(reportWorks.id))
      : [];
  const wages = await db
    .select({ date: dailyWages.workDate, amount: dailyWages.amount })
    .from(dailyWages)
    .where(and(eq(dailyWages.userId, userId), between(dailyWages.workDate, from, to)));
  const wageByDate = new Map(wages.map((w) => [w.date, w.amount]));

  const days = new Map<string, PayrollDay>();
  for (const row of rows) {
    const day = days.get(row.date) ?? { date: row.date, reports: [], wage: wageByDate.get(row.date) ?? 0, total: 0 };
    day.reports.push({
      reportId: row.reportId,
      address: row.address,
      location: row.location,
      works: works.filter((w) => w.reportId === row.reportId).map(({ name, qty, unit }) => ({ name, qty, unit })),
      amount: row.amount,
    });
    days.set(row.date, day);
  }
  for (const day of days.values()) {
    day.total = day.wage + day.reports.reduce((sum, r) => sum + r.amount, 0);
  }
  return [...days.values()];
}
