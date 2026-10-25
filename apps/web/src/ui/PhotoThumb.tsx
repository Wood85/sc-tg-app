import { useEffect, useState } from 'react';
import { fetchPhotoUrl } from '../api/baseApi.ts';
import styles from './ui.module.css';

// Превью фото: из только что выбранного файла или скачанные с сервера (фото отдаются только с авторизацией).
const previewCache = new Map<number, string>();

export function rememberPhotoPreview(id: number, url: string) {
  previewCache.set(id, url);
}

export function usePhotoUrl(id: number): string | undefined {
  const [url, setUrl] = useState(previewCache.get(id));

  useEffect(() => {
    if (url) return;
    let cancelled = false;
    fetchPhotoUrl(id)
      .then((fetched) => {
        previewCache.set(id, fetched);
        if (!cancelled) setUrl(fetched);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, url]);

  return url;
}

export function PhotoThumb({ id }: { id: number }) {
  const url = usePhotoUrl(id);
  return url ? <img src={url} alt="" className={styles.photoImage} /> : <span className={styles.photoOverlay}>…</span>;
}
