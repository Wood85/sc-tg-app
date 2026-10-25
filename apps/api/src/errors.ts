import { z } from 'zod';

// Fastify отдаёт statusCode брошенной ошибки как HTTP-статус, а message — в теле ответа.
export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, z.prettifyError(result.error));
  return result.data;
}

// Код ошибки Postgres. Drizzle оборачивает ошибку драйвера в cause.
function pgErrorCode(err: unknown): unknown {
  const codeOf = (e: unknown) => (e && typeof e === 'object' && 'code' in e ? e.code : undefined);
  return codeOf(err) ?? (err instanceof Error ? codeOf(err.cause) : undefined);
}

export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23505';
}

// На запись ссылаются другие таблицы (например, позиция прайса — из отчётов).
export function isForeignKeyViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23503';
}
