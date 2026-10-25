import type { MeDto } from '@sc/shared';
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
  endpoints: (build) => ({
    getMe: build.query<MeDto, void>({ query: () => '/me' }),
  }),
});

export const { useGetMeQuery } = baseApi;
