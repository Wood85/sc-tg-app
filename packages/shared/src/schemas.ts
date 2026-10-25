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

export const reportDraftSchema = z.object({
  address: z.string().trim().min(1).max(200),
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

export interface MeDto {
  id: number;
  telegramId: number;
  name: string;
  role: Role;
}
