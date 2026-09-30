import { useCallback, useEffect, useMemo, useState } from 'react';

import { publicEmployeesService } from '@/services/client/employees';
import { branchesService } from '@/services/branches';
import { useDir } from '@/hooks/useDir';
import type { Slot } from '@/components/features/booking/TimeSlotsGrid';
import type { DeliveryType } from '@/types/booking-enums';

/**
 * Shared branch/day/slot state for the booking flow. Extracted from the
 * standalone schedule screen so the merged booking page (duration + time) and
 * the legacy schedule route use one implementation instead of two.
 */

export function toLocalDateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface BookingSlotContext {
  serviceId?: string;
  employeeId?: string;
  branchId?: string;
  durationOptionId?: string;
  durationMins?: string;
  deliveryType?: DeliveryType;
  /** When false the hook stays idle (used before the visitor picks an option). */
  enabled?: boolean;
}

export function useBookingSlots(ctx: BookingSlotContext) {
  const dir = useDir();
  const days = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  const [branchId, setBranchId] = useState<string | null>(ctx.branchId ?? null);
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, boolean> | null>(null);
  const [daysLoading, setDaysLoading] = useState(true);
  const [daysError, setDaysError] = useState<string | null>(null);
  const [daysReloadKey, setDaysReloadKey] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotIdx, setSlotIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dayIdx, setDayIdx] = useState<number | null>(null);

  useEffect(() => {
    if (branchId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await branchesService.getAll();
        if (cancelled) return;
        const main = list.find((b) => b.isMain) ?? list[0];
        if (main) setBranchId(main.id);
        else {
          setDaysLoading(false);
          setDaysError(dir.isRTL ? 'لا توجد فروع متاحة' : 'No branches available');
        }
      } catch {
        if (!cancelled) {
          setDaysLoading(false);
          setDaysError(dir.isRTL ? 'تعذّر تحميل الفرع' : 'Failed to load branch');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, dir.isRTL, reloadKey]);

  useEffect(() => {
    if (ctx.enabled === false) {
      setDaysLoading(false);
      setDaysError(null);
      setAvailabilityByDate(null);
      setDayIdx(null);
      setSlots([]);
      setSlotIdx(null);
      return;
    }
    if (!ctx.employeeId) {
      setDaysLoading(false);
      setDaysError(dir.isRTL ? 'بيانات الحجز غير مكتملة' : 'Booking details are incomplete');
      return;
    }
    if (!branchId) return;
    let cancelled = false;
    setDaysLoading(true);
    setDaysError(null);
    setAvailabilityByDate(null);
    setDayIdx(null);
    setSlots([]);
    setSlotIdx(null);
    (async () => {
      try {
        const availableDays = await publicEmployeesService.getAvailableDays({
          employeeId: ctx.employeeId as string,
          branchId,
          serviceId: ctx.serviceId,
          startDate: toLocalDateOnly(days[0]),
          days: days.length,
          durationOptionId: ctx.durationOptionId,
          durationMins: ctx.durationMins ? Number(ctx.durationMins) : undefined,
          deliveryType: ctx.deliveryType ?? 'in_person',
        });
        if (cancelled) return;
        const availability = Object.fromEntries(availableDays.map(({ date, hasSlots }) => [date, hasSlots]));
        setAvailabilityByDate(availability);
        const firstAvailable = days.findIndex((day) => availability[toLocalDateOnly(day)] === true);
        setDayIdx(firstAvailable >= 0 ? firstAvailable : null);
      } catch {
        if (!cancelled) setDaysError(dir.isRTL ? 'تعذّر التحقق من الأيام المتاحة' : 'Could not check available days');
      } finally {
        if (!cancelled) setDaysLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx.employeeId, ctx.serviceId, ctx.durationOptionId, ctx.durationMins, ctx.deliveryType, ctx.enabled, branchId, days, dir.isRTL, daysReloadKey]);

  useEffect(() => {
    if (ctx.enabled === false) return;
    if (!ctx.employeeId || !branchId || dayIdx == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSlotIdx(null);
    (async () => {
      try {
        const selectedDeliveryType = ctx.deliveryType ?? 'in_person';
        const data = await publicEmployeesService.getSlots({
          employeeId: ctx.employeeId as string,
          branchId,
          date: toLocalDateOnly(days[dayIdx]),
          serviceId: ctx.serviceId,
          durationOptionId: ctx.durationOptionId,
          durationMins: ctx.durationMins ? Number(ctx.durationMins) : undefined,
          deliveryType: selectedDeliveryType,
        });
        if (cancelled) return;
        if (!data?.length) {
          const date = toLocalDateOnly(days[dayIdx]);
          setAvailabilityByDate((current) => current ? { ...current, [date]: false } : current);
          const nextAvailable = days.findIndex((day) => {
            const candidate = toLocalDateOnly(day);
            return candidate !== date && availabilityByDate?.[candidate] === true;
          });
          setDayIdx(nextAvailable >= 0 ? nextAvailable : null);
          setSlots([]);
        } else {
          setSlots(data);
        }
      } catch {
        if (!cancelled) setError(dir.isRTL ? 'تعذّر تحميل الأوقات' : 'Failed to load times');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    ctx.employeeId,
    branchId,
    dayIdx,
    days,
    availabilityByDate,
    ctx.serviceId,
    ctx.durationOptionId,
    ctx.durationMins,
    ctx.deliveryType,
    dir.isRTL,
    reloadKey,
  ]);

  const handleRetry = useCallback(() => setReloadKey((k) => k + 1), []);
  const handleRetryDays = useCallback(() => {
    setDaysLoading(true);
    setDaysError(null);
    if (!branchId) setReloadKey((k) => k + 1);
    else setDaysReloadKey((k) => k + 1);
  }, [branchId]);

  const selectedSlot = slotIdx != null ? slots[slotIdx] : null;
  const selectedDay = days[dayIdx ?? 0];

  /** Reset day/slot selection (used when the visitor changes duration or visit type). */
  const clearSelection = useCallback(() => {
    setSlotIdx(null);
    setDayIdx(null);
  }, []);

  return {
    days,
    branchId,
    availabilityByDate,
    daysLoading,
    daysError,
    dayIdx,
    setDayIdx: (index: number) => setDayIdx(index),
    slots,
    loading,
    error,
    slotIdx,
    setSlotIdx,
    selectedSlot,
    selectedDay,
    handleRetry,
    handleRetryDays,
    clearSelection,
  };
}
