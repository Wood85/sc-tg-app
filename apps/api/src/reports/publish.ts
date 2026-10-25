import { InputFile } from 'grammy';
import type { InputMediaPhoto } from 'grammy/types';
import { bot } from '../bot.ts';
import { photoPath } from '../photos/storage.ts';
import { splitMessage } from './format.ts';

// Лимит подписи к фото в Telegram.
export const TELEGRAM_CAPTION_LIMIT = 1024;

interface PublishResult {
  messageIds: number[];
  // file_id каждого фото в том же порядке — по нему фото можно переслать без повторной загрузки.
  photoFileIds: (string | null)[];
}

// Публикует отчёт в группе: фото альбомом с текстом в подписи, либо текст отдельно,
// если он длиннее подписи или фото нет.
export async function publishToGroup(chatId: number, text: string, storageKeys: string[]): Promise<PublishResult> {
  const messageIds: number[] = [];
  const photoFileIds: (string | null)[] = [];
  const captionFits = text.length <= TELEGRAM_CAPTION_LIMIT;
  const caption = captionFits ? { caption: text, parse_mode: 'HTML' as const } : {};

  if (storageKeys.length === 1) {
    const message = await bot.api.sendPhoto(chatId, new InputFile(photoPath(storageKeys[0]!)), caption);
    messageIds.push(message.message_id);
    photoFileIds.push(message.photo.at(-1)?.file_id ?? null);
  } else if (storageKeys.length > 1) {
    // Альбом — от 2 до 10 фото; подпись первого фото показывается под всем альбомом.
    const media: InputMediaPhoto[] = storageKeys.map((key, i) => ({
      type: 'photo',
      media: new InputFile(photoPath(key)),
      ...(i === 0 ? caption : {}),
    }));
    const messages = await bot.api.sendMediaGroup(chatId, media);
    for (const message of messages) {
      messageIds.push(message.message_id);
      photoFileIds.push('photo' in message ? (message.photo.at(-1)?.file_id ?? null) : null);
    }
  }

  if (storageKeys.length === 0 || !captionFits) {
    for (const chunk of splitMessage(text)) {
      const message = await bot.api.sendMessage(chatId, chunk, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      messageIds.push(message.message_id);
    }
  }

  return { messageIds, photoFileIds };
}
