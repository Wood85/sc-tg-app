# SC Telegram App

Telegram Mini App для отчётов монтажников. Проектные решения — в [docs/design.md](docs/design.md).

```
apps/api         Fastify + grammY + Drizzle (Node 24 запускает .ts напрямую, без сборки)
apps/web         Vite + React + Redux Toolkit / RTK Query
packages/shared  zod-схемы, типы DTO, расчёт денег — общие для фронта и бэка
```

## Первый запуск

```bash
nvm use                       # Node 24
cp .env.example .env          # заполнить BOT_TOKEN, ADMIN_TELEGRAM_IDS, DEV_TELEGRAM_ID
pnpm install
pnpm db:up                    # Postgres в Docker
pnpm db:migrate
pnpm db:seed                  # админы + справочники из apps/api/seed/*.csv
pnpm dev                      # API на :3000, фронт на :5173
```

Свой Telegram ID можно узнать, написав боту `/start`.

## Разработка фронта

- **В обычном браузере** (`http://localhost:5173`): запросы идут без initData, и API в dev-режиме
  выполняет их от имени `DEV_TELEGRAM_ID`.
- **Внутри Telegram**: нужен HTTPS.
  1. `cloudflared tunnel --url http://localhost:5173` — выдаст адрес `https://….trycloudflare.com`.
  2. Записать его в `WEBAPP_URL` в `.env` и перезапустить `pnpm dev`. Бот сам выставит кнопку меню «Отчёт».

Адрес туннеля меняется при каждом запуске; постоянный можно получить именованным туннелем Cloudflare.

## Авторизация

Фронт отправляет `Authorization: tma <initData>`, бэкенд проверяет подпись токеном бота
(`apps/api/src/auth.ts`) и пускает только активных пользователей из таблицы `users`.

## База данных

- Схема: `apps/api/src/db/schema.ts`. После изменения: `pnpm db:generate` → `pnpm db:migrate`.
- Просмотр данных: `pnpm db:studio`.
- Справочники: скопировать `apps/api/seed/*.example.csv` в `price_items.csv` / `materials.csv`,
  заполнить (можно в Excel, сохранить как CSV) и выполнить `pnpm db:seed` — повторный запуск обновляет записи.

## Проверки

```bash
pnpm typecheck
pnpm test
```
