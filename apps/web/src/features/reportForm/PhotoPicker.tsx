import { MAX_REPORT_PHOTOS } from '@sc/shared';
import { useEffect, useState } from 'react';
import { useDeletePhotoMutation, useUploadPhotoMutation } from '../../api/baseApi.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { compressImage } from '../../ui/compressImage.ts';
import { PhotoThumb, rememberPhotoPreview } from '../../ui/PhotoThumb.tsx';
import styles from '../../ui/ui.module.css';
import { photoAdded, photoRemoved } from './reportFormSlice.ts';

interface Upload {
  key: number;
  file: File;
  previewUrl: string;
  status: 'uploading' | 'error';
}

let nextUploadKey = 0;

// Фото загружаются сразу после выбора, по одному, — на объекте связь бывает плохой.
// onBusyChange сообщает форме, что загрузка ещё идёт и отправлять отчёт рано.
export function PhotoPicker({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const dispatch = useAppDispatch();
  const photoIds = useAppSelector((s) => s.reportForm.photoIds);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [limitError, setLimitError] = useState(false);
  const [uploadPhoto] = useUploadPhotoMutation();
  const [deletePhoto] = useDeletePhotoMutation();
  const slotsLeft = MAX_REPORT_PHOTOS - photoIds.length - uploads.length;

  useEffect(() => onBusyChange(uploads.length > 0), [uploads, onBusyChange]);

  async function start(upload: Upload) {
    setUploads((list) => list.map((u) => (u.key === upload.key ? { ...u, status: 'uploading' } : u)));
    try {
      const { id } = await uploadPhoto(await compressImage(upload.file)).unwrap();
      rememberPhotoPreview(id, upload.previewUrl);
      dispatch(photoAdded(id));
      setUploads((list) => list.filter((u) => u.key !== upload.key));
    } catch {
      setUploads((list) => list.map((u) => (u.key === upload.key ? { ...u, status: 'error' } : u)));
    }
  }

  function addFiles(files: File[]) {
    const accepted = files.slice(0, Math.max(0, slotsLeft));
    setLimitError(accepted.length < files.length);
    const added = accepted.map(
      (file): Upload => ({ key: nextUploadKey++, file, previewUrl: URL.createObjectURL(file), status: 'uploading' }),
    );
    setUploads((list) => [...list, ...added]);
    for (const upload of added) void start(upload);
  }

  function remove(id: number) {
    dispatch(photoRemoved(id));
    void deletePhoto(id);
  }

  function cancel(key: number) {
    setUploads((list) => list.filter((u) => u.key !== key));
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Фото
        {photoIds.length > 0 && <span className={styles.badge}>{photoIds.length}</span>}
      </h2>
      <div className={styles.photoGrid}>
        {photoIds.map((id) => (
          <div key={id} className={styles.photoTile}>
            <PhotoThumb id={id} />
            <button type="button" className={styles.photoRemove} onClick={() => remove(id)} aria-label="Удалить фото">
              ×
            </button>
          </div>
        ))}
        {uploads.map((upload) => (
          <div key={upload.key} className={styles.photoTile}>
            <img src={upload.previewUrl} alt="" className={styles.photoImage} />
            {upload.status === 'uploading' ? (
              <span className={styles.photoOverlay}>Загрузка…</span>
            ) : (
              <button type="button" className={styles.photoOverlay} onClick={() => void start(upload)}>
                Ошибка. Повторить
              </button>
            )}
            <button type="button" className={styles.photoRemove} onClick={() => cancel(upload.key)} aria-label="Убрать фото">
              ×
            </button>
          </div>
        ))}
        {slotsLeft > 0 && (
          <label className={`${styles.photoTile} ${styles.photoAdd}`}>
            + Фото
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addFiles([...(e.target.files ?? [])]);
                // Иначе повторный выбор того же файла не вызовет onChange.
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {limitError && <p className={styles.error}>Можно прикрепить не больше {MAX_REPORT_PHOTOS} фото</p>}
    </section>
  );
}

