import type {
  CatalogDto,
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
  tagTypes: ['Report'],
  endpoints: (build) => ({
    getMe: build.query<MeDto, void>({ query: () => '/me' }),
    getCatalog: build.query<CatalogDto, void>({ query: () => '/catalog' }),
    getUsers: build.query<UserBriefDto[], void>({ query: () => '/users' }),
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
