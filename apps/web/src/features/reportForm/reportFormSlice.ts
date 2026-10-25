import { MAX_REPORT_PHOTOS, parseQtyInput, type ReportDraftInput } from '@sc/shared';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface ReportFormState {
  address: string;
  location: string;
  workDate: string;
  participantIds: number[];
  // Количество храним строкой, как ввёл пользователь («0,»), и разбираем при отправке.
  works: Record<number, string>;
  materials: Record<number, string>;
  comment: string;
  atHeight: boolean;
  // Уже загруженные на сервер фото, в порядке показа.
  photoIds: number[];
  // Черновик на сервере, если первая попытка отправки уже создала его.
  draftId: number | null;
}

export function today(): string {
  // Локальная дата в формате YYYY-MM-DD.
  return new Date().toLocaleDateString('sv-SE');
}

export function emptyForm(): ReportFormState {
  return {
    address: '',
    location: '',
    workDate: today(),
    participantIds: [],
    works: {},
    materials: {},
    comment: '',
    atHeight: false,
    photoIds: [],
    draftId: null,
  };
}

const reportFormSlice = createSlice({
  name: 'reportForm',
  initialState: emptyForm,
  reducers: {
    fieldChanged(
      state,
      action: PayloadAction<{ field: 'address' | 'location' | 'workDate' | 'comment'; value: string }>,
    ) {
      state[action.payload.field] = action.payload.value;
    },
    atHeightToggled(state) {
      state.atHeight = !state.atHeight;
    },
    participantToggled(state, action: PayloadAction<number>) {
      const id = action.payload;
      state.participantIds = state.participantIds.includes(id)
        ? state.participantIds.filter((p) => p !== id)
        : [...state.participantIds, id];
    },
    qtyChanged(state, action: PayloadAction<{ kind: 'works' | 'materials'; id: number; value: string }>) {
      const { kind, id, value } = action.payload;
      if (value.trim() === '') delete state[kind][id];
      else state[kind][id] = value;
    },
    photoAdded(state, action: PayloadAction<number>) {
      if (state.photoIds.length < MAX_REPORT_PHOTOS) state.photoIds.push(action.payload);
    },
    photoRemoved(state, action: PayloadAction<number>) {
      state.photoIds = state.photoIds.filter((id) => id !== action.payload);
    },
    draftCreated(state, action: PayloadAction<number>) {
      state.draftId = action.payload;
    },
    formReset: () => emptyForm(),
  },
});

export const {
  fieldChanged,
  atHeightToggled,
  participantToggled,
  qtyChanged,
  photoAdded,
  photoRemoved,
  draftCreated,
  formReset,
} = reportFormSlice.actions;
export const reportFormReducer = reportFormSlice.reducer;

function toLines(entries: Record<number, string>) {
  return Object.entries(entries).map(([id, raw]) => ({ id: Number(id), raw, qty: parseQtyInput(raw) }));
}

export interface FormErrors {
  address?: string;
  lines?: string;
  invalidQtyIds: Set<string>;
}

export function validateForm(form: ReportFormState): FormErrors {
  const errors: FormErrors = { invalidQtyIds: new Set() };
  if (!form.address.trim()) errors.address = 'Укажите адрес';
  const works = toLines(form.works);
  const materials = toLines(form.materials);
  for (const line of works) if (line.qty === undefined) errors.invalidQtyIds.add(`works:${line.id}`);
  for (const line of materials) if (line.qty === undefined) errors.invalidQtyIds.add(`materials:${line.id}`);
  if (errors.invalidQtyIds.size > 0) errors.lines = 'Исправьте количество: число больше нуля, до двух знаков после запятой';
  else if (works.length === 0 && materials.length === 0) errors.lines = 'Добавьте хотя бы одну работу или материал';
  return errors;
}

export function hasErrors(errors: FormErrors): boolean {
  return Boolean(errors.address || errors.lines);
}

// Вызывать только для формы без ошибок.
export function toDraftInput(form: ReportFormState): ReportDraftInput {
  return {
    address: form.address.trim(),
    location: form.location.trim(),
    workDate: form.workDate,
    participantIds: form.participantIds,
    works: toLines(form.works).map((l) => ({ priceItemId: l.id, qty: l.qty! })),
    materials: toLines(form.materials).map((l) => ({ materialId: l.id, qty: l.qty! })),
    comment: form.comment.trim(),
    atHeight: form.atHeight,
    photoIds: form.photoIds,
  };
}
