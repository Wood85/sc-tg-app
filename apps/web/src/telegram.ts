import { useEffect, useRef } from 'react';

// Объект появляется из telegram-web-app.js (подключён в index.html).
// Вне Telegram он тоже есть, но initData пустая — тогда бэкенд в dev-режиме подставит DEV_TELEGRAM_ID.
export const tg = window.Telegram.WebApp;

// В обычном браузере platform === 'unknown', и нативных кнопок Telegram нет.
export const isInsideTelegram = tg.platform !== 'unknown';

interface MainButtonOptions {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

// Нативная кнопка внизу экрана Telegram. Вне Telegram ничего не делает —
// компонент сам показывает обычную кнопку (см. isInsideTelegram).
export function useMainButton({ text, onClick, disabled = false, loading = false }: MainButtonOptions) {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    if (!isInsideTelegram) return;
    const handler = () => onClickRef.current();
    tg.MainButton.onClick(handler);
    return () => {
      tg.MainButton.offClick(handler);
      tg.MainButton.hide();
    };
  }, []);

  useEffect(() => {
    if (!isInsideTelegram) return;
    tg.MainButton.setParams({ text, is_visible: true, is_active: !disabled && !loading });
    if (loading) tg.MainButton.showProgress(false);
    else tg.MainButton.hideProgress();
  }, [text, disabled, loading]);
}

export function haptic(type: 'success' | 'error') {
  if (isInsideTelegram) tg.HapticFeedback.notificationOccurred(type);
}
