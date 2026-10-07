import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePublicBranches } from '@/hooks/queries/usePublicBranches';
import { useAvailableDays, type AvailableDaysParams } from '@/hooks/queries/useAvailableDays';
import { useSlots } from '@/hooks/queries/useSlots';
import type { Slot } from '@/components/features/booking/TimeSlotsGrid';
import type { DeliveryType } from '@/types/booking-enums';

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
  enabled?: boolean;
}

/** Query cache owns server reads; only the visitor's selection stays local. */
export function useBookingSlots(ctx: BookingSlotContext) {
  const { t } = useTranslation();
  const enabled = ctx.enabled !== false;
  const days = useMemo(() => Array.from({ length: 30 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + index);
    return day;
  }), []);
  const needsBranchDiscovery = !ctx.branchId;
  const branches = usePublicBranches(enabled && needsBranchDiscovery);
  const { refetch: refetchBranches } = branches;
  const branchId = ctx.branchId ?? (branches.data?.find((branch) => branch.isMain) ?? branches.data?.[0])?.id ?? null;
  const params: AvailableDaysParams = {
    employeeId: ctx.employeeId,
    branchId: branchId ?? undefined,
    serviceId: ctx.serviceId,
    startDate: toLocalDateOnly(days[0]),
    days: days.length,
    durationOptionId: ctx.durationOptionId,
    durationMins: ctx.durationMins ? Number(ctx.durationMins) : undefined,
    deliveryType: ctx.deliveryType ?? 'in_person',
  };
  const scope = JSON.stringify(params);
  const availableDays = useAvailableDays(params, enabled);
  const { refetch: refetchAvailableDays } = availableDays;
  const [emptyDates, setEmptyDates] = useState<{ scope: string; dates: string[] }>({ scope, dates: [] });
  const [daySelection, setDaySelection] = useState<{ scope: string; index: number | null } | null>(null);
  const availabilityByDate = useMemo(() => {
    if (!enabled || !availableDays.data) return null;
    const empty = emptyDates.scope === scope ? emptyDates.dates : [];
    return Object.fromEntries(availableDays.data.map(({ date, hasSlots }) => [date, hasSlots && !empty.includes(date)]));
  }, [availableDays.data, emptyDates, enabled, scope]);
  const firstAvailable = days.findIndex((day) => availabilityByDate?.[toLocalDateOnly(day)] === true);
  const selectedIndex = daySelection?.scope === scope ? daySelection.index : firstAvailable >= 0 ? firstAvailable : null;
  const dayIdx = selectedIndex != null && availabilityByDate?.[toLocalDateOnly(days[selectedIndex])] === true
    ? selectedIndex : firstAvailable >= 0 ? firstAvailable : null;
  const date = dayIdx == null ? undefined : toLocalDateOnly(days[dayIdx]);
  const slotsQuery = useSlots({ ...params, date }, { enabled: enabled && dayIdx != null });
  const { refetch: refetchSlots } = slotsQuery;
  const slotScope = JSON.stringify([scope, date]);
  const [slotSelection, setSlotSelection] = useState<{ scope: string; slot: Slot } | null>(null);
  const slots: Slot[] = enabled && date ? slotsQuery.data ?? [] : [];
  const selectedIndexInSlots = slotSelection?.scope === slotScope
    ? slots.findIndex((slot) => slot.startTime === slotSelection.slot.startTime && slot.endTime === slotSelection.slot.endTime) : -1;
  const slotIdx = selectedIndexInSlots >= 0 ? selectedIndexInSlots : null;

  // A refreshed overview can reopen days whose slots were previously filled.
  useEffect(() => {
    setEmptyDates({ scope, dates: [] });
  }, [scope, availableDays.dataUpdatedAt]);

  // A day can fill after its overview was read. Skip it without broadening context.
  useEffect(() => {
    if (!enabled || !date || !slotsQuery.isSuccess || slotsQuery.isFetching || slotsQuery.data?.length) return;
    // A cached empty page must be checked again before hiding a newly offered day.
    if (!slotsQuery.isFetchedAfterMount) {
      void refetchSlots();
      return;
    }
    setEmptyDates((current) => ({ scope, dates: [...(current.scope === scope ? current.dates : []), date] }));
  }, [date, enabled, scope, slotsQuery.data, slotsQuery.isFetchedAfterMount, slotsQuery.isFetching, slotsQuery.isSuccess, refetchSlots]);

  useEffect(() => {
    if (slotSelection?.scope === slotScope && slotsQuery.isSuccess && !slotsQuery.isFetching && selectedIndexInSlots < 0) setSlotSelection(null);
  }, [selectedIndexInSlots, slotScope, slotSelection, slotsQuery.isFetching, slotsQuery.isSuccess]);

  const handleRetry = useCallback(() => { void refetchSlots(); }, [refetchSlots]);
  const handleRetryDays = useCallback(() => {
    setEmptyDates({ scope, dates: [] });
    if (!branchId) void refetchBranches();
    else void refetchAvailableDays();
  }, [refetchAvailableDays, branchId, refetchBranches, scope]);
  const clearSelection = useCallback(() => {
    setSlotSelection(null);
    setDaySelection(null);
  }, []);
  const daysError = !enabled ? null : !ctx.employeeId || (needsBranchDiscovery && branches.isError) || availableDays.isError
    ? t('common.errorDescription') : needsBranchDiscovery && branches.isSuccess && !branchId ? t('common.errorDescription') : null;

  return {
    days, branchId, availabilityByDate,
    daysLoading: enabled && ((needsBranchDiscovery && branches.isFetching) || Boolean(branchId && ctx.employeeId && availableDays.isPending)),
    daysError, dayIdx,
    setDayIdx: (index: number) => { setDaySelection({ scope, index }); setSlotSelection(null); },
    slots,
    loading: enabled && Boolean(date) && slotsQuery.isFetching,
    error: enabled && slotsQuery.isError ? t('common.errorDescription') : null,
    slotIdx,
    setSlotIdx: (index: number | null) => setSlotSelection(index != null && slots[index] ? { scope: slotScope, slot: slots[index] } : null),
    selectedSlot: slotIdx != null && !slotsQuery.isFetching && !slotsQuery.isError ? slots[slotIdx] ?? null : null,
    selectedDay: days[dayIdx ?? 0],
    handleRetry, handleRetryDays, clearSelection,
  };
}
