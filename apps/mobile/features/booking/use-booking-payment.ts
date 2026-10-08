import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateClientBookingResources } from '@/hooks/queries/invalidateClientBookingResources';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { useBankTransferSettings, usePublicPaymentMethods } from '@/hooks/queries';
import { clientBookingsService } from '@/services/client/bookings';
import { useNativePaymentCapabilities } from '@/features/payments/native-payment-capabilities';
import { isClientBankTransferAvailable } from '@/features/booking/payment-methods';
import {
  bookingPaymentDraft,
  savePendingBookingCheckout,
  resolvePendingBookingResume,
  type PendingBookingCheckout,
} from '@/features/booking/payment-resume-state';
import type { DeliveryType } from '@/types/booking-enums';

/** A saved native attempt reserves the invoice unless the server reported it failed. */
async function hasReservingNativeAttempt(userId: string, invoiceId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(`sawaa.native-payment:${userId}:${invoiceId}`);
  if (!raw) return false;
  try {
    return (JSON.parse(raw) as { failed?: boolean }).failed !== true;
  } catch {
    return true;
  }
}

/**
 * Payment methods offered for a brand-new booking (the wizard path).
 * `at_center` creates a confirmed booking with no online invoice; reception
 * collects the amount later.
 */
export type BookingPaymentMethod = 'card' | 'apple_pay' | 'bank_transfer' | 'at_center';

export interface BookingPaymentInput {
  branchId?: string;
  employeeId?: string;
  serviceId?: string;
  scheduledAt?: string;
  durationOptionId?: string;
  deliveryType?: DeliveryType;
  amount?: string;
  currency?: string;
}

/**
 * Creates the booking for the current wizard draft and starts its payment.
 * The existing-invoice resume path stays in `booking/payment.tsx`; this hook
 * covers only a booking created from the review step.
 */
export function useBookingPayment(input: BookingPaymentInput, enabled = true) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dir = useDir();
  const { t } = useTranslation();
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const bankQuery = useBankTransferSettings(Boolean(userId));
  const methodsQuery = usePublicPaymentMethods();
  const native = useNativePaymentCapabilities();
  const userRef = useRef(userId);
  userRef.current = userId;
  const bankTransferSettings = bankQuery.data;
  const paymentMethods = methodsQuery.data;
  const methodsLoading = methodsQuery.isLoading || bankQuery.isLoading || (Boolean(userId) && native.isLoading);
  const methodsError = methodsQuery.isError || bankQuery.isError || (Boolean(userId) && native.isError);
  const retryMethods = () => { void methodsQuery.refetch(); void bankQuery.refetch(); void native.refetch(); };
  const refreshRef = useRef(retryMethods); refreshRef.current = retryMethods;
  useFocusEffect(useCallback(() => { if (userId) refreshRef.current(); }, [userId]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userId) refreshRef.current();
    });
    return () => subscription.remove();
  }, [userId]);
  const inFlight = useRef(false);
  const pending = useRef<{ key: string; checkout: PendingBookingCheckout } | null>(null);
  const [method, setMethod] = useState<BookingPaymentMethod>('card');
  const [submitting, setSubmitting] = useState(false);

  const onlineEnabled = paymentMethods?.moyasarEnabled === true && native.enabled;
  const atCenterEnabled = paymentMethods?.atClinicEnabled === true;
  const bankTransferAvailable = isClientBankTransferAvailable(bankTransferSettings);

  const availableMethods = useMemo<BookingPaymentMethod[]>(() => {
    const methods: BookingPaymentMethod[] = [];
    if (onlineEnabled) methods.push('card');
    if (onlineEnabled && native.applePayAvailable) methods.push('apple_pay');
    if (bankTransferAvailable) methods.push('bank_transfer');
    if (atCenterEnabled) methods.push('at_center');
    return methods;
  }, [onlineEnabled, native.applePayAvailable, bankTransferAvailable, atCenterEnabled]);

  // Keep the selection valid when the offered methods change (for example a
  // deployment with online payment disabled must default to pay-at-center
  // instead of leaving an unselectable card method active).
  useEffect(() => {
    if (methodsLoading || methodsError || availableMethods.length === 0) return;
    if (availableMethods.includes(method)) return;
    setMethod(availableMethods[0]);
  }, [availableMethods, method, methodsLoading, methodsError]);

  const draft = useMemo(
    () => bookingPaymentDraft({
      branchId: input.branchId,
      employeeId: input.employeeId,
      serviceId: input.serviceId,
      scheduledAt: input.scheduledAt,
      durationOptionId: input.durationOptionId?.trim() || undefined,
      deliveryType: input.deliveryType,
    }),
    [input.branchId, input.employeeId, input.serviceId, input.scheduledAt, input.durationOptionId, input.deliveryType],
  );

  const ownerScope = JSON.stringify([userId, draft]);
  const ownerScopeRef = useRef(ownerScope);
  ownerScopeRef.current = ownerScope;
  const total = input.amount ? Number(input.amount) : 0;

  const canStart = enabled
    && !submitting
    && !methodsLoading && !methodsError
    && availableMethods.length > 0
    && Boolean(userId)
    && Boolean(input.branchId && input.employeeId && input.serviceId && input.scheduledAt && draft);

  const canPay = canStart && availableMethods.includes(method);

  const start = useCallback(async (selected: BookingPaymentMethod, prepareOnly = false): Promise<PendingBookingCheckout | null> => {
    if (!canStart || !availableMethods.includes(selected) || !userId || !draft || inFlight.current) return null;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const key = JSON.stringify([userId, draft]);
      const remembered = pending.current?.key === key ? pending.current.checkout : undefined;
      const resume = await resolvePendingBookingResume(userId, draft, remembered);
      if (userRef.current !== userId || ownerScopeRef.current !== ownerScope) return null;
      if (resume.kind === 'invalid') throw new Error('Invalid pending booking');
      let booking: PendingBookingCheckout;
      if (resume.kind === 'ready' || resume.kind === 'complete') {
        booking = resume.checkout;
        if (resume.kind === 'complete') {
          void invalidateClientBookingResources(queryClient);
          router.replace({ pathname: '/(client)/booking/success', params: {
            bookingId: booking.bookingId, ...(booking.invoiceId ? { invoiceId: booking.invoiceId } : {}),
          } });
          return null;
        }
        // An existing online invoice cannot be converted into pay-at-center.
        if (selected === 'at_center') {
          Alert.alert(t('booking.paymentMethod'), t('booking.existingOnlineInvoice'));
          return null;
        }
        // A started card/Apple Pay attempt reserves the invoice amount, so a
        // bank-transfer receipt would be rejected as already reserved.
        if (selected === 'bank_transfer' && booking.invoiceId
          && await hasReservingNativeAttempt(userId, booking.invoiceId)) {
          Alert.alert(t('booking.paymentMethod'), t('booking.existingNativeAttempt'));
          return null;
        }
      } else {
        const created = await clientBookingsService.create({
          branchId: draft.branchId,
          employeeId: draft.employeeId,
          serviceId: draft.serviceId,
          scheduledAt: draft.scheduledAt,
          ...(draft.durationOptionId ? { durationOptionId: draft.durationOptionId } : {}),
          deliveryType: input.deliveryType,
          ...(selected === 'at_center' ? { payAtClinic: true } : {}),
        });
        if (userRef.current === userId) void invalidateClientBookingResources(queryClient);
        booking = { bookingId: created.id, invoiceId: created.invoiceId ?? null, draft };
        // Retain identity even if persisting the resume record itself fails.
        pending.current = { key, checkout: booking };
        await savePendingBookingCheckout(userId, draft, booking);
      }
      if (userRef.current !== userId || ownerScopeRef.current !== ownerScope) return null;
      if (prepareOnly && booking.invoiceId) return booking;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (selected === 'at_center') {
        router.replace({
          pathname: '/(client)/booking/success',
          params: {
            bookingId: booking.bookingId,
            ...(booking.invoiceId ? { invoiceId: booking.invoiceId } : {}),
          },
        });
        return null;
      }

      if (selected === 'bank_transfer') {
        if (!booking.invoiceId) {
          router.replace({ pathname: '/(client)/booking/success', params: { bookingId: booking.bookingId } });
          return null;
        }
        router.replace({
          pathname: '/(client)/booking/bank-transfer',
          params: { invoiceId: booking.invoiceId, amount: String(total), bookingId: booking.bookingId },
        });
        return null;
      }

      if (!booking.invoiceId) {
        router.replace({ pathname: '/(client)/booking/success', params: { bookingId: booking.bookingId } });
        return null;
      }

      router.push({
        pathname: '/(client)/payments/native-checkout',
        params: {
          bookingId: booking.bookingId,
          invoiceId: booking.invoiceId,
          method: selected === 'apple_pay' ? 'APPLE_PAY' : 'ONLINE_CARD',
          fromBookingConfirm: 'true',
        },
      });
      return null;
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (dir.isRTL ? 'تعذّر إكمال الدفع. حاولي مرة أخرى.' : 'Could not continue payment. Try again.');
      Alert.alert(dir.isRTL ? 'خطأ' : 'Error', message);
      return null;
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, [canStart, availableMethods, userId, draft, ownerScope, input.deliveryType, router, queryClient, dir.isRTL, total, t]);

  const pay = useCallback((selected: BookingPaymentMethod = method) => start(selected), [start, method]);
  const prepareApplePay = useCallback(() => start('apple_pay', true), [start]);

  return { canStart, prepareApplePay, method, setMethod, availableMethods, submitting, canPay, pay, total, methodsLoading, methodsError, retryMethods };
}
