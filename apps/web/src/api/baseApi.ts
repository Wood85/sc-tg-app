import type {
  AdminMaterialDto,
  AdminPriceItemDto,
  AdminUserDto,
  CatalogDto,
  EarningsDto,
  MaterialInput,
  PayrollSendResultDto,
  PayrollStatementDto,
  PayrollUserDto,
  PhotoDto,
  PriceItemInput,
  UserInput,
  WageRates,
  MeDto,
  ReportDraftInput,
  ReportDto,
  ReportListItemDto,
  UserBriefDto,
} from '@sc/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { tg } from '../telegram.ts';

function authHeaders(): Record<string, string> {
  return tg.initData ? { Authorization: `tma ${tg.initData}` } : {};
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers) => {
      if (tg.initData) headers.set('Authorization', `tma ${tg.initData}`);
      return headers;
    },
  }),
  tagTypes: ['Report', 'Catalog', 'Users', 'Payroll'],
  endpoints: (build) => ({
    getMe: build.query<MeDto, void>({ query: () => '/me' }),
    getCatalog: build.query<CatalogDto, void>({ query: () => '/catalog', providesTags: ['Catalog'] }),
    getUsers: build.query<UserBriefDto[], void>({ query: () => '/users', providesTags: ['Users'] }),
    // Заработок по дням (доли по отчётам + оклад); обновляется после отправки отчёта.
    getEarnings: build.query<EarningsDto, { from: string; to: string }>({
      query: ({ from, to }) => `/me/earnings?from=${from}&to=${to}`,
      providesTags: ['Report'],
    }),
    getMyPayroll: build.query<PayrollStatementDto[], void>({
      query: () => '/payroll',
      providesTags: ['Payroll'],
    }),
    sendPayroll: build.mutation<PayrollSendResultDto, string>({
      query: (weekStart) => ({ url: '/payroll', method: 'POST', body: { weekStart } }),
      invalidatesTags: ['Payroll'],
    }),
    getReports: build.query<ReportListItemDto[], void>({
      query: () => '/reports',
      providesTags: ['Report'],
    }),
    getReport: build.query<ReportDto, number>({
      query: (id) => `/reports/${id}`,
      providesTags: ['Report'],
    }),
    deleteReport: build.mutation<void, number>({
      query: (id) => ({ url: `/reports/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Report'],
    }),
    createReport: build.mutation<ReportDto, ReportDraftInput>({
      query: (body) => ({ url: '/reports', method: 'POST', body }),
      invalidatesTags: ['Report'],
    }),
    updateReport: build.mutation<ReportDto, { id: number; body: ReportDraftInput }>({
      query: ({ id, body }) => ({ url: `/reports/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Report'],
    }),
    uploadPhoto: build.mutation<PhotoDto, Blob>({
      query: (photo) => {
        const body = new FormData();
        body.append('file', photo, 'photo.jpg');
        return { url: '/photos', method: 'POST', body };
      },
    }),
    deletePhoto: build.mutation<void, number>({
      query: (id) => ({ url: `/photos/${id}`, method: 'DELETE' }),
    }),
    sendReport: build.mutation<ReportDto, number>({
      query: (id) => ({ url: `/reports/${id}/send`, method: 'POST' }),
      invalidatesTags: ['Report'],
    }),

    // Админка
    getAdminPriceItems: build.query<AdminPriceItemDto[], void>({
      query: () => '/admin/price-items',
      providesTags: ['Catalog'],
    }),
    savePriceItem: build.mutation<AdminPriceItemDto, { id: number | null; body: PriceItemInput }>({
      query: ({ id, body }) =>
        id === null
          ? { url: '/admin/price-items', method: 'POST', body }
          : { url: `/admin/price-items/${id}`, method: 'PUT', body },
      invalidatesTags: ['Catalog'],
    }),
    deletePriceItem: build.mutation<void, number>({
      query: (id) => ({ url: `/admin/price-items/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Catalog'],
    }),
    getAdminMaterials: build.query<AdminMaterialDto[], void>({
      query: () => '/admin/materials',
      providesTags: ['Catalog'],
    }),
    saveMaterial: build.mutation<AdminMaterialDto, { id: number | null; body: MaterialInput }>({
      query: ({ id, body }) =>
        id === null
          ? { url: '/admin/materials', method: 'POST', body }
          : { url: `/admin/materials/${id}`, method: 'PUT', body },
      invalidatesTags: ['Catalog'],
    }),
    deleteMaterial: build.mutation<void, number>({
      query: (id) => ({ url: `/admin/materials/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Catalog'],
    }),
    getWageRates: build.query<WageRates, void>({
      query: () => '/admin/wage-rates',
      providesTags: ['Catalog'],
    }),
    saveWageRates: build.mutation<WageRates, WageRates>({
      query: (body) => ({ url: '/admin/wage-rates', method: 'PUT', body }),
      invalidatesTags: ['Catalog'],
    }),
    getPayrollUsers: build.query<PayrollUserDto[], void>({
      query: () => '/admin/payroll',
      providesTags: ['Payroll'],
    }),
    getPayrollStatements: build.query<PayrollStatementDto[], { userId: number; limit: number }>({
      query: ({ userId, limit }) => `/admin/payroll/${userId}?limit=${limit}`,
      providesTags: ['Payroll'],
    }),
    getAdminUsers: build.query<AdminUserDto[], void>({
      query: () => '/admin/users',
      providesTags: ['Users'],
    }),
    saveUser: build.mutation<AdminUserDto, { id: number | null; body: UserInput }>({
      query: ({ id, body }) =>
        id === null ? { url: '/admin/users', method: 'POST', body } : { url: `/admin/users/${id}`, method: 'PUT', body },
      invalidatesTags: ['Users'],
    }),
  }),
});

export const {
  useGetMeQuery,
  useGetCatalogQuery,
  useGetUsersQuery,
  useGetReportsQuery,
  useGetReportQuery,
  useDeleteReportMutation,
  useGetEarningsQuery,
  useGetMyPayrollQuery,
  useSendPayrollMutation,
  useCreateReportMutation,
  useUpdateReportMutation,
  useSendReportMutation,
  useUploadPhotoMutation,
  useDeletePhotoMutation,
  useGetAdminPriceItemsQuery,
  useSavePriceItemMutation,
  useDeletePriceItemMutation,
  useGetAdminMaterialsQuery,
  useSaveMaterialMutation,
  useDeleteMaterialMutation,
  useGetWageRatesQuery,
  useSaveWageRatesMutation,
  useGetPayrollUsersQuery,
  useGetPayrollStatementsQuery,
  useGetAdminUsersQuery,
  useSaveUserMutation,
} = baseApi;

// Фото отдаются только с авторизацией, поэтому <img src="/api/photos/…"> не подходит:
// скачиваем и показываем через object URL.
export async function fetchPhotoUrl(id: number): Promise<string> {
  const res = await fetch(`/api/photos/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Photo ${id}: ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

// Текст ошибки из ответа API ({ message }) или общий текст.
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data;
    if (typeof data?.message === 'string') return data.message;
  }
  return 'Не удалось связаться с сервером';
}

export function errorStatus(error: unknown): unknown {
  return error && typeof error === 'object' && 'status' in error ? error.status : undefined;
}
