import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { Bot, InlineKeyboard } from 'grammy';
import { db } from './db/index.ts';
import { users } from './db/schema.ts';
import { env } from './env.ts';

export const bot = new Bot(env.BOT_TOKEN);

bot.chatType('private').command('start', async (ctx) => {
  const user = await db.query.users.findFirst({ where: eq(users.telegramId, ctx.from.id) });
  if (!user?.isActive) {
    return ctx.reply(
      `Вы ещё не добавлены в систему. Передайте администратору ваш ID: <code>${ctx.from.id}</code>`,
      { parse_mode: 'HTML' },
    );
  }
  if (!env.WEBAPP_URL) return ctx.reply('Приложение ещё не настроено: не задан WEBAPP_URL.');
  return ctx.reply(`Здравствуйте, ${user.name}!`, {
    reply_markup: new InlineKeyboard().webApp('Открыть приложение', env.WEBAPP_URL),
  });
});

// Помогает узнать GROUP_CHAT_ID: добавить бота в группу и написать /chatid.
bot.command('chatid', (ctx) =>
  ctx.reply(`ID этого чата: <code>${ctx.chat.id}</code>`, { parse_mode: 'HTML' }),
);

export async function startBot(log: FastifyBaseLogger) {
  if (env.WEBAPP_URL) {
    await bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'Отчёт', web_app: { url: env.WEBAPP_URL } },
    });
  }
  // Long polling: подходит и для разработки, и для одного сервера в продакшене.
  bot
    .start({ onStart: (info) => log.info(`Bot @${info.username} started`) })
    .catch((err) => log.error(err, 'Bot stopped'));
}
