import { formatMoney, lineAmount, parseQtyInput, splitEqually, type MeDto, type ReportDto } from '@sc/shared';
import { useState } from 'react';
import {
  errorMessage,
  errorStatus,
  useCreateReportMutation,
  useGetCatalogQuery,
  useGetReportsQuery,
  useGetUsersQuery,
  useSendReportMutation,
  useUpdateReportMutation,
} from '../../api/baseApi.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { haptic, isInsideTelegram, useMainButton } from '../../telegram.ts';
import { ItemPicker } from './ItemPicker.tsx';
import styles from './ReportForm.module.css';
import {
  draftCreated,
  fieldChanged,
  formReset,
  hasErrors,
  participantToggled,
  qtyChanged,
  toDraftInput,
  today,
  validateForm,
} from './reportFormSlice.ts';

export function ReportForm({ me }: { me: MeDto }) {
  const [sent, setSent] = useState<ReportDto | null>(null);
  if (sent) return <SentScreen report={sent} me={me} onNew={() => setSent(null)} />;
  return <ReportFormBody me={me} onSent={setSent} />;
}

function ReportFormBody({ me, onSent }: { me: MeDto; onSent: (report: ReportDto) => void }) {
  const dispatch = useAppDispatch();
  const form = useAppSelector((s) => s.reportForm);
  const catalog = useGetCatalogQuery();
  const users = useGetUsersQuery();
  const reports = useGetReportsQuery();
  const [createReport] = useCreateReportMutation();
  const [updateReport] = useUpdateReportMutation();
  const [sendReport] = useSendReportMutation();

  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const errors = validateForm(form);
  const visibleErrors = showErrors ? errors : { invalidQtyIds: errors.invalidQtyIds };

  // Подсказки адреса из прошлых отчётов, чтобы один дом не записывали по-разному.
  const addressSuggestions = [...new Set(reports.data?.map((r) => r.address).filter(Boolean))];
  const colleagues = users.data?.filter((u) => u.id !== me.id) ?? [];

  // Предварительный расчёт; окончательную сумму считает сервер при отправке.
  const priceById = new Map(catalog.data?.priceItems.map((p) => [p.id, p.price]));
  const total = Object.entries(form.works).reduce((sum, [id, raw]) => {
    const qty = parseQtyInput(raw);
    const price = priceById.get(Number(id));
    return qty && price !== undefined ? sum + lineAmount(qty, price) : sum;
  }, 0);
  const myShare = splitEqually(total, 1 + form.participantIds.length)[0] ?? 0;

  async function submit() {
    setShowErrors(true);
    if (hasErrors(errors)) {
      haptic('error');
      return;
    }
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const body = toDraftInput(form);
      let id = form.draftId;
      if (id !== null) {
        try {
          await updateReport({ id, body }).unwrap();
        } catch (err) {
          // 404 — черновик удалён, создаём заново; 409 — уже отправлен, send вернёт его.
          if (errorStatus(err) === 404) id = null;
          else if (errorStatus(err) !== 409) throw err;
        }
      }
      if (id === null) {
        id = (await createReport(body).unwrap()).id;
        dispatch(draftCreated(id));
      }
      const report = await sendReport(id).unwrap();
      dispatch(formReset());
      haptic('success');
      onSent(report);
    } catch (err) {
      setSubmitError(errorMessage(err));
      haptic('error');
    } finally {
      setSubmitting(false);
    }
  }

  useMainButton({ text: 'Отправить отчёт', onClick: submit, loading: submitting });

  if (catalog.isLoading) return <p className={styles.hint}>Загрузка…</p>;
  if (catalog.error || !catalog.data) return <p className={styles.error}>{errorMessage(catalog.error)}</p>;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Объект</h2>
        <input
          className={`${styles.input} ${visibleErrors.address ? styles.invalid : ''}`}
          placeholder="Адрес, например «Багратиони 196И»"
          list="address-suggestions"
          value={form.address}
          onChange={(e) => dispatch(fieldChanged({ field: 'address', value: e.target.value }))}
        />
        <datalist id="address-suggestions">
          {addressSuggestions.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        {visibleErrors.address && <p className={styles.error}>{visibleErrors.address}</p>}
        <input
          className={styles.input}
          placeholder="Этаж, квартира"
          value={form.location}
          onChange={(e) => dispatch(fieldChanged({ field: 'location', value: e.target.value }))}
        />
        <label className={styles.field}>
          <span className={styles.hint}>Дата работ</span>
          <input
            className={styles.input}
            type="date"
            max={today()}
            value={form.workDate}
            onChange={(e) => dispatch(fieldChanged({ field: 'workDate', value: e.target.value || today() }))}
          />
        </label>
      </section>

      {colleagues.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Кто работал со мной</h2>
          <div className={styles.chips}>
            {colleagues.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`${styles.chip} ${form.participantIds.includes(u.id) ? styles.chipActive : ''}`}
                onClick={() => dispatch(participantToggled(u.id))}
              >
                {u.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <ItemPicker
        title="Работы"
        items={catalog.data.priceItems}
        values={form.works}
        isInvalid={(id) => visibleErrors.invalidQtyIds.has(`works:${id}`)}
        onChange={(id, value) => dispatch(qtyChanged({ kind: 'works', id, value }))}
      />

      <ItemPicker
        title="Материалы"
        items={catalog.data.materials}
        values={form.materials}
        isInvalid={(id) => visibleErrors.invalidQtyIds.has(`materials:${id}`)}
        onChange={(id, value) => dispatch(qtyChanged({ kind: 'materials', id, value }))}
      />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Комментарий</h2>
        <textarea
          className={styles.input}
          rows={3}
          placeholder="Например: приточка без монтажа"
          value={form.comment}
          onChange={(e) => dispatch(fieldChanged({ field: 'comment', value: e.target.value }))}
        />
      </section>

      <section className={styles.summary}>
        <div>
          Сумма по прайсу: <b>{formatMoney(total)}</b>
        </div>
        {form.participantIds.length > 0 && (
          <div>
            Ваша доля: <b>{formatMoney(myShare)}</b>
          </div>
        )}
        <p className={styles.hint}>В группу суммы не отправляются.</p>
      </section>

      {visibleErrors.lines && <p className={styles.error}>{visibleErrors.lines}</p>}
      {submitError && <p className={styles.error}>{submitError}</p>}

      {!isInsideTelegram && (
        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? 'Отправка…' : 'Отправить отчёт'}
        </button>
      )}
    </form>
  );
}

function SentScreen({ report, me, onNew }: { report: ReportDto; me: MeDto; onNew: () => void }) {
  useMainButton({ text: 'Новый отчёт', onClick: onNew });
  const myAmount = report.participants.find((p) => p.id === me.id)?.amount ?? 0;

  return (
    <div className={styles.form}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>✅ Отчёт отправлен в группу</h2>
        <p>
          {report.address}
          {report.location && ` · ${report.location}`}
        </p>
        <p>
          Сумма по прайсу: <b>{formatMoney(report.totalAmount)}</b>
        </p>
        <p>
          Ваш заработок: <b>{formatMoney(myAmount)}</b>
        </p>
      </section>
      {!isInsideTelegram && (
        <button className={styles.submit} type="button" onClick={onNew}>
          Новый отчёт
        </button>
      )}
    </div>
  );
}
