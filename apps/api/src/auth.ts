import { parse, validate } from '@tma.js/init-data-node';
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from './db/index.ts';
import { type User, users } from './db/schema.ts';
import { env } from './env.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
}

// Mini App открыт может быть долго, поэтому initData принимаем в течение суток.
const INIT_DATA_TTL_SECONDS = 24 * 60 * 60;

// Проверяет подпись initData токеном бота и возвращает Telegram ID пользователя.
export function telegramIdFromInitData(raw: string, botToken: string): number | undefined {
  try {
    validate(raw, botToken, { expiresIn: INIT_DATA_TTL_SECONDS });
    return parse(raw).user?.id;
  } catch {
    return undefined;
  }
}

// Фронт передаёт заголовок `Authorization: tma <initData>`.
// В разработке без заголовка запрос выполняется от имени DEV_TELEGRAM_ID.
export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const [scheme, initData] = (req.headers.authorization ?? '').split(' ');
  let telegramId: number | undefined;
  if (scheme === 'tma' && initData) {
    telegramId = telegramIdFromInitData(initData, env.BOT_TOKEN);
  } else if (env.NODE_ENV !== 'production') {
    telegramId = env.DEV_TELEGRAM_ID;
  }
  if (!telegramId) return reply.code(401).send({ error: 'unauthorized' });

  const user = await db.query.users.findFirst({ where: eq(users.telegramId, telegramId) });
  if (!user?.isActive) return reply.code(403).send({ error: 'not_registered', telegramId });
  req.user = user;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (req.user.role !== 'admin') return reply.code(403).send({ error: 'forbidden' });
}
