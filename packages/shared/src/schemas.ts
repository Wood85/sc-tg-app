import { z } from 'zod';

export const categories = ['conditioning', 'ventilation'] as const;
export const categorySchema = z.enum(categories);
export type Category = z.infer<typeof categorySchema>;

export const categoryLabels: Record<Category, string> = {
  conditioning: 'Кондиционирование',
  ventilation: 'Вентиляция',
};

export const roles = ['installer', 'admin'] as const;
export type Role = (typeof roles)[number];

// Положительное число, не больше двух знаков после запятой.
export const qtySchema = z
  .number()
  .positive()
  .max(100_000)
  .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, 'Не больше двух знаков после запятой');

export const isoDateSchema = z.iso.date();

// Черновик может быть неполным; обязательность адреса и строк проверяется при отправке.
export const reportDraftSchema = z.object({
  address: z.string().trim().max(200).default(''),
  location: z.string().trim().max(200).default(''),
  workDate: isoDateSchema,
  // Остальные участники бригады, автор добавляется на бэкенде автоматически.
  participantIds: z.array(z.number().int().positive()).max(20).default([]),
  works: z
    .array(z.object({ priceItemId: z.number().int().positive(), qty: qtySchema }))
    .default([]),
  materials: z
    .array(z.object({ materialId: z.number().int().positive(), qty: qtySchema }))
    .default([]),
  comment: z.string().trim().max(1000).default(''),
});
export type ReportDraftInput = z.input<typeof reportDraftSchema>;
export type ReportDraft = z.output<typeof reportDraftSchema>;

export const earningsQuerySchema = z.object({ from: isoDateSchema, to: isoDateSchema });

export interface MeDto {
  id: number;
  telegramId: number;
  name: string;
  role: Role;
}

export interface PriceItemDto {
  id: number;
  category: Category;
  name: string;
  unit: string;
  price: number;
}

export interface MaterialDto {
  id: number;
  category: Category;
  name: string;
  unit: string;
}

export interface CatalogDto {
  priceItems: PriceItemDto[];
  materials: MaterialDto[];
}

export interface UserBriefDto {
  id: number;
  name: string;
}

// sending — отчёт захвачен для отправки в группу; защищает от двойной отправки.
export const reportStatuses = ['draft', 'sending', 'sent'] as const;
export type ReportStatus = (typeof reportStatuses)[number];

export interface ReportListItemDto {
  id: number;
  status: ReportStatus;
  address: string;
  location: string;
  workDate: string;
  totalAmount: number;
  // Доля текущего пользователя (для черновика — предварительная).
  myAmount: number;
}

export interface ReportDto {
  id: number;
  status: ReportStatus;
  address: string;
  location: string;
  workDate: string;
  comment: string;
  totalAmount: number;
  author: UserBriefDto;
  participants: (UserBriefDto & { amount: number })[];
  works: {
    priceItemId: number;
    category: Category;
    name: string;
    unit: string;
    qty: number;
    unitPrice: number;
    amount: number;
  }[];
  materials: {
    materialId: number;
    category: Category;
    name: string;
    unit: string;
    qty: number;
  }[];
  sentAt: string | null;
}

export interface EarningsDto {
  days: { date: string; amount: number; reports: number }[];
  total: number;
}
