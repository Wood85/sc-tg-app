import {
  addDays,
  type PayrollSendResultDto,
  type PayrollStatementDto,
  type PayrollUserDto,
  today,
} from '@sc/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import { bot } from '../bot.ts';
import { db } from '../db/index.ts';
import { payrollStatements, users } from '../db/schema.ts';
import { HttpError } from '../errors.ts';
import { splitMessage } from '../reports/format.ts';
import { buildPayrollDays } from './build.ts';
import { formatPayrollMessage } from './format.ts';

type StatementRow = typeof payrollStatements.$inferSelect;

function toDto(row: StatementRow, user: { id: number; name: string }): PayrollStatementDto {
  return {
    id: row.id,
    user: { id: user.id, name: user.name },
    weekStart: row.weekStart,
    weekEnd: addDays(row.weekStart, 6),
    total: row.total,
    days: row.days,
    sentAt: row.sentAt.toISOString(),
  };
}

// Сообщение каждому активному админу; возвращает, скольким доставлено.
// Не доставится тем, кто ни разу не писал боту, — отчёт всё равно виден в приложении.
async function notifyAdmins(text: string): Promise<number> {
  const admins = await db
    .select({ telegramId: users.telegramId })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
  let delivered = 0;
  for (const admin of admins) {
    try {
      for (const chunk of splitMessage(text)) {
        await bot.api.sendMessage(admin.telegramId, chunk, { parse_mode: 'HTML' });
      }
      delivered++;
    } catch {
      // Админ не запускал бота или заблокировал его — пропускаем.
    }
  }
  return delivered;
}

export async function sendPayroll(user: { id: number; name: string }, weekStart: string): Promise<PayrollSendResultDto> {
  // Запас в день — на разницу часовых поясов между сервером и монтажником.
  if (weekStart > addDays(today(), 1)) throw new HttpError(400, 'Эта неделя ещё не началась');
  const weekEnd = addDays(weekStart, 6);
  const days = await buildPayrollDays(user.id, weekStart, weekEnd);
  if (days.length === 0) throw new HttpError(400, 'За эту неделю нет отправленных отчётов');
  const total = days.reduce((sum, d) => sum + d.total, 0);

  const [existing] = await db
    .select({ id: payrollStatements.id })
    .from(payrollStatements)
    .where(and(eq(payrollStatements.userId, user.id), eq(payrollStatements.weekStart, weekStart)));
  const [row] = await db
    .insert(payrollStatements)
    .values({ userId: user.id, weekStart, total, days, sentAt: new Date() })
    .onConflictDoUpdate({
      target: [payrollStatements.userId, payrollStatements.weekStart],
      set: { total, days, sentAt: sql`now()` },
    })
    .returning();

  const statement = toDto(row!, user);
  const notifiedAdmins = await notifyAdmins(formatPayrollMessage(statement, { updated: Boolean(existing) }));
  return { statement, notifiedAdmins };
}

export async function listStatements(userId: number, limit: number): Promise<PayrollStatementDto[]> {
  const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, userId));
  if (!user) throw new HttpError(404, 'Пользователь не найден');
  const rows = await db
    .select()
    .from(payrollStatements)
    .where(eq(payrollStatements.userId, userId))
    .orderBy(desc(payrollStatements.weekStart))
    .limit(limit);
  return rows.map((row) => toDto(row, user));
}

// Все активные пользователи с последним отправленным отчётом; сначала те, кто отправлял недавно.
export async function listPayrollUsers(): Promise<PayrollUserDto[]> {
  const people = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.isActive, true));
  const latest = await db
    .selectDistinctOn([payrollStatements.userId])
    .from(payrollStatements)
    .orderBy(payrollStatements.userId, desc(payrollStatements.weekStart));
  const latestByUser = new Map(latest.map((row) => [row.userId, row]));

  return people
    .map((user): PayrollUserDto => {
      const last = latestByUser.get(user.id);
      return {
        user,
        last: last
          ? { weekStart: last.weekStart, weekEnd: addDays(last.weekStart, 6), total: last.total, sentAt: last.sentAt.toISOString() }
          : null,
      };
    })
    .sort((a, b) => (b.last?.sentAt ?? '').localeCompare(a.last?.sentAt ?? '') || a.user.name.localeCompare(b.user.name));
}
