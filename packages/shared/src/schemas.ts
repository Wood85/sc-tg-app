import { z } from 'zod';
import type { PriceTier } from './money.ts';

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
  // Работы на высоте выше 4,5 м: вся сумма × 1,2.
  atHeight: z.boolean().default(false),
});
export type ReportDraftInput = z.input<typeof reportDraftSchema>;
export type ReportDraft = z.output<typeof reportDraftSchema>;

const nameSchema = z.string().trim().min(1).max(200);
const unitSchema = z.string().trim().min(1).max(20);

export const materialInputSchema = z.object({
  category: categorySchema,
  name: nameSchema,
  unit: unitSchema,
  isActive: z.boolean().default(true),
});
export type MaterialInput = z.input<typeof materialInputSchema>;

const priceSchema = z.number().int().min(0).max(100_000_000);

// Ступени по возрастанию границы, у последней граница null («и больше»).
export const priceTiersSchema = z
  .array(z.object({ upTo: z.number().positive().nullable(), price: priceSchema }))
  .min(2)
  .max(20)
  .refine((tiers) => tiers.at(-1)?.upTo === null, 'У последней ступени не должно быть верхней границы')
  .refine(
    (tiers) =>
      tiers.slice(0, -1).every((t, i, arr) => t.upTo !== null && (i === 0 || t.upTo > (arr[i - 1]!.upTo ?? Infinity))),
    'Границы ступеней должны возрастать',
  );

// Для ступенчатой позиции price — цена первой (самой дорогой) ступени.
export const priceItemInputSchema = materialInputSchema
  .extend({
    price: priceSchema,
    tiers: priceTiersSchema.nullable().default(null),
  })
  .transform((item) => (item.tiers ? { ...item, price: item.tiers[0]!.price } : item));
export type PriceItemInput = z.input<typeof priceItemInputSchema>;

export const userInputSchema = z.object({
  telegramId: z.number().int().positive(),
  name: nameSchema,
  role: z.enum(roles).default('installer'),
  isActive: z.boolean().default(true),
});
export type UserInput = z.input<typeof userInputSchema>;

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
  tiers: PriceTier[] | null;
}

export interface AdminPriceItemDto extends PriceItemDto {
  isActive: boolean;
}

export interface MaterialDto {
  id: number;
  category: Category;
  name: string;
  unit: string;
}

export interface AdminMaterialDto extends MaterialDto {
  isActive: boolean;
}

export interface CatalogDto {
  priceItems: PriceItemDto[];
  materials: MaterialDto[];
}

export interface UserBriefDto {
  id: number;
  name: string;
}

export interface AdminUserDto {
  id: number;
  telegramId: number;
  name: string;
  role: Role;
  isActive: boolean;
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
  atHeight: boolean;
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
