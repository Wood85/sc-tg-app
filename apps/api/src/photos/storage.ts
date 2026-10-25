import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../env.ts';

// Фото лежат на диске сервера. Чтобы перейти на S3/R2, достаточно заменить этот модуль.

export async function savePhoto(data: Uint8Array): Promise<string> {
  await mkdir(env.PHOTOS_DIR, { recursive: true });
  const key = `${randomUUID()}.jpg`;
  await writeFile(join(env.PHOTOS_DIR, key), data);
  return key;
}

export function photoPath(key: string): string {
  return join(env.PHOTOS_DIR, key);
}

export function readPhoto(key: string) {
  return createReadStream(photoPath(key));
}

export async function removePhoto(key: string) {
  await rm(photoPath(key), { force: true });
}
