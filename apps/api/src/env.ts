import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Пустая строка в .env означает «не задано».
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  DATABASE_URL: z.url(),
  WEBAPP_URL: optional(z.url()),
  GROUP_CHAT_ID: optional(z.coerce.number().int()),
  ADMIN_TELEGRAM_IDS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean).map(Number))
    .pipe(z.array(z.number().int().positive())),
  DEV_TELEGRAM_ID: optional(z.coerce.number().int().positive()),
  PORT: z.coerce.number().int().default(3000),
  // Папка для фото отчётов; по умолчанию data/photos в корне репозитория.
  PHOTOS_DIR: optional(z.string()).transform(
    (dir) => dir ?? fileURLToPath(new URL('../../../data/photos', import.meta.url)),
  ),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
