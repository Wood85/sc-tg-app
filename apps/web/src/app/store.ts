import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../api/baseApi.ts';
import { emptyForm, reportFormReducer, type ReportFormState } from '../features/reportForm/reportFormSlice.ts';

// Форму сохраняем в localStorage: Mini App может закрыться посреди заполнения.
const FORM_STORAGE_KEY = 'reportForm';

function loadForm(): ReportFormState | undefined {
  try {
    const raw = localStorage.getItem(FORM_STORAGE_KEY);
    return raw ? { ...emptyForm(), ...(JSON.parse(raw) as Partial<ReportFormState>) } : undefined;
  } catch {
    return undefined;
  }
}

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    reportForm: reportFormReducer,
  },
  preloadedState: { reportForm: loadForm() ?? emptyForm() },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});

let savedForm = store.getState().reportForm;
store.subscribe(() => {
  const form = store.getState().reportForm;
  if (form === savedForm) return;
  savedForm = form;
  try {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form));
  } catch {
    // Хранилище недоступно — форма просто не переживёт перезапуск.
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
