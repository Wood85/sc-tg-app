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

// Нарушение уникального индекса Postgres. Drizzle оборачивает ошибку драйвера в cause.
export function isUniqueViolation(err: unknown): boolean {
  const codeOf = (e: unknown) => (e && typeof e === 'object' && 'code' in e ? e.code : undefined);
  return codeOf(err) === '23505' || (err instanceof Error && codeOf(err.cause) === '23505');
}
