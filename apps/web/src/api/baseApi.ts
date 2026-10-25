import type {
  AdminMaterialDto,
  AdminPriceItemDto,
  AdminUserDto,
  CatalogDto,
  MaterialInput,
  PriceItemInput,
  UserInput,
  MeDto,
  ReportDraftInput,
  ReportDto,
  ReportListItemDto,
  UserBriefDto,
} from '@sc/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { tg } from '../telegram.ts';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers) => {
      if (tg.initData) headers.set('Authorization', `tma ${tg.initData}`);
      return headers;
    },
  }),
  tagTypes: ['Report', 'Catalog', 'Users'],
  endpoints: (build) => ({
    getMe: build.query<MeDto, void>({ query: () => '/me' }),
    getCatalog: build.query<CatalogDto, void>({ query: () => '/catalog', providesTags: ['Catalog'] }),
    getUsers: build.query<UserBriefDto[], void>({ query: () => '/users', providesTags: ['Users'] }),
    getReports: build.query<ReportListItemDto[], void>({
      query: () => '/reports',
      providesTags: ['Report'],
    }),
    createReport: build.mutation<ReportDto, ReportDraftInput>({
      query: (body) => ({ url: '/reports', method: 'POST', body }),
      invalidatesTags: ['Report'],
    }),
    updateReport: build.mutation<ReportDto, { id: number; body: ReportDraftInput }>({
      query: ({ id, body }) => ({ url: `/reports/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Report'],
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
  useCreateReportMutation,
  useUpdateReportMutation,
  useSendReportMutation,
  useGetAdminPriceItemsQuery,
  useSavePriceItemMutation,
  useDeletePriceItemMutation,
  useGetAdminMaterialsQuery,
  useSaveMaterialMutation,
  useDeleteMaterialMutation,
  useGetAdminUsersQuery,
  useSaveUserMutation,
} = baseApi;

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
