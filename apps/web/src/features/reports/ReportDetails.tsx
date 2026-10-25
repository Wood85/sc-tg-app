import { categoryLabels, dateLabel, formatMoney, type MeDto } from '@sc/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { errorMessage, useDeleteReportMutation, useGetReportQuery } from '../../api/baseApi.ts';
import { confirmAction, haptic } from '../../telegram.ts';
import { BackLink } from '../../ui/BackLink.tsx';
import { PhotoThumb, usePhotoUrl } from '../../ui/PhotoThumb.tsx';
import styles from '../../ui/ui.module.css';
import { statusLabels } from './ReportsList.tsx';

function formatQty(qty: number) {
  return qty.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

export function ReportDetails({ me }: { me: MeDto }) {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: report, isLoading, error } = useGetReportQuery(id);
  const [deleteReport, { isLoading: deleting }] = useDeleteReportMutation();
  const [deleteError, setDeleteError] = useState<string>();
  const [openPhoto, setOpenPhoto] = useState<number | null>(null);

  if (isLoading) return <p className={styles.hint}>Загрузка…</p>;
  if (error || !report) return <p className={styles.error}>{errorMessage(error)}</p>;

  const myAmount = report.participants.find((p) => p.id === me.id)?.amount ?? 0;
  const canDelete = report.status === 'draft' && report.author.id === me.id;

  async function remove() {
    if (!(await confirmAction('Удалить черновик?'))) return;
    try {
      await deleteReport(id).unwrap();
      haptic('success');
      navigate('/reports');
    } catch (err) {
      setDeleteError(errorMessage(err));
      haptic('error');
    }
  }

  return (
    <div className={styles.form}>
      <BackLink to="/reports" />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {report.address || 'Без адреса'}
          {statusLabels[report.status] && <span className={styles.tag}>{statusLabels[report.status]}</span>}
        </h2>
        <p className={styles.hint}>
          {dateLabel(report.workDate)}
          {report.location && ` · ${report.location}`}
        </p>
        {report.atHeight && <p>🪜 Работы на высоте выше 4,5 м (×1,2)</p>}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Бригада</h2>
        <div>
          {report.participants.map((p) => (
            <div key={p.id} className={styles.listRow}>
              <span className={styles.itemName}>
                {p.name}
                {p.id === report.author.id && <span className={styles.hint}>заполнил отчёт</span>}
              </span>
              <span className={styles.amount}>{formatMoney(p.amount)}</span>
            </div>
          ))}
        </div>
      </section>

      {report.works.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Работы</h2>
          <div>
            {report.works.map((w) => (
              <div key={w.priceItemId} className={styles.listRow}>
                <span className={styles.itemName}>
                  {w.name}
                  <span className={styles.hint}>
                    {categoryLabels[w.category]} · {formatQty(w.qty)} {w.unit} × {formatMoney(w.unitPrice)}
                  </span>
                </span>
                <span className={styles.amount}>{formatMoney(w.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.materials.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Материалы</h2>
          <div>
            {report.materials.map((m) => (
              <div key={m.materialId} className={styles.listRow}>
                <span>{m.name}</span>
                <span className={styles.hint}>
                  {formatQty(m.qty)} {m.unit}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.photos.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Фото</h2>
          <div className={styles.photoGrid}>
            {report.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className={styles.photoTile}
                onClick={() => setOpenPhoto(photo.id)}
                aria-label="Открыть фото"
              >
                <PhotoThumb id={photo.id} />
              </button>
            ))}
          </div>
        </section>
      )}

      {report.comment && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Комментарий</h2>
          <p>{report.comment}</p>
        </section>
      )}

      <section className={styles.summary}>
        <div>
          Сумма по прайсу{report.atHeight && ' с коэффициентом 1,2'}: <b>{formatMoney(report.totalAmount)}</b>
        </div>
        <div>
          Ваша доля: <b>{formatMoney(myAmount)}</b>
        </div>
        <p className={styles.hint}>Дневной оклад — на вкладке «Заработок».</p>
      </section>

      {canDelete && (
        <button type="button" className={styles.dangerButton} disabled={deleting} onClick={() => void remove()}>
          Удалить черновик
        </button>
      )}
      {deleteError && <p className={styles.error}>{deleteError}</p>}

      {openPhoto !== null && <PhotoViewer id={openPhoto} onClose={() => setOpenPhoto(null)} />}
    </div>
  );
}

// Фото на весь экран; закрывается нажатием.
function PhotoViewer({ id, onClose }: { id: number; onClose: () => void }) {
  const url = usePhotoUrl(id);
  return (
    <button type="button" className={styles.lightbox} onClick={onClose} aria-label="Закрыть фото">
      {url && <img src={url} alt="" />}
    </button>
  );
}
