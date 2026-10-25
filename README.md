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

## API

Все запросы — с заголовком `Authorization: tma <initData>`. Типы ответов — в `packages/shared/src/schemas.ts`.
Деньги — целые тетри (1 ₾ = 100), количество — число с двумя знаками после запятой.

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/me` | Текущий пользователь (`MeDto`) |
| GET | `/api/me/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD` | Заработок по дням, только отправленные отчёты (`EarningsDto`) |
| GET | `/api/catalog` | Активные работы с ценами и материалы (`CatalogDto`) |
| GET | `/api/users` | Активные пользователи для выбора участников бригады |
| GET | `/api/reports` | Отчёты, где я автор или участник (`ReportListItemDto[]`) |
| POST | `/api/reports` | Создать черновик (`ReportDraftInput`) → `ReportDto` |
| GET | `/api/reports/:id` | Отчёт целиком (`ReportDto`) |
| PUT | `/api/reports/:id` | Перезаписать черновик целиком (только автор) |
| DELETE | `/api/reports/:id` | Удалить черновик (только автор) |
| POST | `/api/reports/:id/send` | Зафиксировать цены и доли, опубликовать в группу |

Как устроены отчёты:
- Автор автоматически становится участником; в `participantIds` передаются только остальные члены бригады.
- Сумма пересчитывается при каждом сохранении черновика (предварительная) и окончательно — при отправке по текущему прайсу. После отправки отчёт не меняется.
- Повторная отправка уже отправленного отчёта возвращает его без повторной публикации; параллельная — `409`.
- Если Telegram не принял сообщение — `502`, отчёт остаётся черновиком.
- Ошибки: `400` (валидация, текст в `message`), `403` (не автор), `404`, `409` (отчёт уже отправлен).

## База данных

- Схема: `apps/api/src/db/schema.ts`. После изменения: `pnpm db:generate` → `pnpm db:migrate`.
- Просмотр данных: `pnpm db:studio`.
- Справочники: скопировать `apps/api/seed/*.example.csv` в `price_items.csv` / `materials.csv`,
  заполнить (можно в Excel, сохранить как CSV) и выполнить `pnpm db:seed` — повторный запуск обновляет записи.

## Проверки

```bash
pnpm typecheck
pnpm test        # нужен запущенный Postgres (pnpm db:up): тесты API создают базу sc_test
```
