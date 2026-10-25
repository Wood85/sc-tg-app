import {
  type EarningsDto,
  lineAmount,
  type ReportDraft,
  reportTotal,
  type ReportDto,
  type ReportListItemDto,
  splitEqually,
  unitPriceFor,
} from '@sc/shared';
import { and, asc, between, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { GrammyError } from 'grammy';
import { db } from '../db/index.ts';
import {
  materials,
  priceItems,
  reportMaterials,
  reportParticipants,
  reportPhotos,
  reports,
  reportWorks,
  users,
} from '../db/schema.ts';
import { env } from '../env.ts';
import { HttpError } from '../errors.ts';
import { formatGroupMessage } from './format.ts';
import { publishToGroup } from './publish.ts';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Перезаписывает содержимое отчёта целиком: цены берутся из текущего прайса
// (ступенчатые — по количеству в строке), к сумме применяется коэффициент за высоту,
// и она делится поровну между автором и участниками (остаток — автору).
async function writeContent(tx: Tx, reportId: number, authorId: number, input: ReportDraft) {
  const participantIds = [authorId, ...new Set(input.participantIds.filter((id) => id !== authorId))];
  const activeUsers = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, participantIds), eq(users.isActive, true)));
  if (activeUsers.length !== participantIds.length) throw new HttpError(400, 'Unknown participant');

  const priceIds = [...new Set(input.works.map((w) => w.priceItemId))];
  const prices =
    priceIds.length > 0
      ? await tx
          .select({ id: priceItems.id, price: priceItems.price, tiers: priceItems.tiers })
          .from(priceItems)
          .where(and(inArray(priceItems.id, priceIds), eq(priceItems.isActive, true)))
      : [];
  const priceItemById = new Map(prices.map((p) => [p.id, p]));
  const works = input.works.map((w) => {
    const item = priceItemById.get(w.priceItemId);
    if (!item) throw new HttpError(400, `Unknown price item ${w.priceItemId}`);
    const unitPrice = unitPriceFor(item, w.qty);
    return { reportId, priceItemId: w.priceItemId, qty: w.qty, unitPriceSnapshot: unitPrice, amount: lineAmount(w.qty, unitPrice) };
  });

  const materialIds = [...new Set(input.materials.map((m) => m.materialId))];
  const activeMaterials =
    materialIds.length > 0
      ? await tx
          .select({ id: materials.id })
          .from(materials)
          .where(and(inArray(materials.id, materialIds), eq(materials.isActive, true)))
      : [];
  if (activeMaterials.length !== materialIds.length) throw new HttpError(400, 'Unknown material');

  // Фото: только свои и ещё не прикреплённые к другому отчёту.
  if (input.photoIds.length > 0) {
    const photos = await tx
      .select({ uploaderId: reportPhotos.uploaderId, reportId: reportPhotos.reportId })
      .from(reportPhotos)
      .where(inArray(reportPhotos.id, input.photoIds));
    const usable = photos.filter((p) => p.uploaderId === authorId && (p.reportId === null || p.reportId === reportId));
    if (usable.length !== input.photoIds.length) throw new HttpError(400, 'Unknown photo');
  }

  const total = reportTotal(
    works.map((w) => w.amount),
    input.atHeight,
  );
  const shares = splitEqually(total, participantIds.length);

  await tx.delete(reportParticipants).where(eq(reportParticipants.reportId, reportId));
  await tx.delete(reportWorks).where(eq(reportWorks.reportId, reportId));
  await tx.delete(reportMaterials).where(eq(reportMaterials.reportId, reportId));

  await tx
    .insert(reportParticipants)
    .values(participantIds.map((userId, i) => ({ reportId, userId, amount: shares[i] ?? 0 })));
  if (works.length > 0) await tx.insert(reportWorks).values(works);
  if (input.materials.length > 0) {
    await tx
      .insert(reportMaterials)
      .values(input.materials.map((m) => ({ reportId, materialId: m.materialId, qty: m.qty })));
  }

  // Убранные из отчёта фото отвязываем — их удалит очистка.
  await tx
    .update(reportPhotos)
    .set({ reportId: null })
    .where(
      and(
        eq(reportPhotos.reportId, reportId),
        input.photoIds.length > 0 ? notInArray(reportPhotos.id, input.photoIds) : undefined,
      ),
    );
  for (const [sortOrder, photoId] of input.photoIds.entries()) {
    await tx.update(reportPhotos).set({ reportId, sortOrder }).where(eq(reportPhotos.id, photoId));
  }

  await tx
    .update(reports)
    .set({
      address: input.address,
      location: input.location,
      workDate: input.workDate,
      comment: input.comment,
      atHeight: input.atHeight,
      totalAmount: total,
    })
    .where(eq(reports.id, reportId));
}

// Блокирует черновик автора до конца транзакции.
async function lockDraft(tx: Tx, userId: number, reportId: number) {
  const [report] = await tx.select().from(reports).where(eq(reports.id, reportId)).for('update');
  if (!report) throw new HttpError(404, 'Report not found');
  if (report.authorId !== userId) throw new HttpError(403, 'Only the author can change the report');
  if (report.status !== 'draft') throw new HttpError(409, 'Report has already been sent');
  return report;
}

export async function createReport(authorId: number, input: ReportDraft): Promise<number> {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .insert(reports)
      .values({ authorId, address: input.address, workDate: input.workDate })
      .returning({ id: reports.id });
    if (!report) throw new Error('Failed to create report');
    await writeContent(tx, report.id, authorId, input);
    return report.id;
  });
}

export async function updateReport(userId: number, reportId: number, input: ReportDraft) {
  await db.transaction(async (tx) => {
    await lockDraft(tx, userId, reportId);
    await writeContent(tx, reportId, userId, input);
  });
}

export async function deleteReport(userId: number, reportId: number) {
  await db.transaction(async (tx) => {
    await lockDraft(tx, userId, reportId);
    await tx.delete(reports).where(eq(reports.id, reportId));
  });
}

// Отчёт видят автор и участники (автор тоже записан участником).
export async function getReport(userId: number, reportId: number): Promise<ReportDto> {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
  const participants = report
    ? await db
        .select({ id: users.id, name: users.name, amount: reportParticipants.amount })
        .from(reportParticipants)
        .innerJoin(users, eq(users.id, reportParticipants.userId))
        .where(eq(reportParticipants.reportId, reportId))
        .orderBy(desc(sql`${reportParticipants.userId} = ${report.authorId}`), asc(users.name))
    : [];
  if (!report || !participants.some((p) => p.id === userId)) throw new HttpError(404, 'Report not found');

  const [works, mats, photos] = await Promise.all([
    db
      .select({
        priceItemId: reportWorks.priceItemId,
        category: priceItems.category,
        name: priceItems.name,
        unit: priceItems.unit,
        qty: reportWorks.qty,
        unitPrice: reportWorks.unitPriceSnapshot,
        amount: reportWorks.amount,
      })
      .from(reportWorks)
      .innerJoin(priceItems, eq(priceItems.id, reportWorks.priceItemId))
      .where(eq(reportWorks.reportId, reportId))
      .orderBy(asc(reportWorks.id)),
    db
      .select({
        materialId: reportMaterials.materialId,
        category: materials.category,
        name: materials.name,
        unit: materials.unit,
        qty: reportMaterials.qty,
      })
      .from(reportMaterials)
      .innerJoin(materials, eq(materials.id, reportMaterials.materialId))
      .where(eq(reportMaterials.reportId, reportId))
      .orderBy(asc(reportMaterials.id)),
    db
      .select({ id: reportPhotos.id })
      .from(reportPhotos)
      .where(eq(reportPhotos.reportId, reportId))
      .orderBy(asc(reportPhotos.sortOrder)),
  ]);

  const author = participants.find((p) => p.id === report.authorId);
  return {
    id: report.id,
    status: report.status,
    address: report.address,
    location: report.location,
    workDate: report.workDate,
    comment: report.comment,
    atHeight: report.atHeight,
    totalAmount: report.totalAmount,
    author: { id: report.authorId, name: author?.name ?? '' },
    participants,
    works,
    materials: mats,
    photos,
    sentAt: report.sentAt?.toISOString() ?? null,
  };
}

export async function listReports(userId: number): Promise<ReportListItemDto[]> {
  return db
    .select({
      id: reports.id,
      status: reports.status,
      address: reports.address,
      location: reports.location,
      workDate: reports.workDate,
      totalAmount: reports.totalAmount,
      myAmount: reportParticipants.amount,
    })
    .from(reportParticipants)
    .innerJoin(reports, eq(reports.id, reportParticipants.reportId))
    .where(eq(reportParticipants.userId, userId))
    .orderBy(desc(reports.workDate), desc(reports.id))
    .limit(200);
}

export async function sendReport(userId: number, reportId: number): Promise<ReportDto> {
  const groupChatId = env.GROUP_CHAT_ID;
  if (groupChatId === undefined) throw new HttpError(503, 'GROUP_CHAT_ID is not configured');

  const draft = await getReport(userId, reportId);
  if (draft.author.id !== userId) throw new HttpError(403, 'Only the author can send the report');
  // Повторная отправка уже отправленного отчёта — не ошибка: клиент мог не получить ответ.
  if (draft.status === 'sent') return draft;
  if (!draft.address) throw new HttpError(400, 'Address is required');
  if (draft.works.length === 0 && draft.materials.length === 0) throw new HttpError(400, 'Report is empty');

  // Атомарно захватываем черновик: второй параллельный запрос получит 409.
  const [claimed] = await db
    .update(reports)
    .set({ status: 'sending' })
    .where(and(eq(reports.id, reportId), eq(reports.status, 'draft')))
    .returning({ id: reports.id });
  if (!claimed) throw new HttpError(409, 'Report is already being sent');

  try {
    // Фиксируем цены и доли на момент отправки.
    await db.transaction((tx) =>
      writeContent(tx, reportId, userId, {
        address: draft.address,
        location: draft.location,
        workDate: draft.workDate,
        comment: draft.comment,
        atHeight: draft.atHeight,
        participantIds: draft.participants.map((p) => p.id),
        works: draft.works.map((w) => ({ priceItemId: w.priceItemId, qty: w.qty })),
        materials: draft.materials.map((m) => ({ materialId: m.materialId, qty: m.qty })),
        photoIds: draft.photos.map((p) => p.id),
      }),
    );
    const report = await getReport(userId, reportId);
    const text = formatGroupMessage({ ...report, participants: report.participants.map((p) => p.name) });

    const photos = await db
      .select({ id: reportPhotos.id, storageKey: reportPhotos.storageKey })
      .from(reportPhotos)
      .where(eq(reportPhotos.reportId, reportId))
      .orderBy(asc(reportPhotos.sortOrder));
    const { messageIds, photoFileIds } = await publishToGroup(
      groupChatId,
      text,
      photos.map((p) => p.storageKey),
    );

    await db.transaction(async (tx) => {
      for (const [i, photo] of photos.entries()) {
        await tx.update(reportPhotos).set({ tgFileId: photoFileIds[i] ?? null }).where(eq(reportPhotos.id, photo.id));
      }
      await tx
        .update(reports)
        .set({ status: 'sent', sentAt: new Date(), tgMessageIds: messageIds })
        .where(eq(reports.id, reportId));
    });
  } catch (err) {
    // Возвращаем в черновик, чтобы автор мог исправить и отправить снова.
    await db.update(reports).set({ status: 'draft' }).where(eq(reports.id, reportId));
    if (err instanceof GrammyError) throw new HttpError(502, `Telegram: ${err.description}`);
    throw err;
  }

  return getReport(userId, reportId);
}

export async function getEarnings(userId: number, from: string, to: string): Promise<EarningsDto> {
  if (from > to) throw new HttpError(400, '"from" must not be after "to"');
  const days = await db
    .select({
      date: reports.workDate,
      amount: sql<number>`sum(${reportParticipants.amount})`.mapWith(Number),
      reports: count(),
    })
    .from(reportParticipants)
    .innerJoin(reports, eq(reports.id, reportParticipants.reportId))
    .where(
      and(
        eq(reportParticipants.userId, userId),
        eq(reports.status, 'sent'),
        between(reports.workDate, from, to),
      ),
    )
    .groupBy(reports.workDate)
    .orderBy(asc(reports.workDate));
  return { days, total: days.reduce((sum, d) => sum + d.amount, 0) };
}
