// Объект появляется из telegram-web-app.js (подключён в index.html).
// Вне Telegram он тоже есть, но initData пустая — тогда бэкенд в dev-режиме подставит DEV_TELEGRAM_ID.
export const tg = window.Telegram.WebApp;
