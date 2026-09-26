'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getPublicPaymentMethods,
  type PublicPaymentMethods,
} from '@/features/booking/booking.api';

export const PUBLIC_PAYMENT_METHODS_QUERY_KEY = ['public', 'payment-methods'] as const;

/**
 * Which collection paths the backend can accept right now.
 *
 * Shared by the booking wizard and the account surfaces so every client-facing
 * place either offers a method or hides it — never a method the backend would
 * reject (which used to fail the whole booking when the dashboard had the
 * method switched off).
 *
 * The flag changes rarely; a short staleTime keeps a page from re-asking on
 * every mount without hiding an admin's toggle for long.
 */
export function usePaymentMethods() {
  return useQuery<PublicPaymentMethods>({
    queryKey: PUBLIC_PAYMENT_METHODS_QUERY_KEY,
    queryFn: getPublicPaymentMethods,
    staleTime: 60_000,
  });
}
