'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvailableSlot, ClientPackagePurchase } from '@sawaa/shared/types';
import { useLocale, useT } from '@/features/locale/locale-provider';
import {
  getPublicAvailability,
  getPublicAvailabilityDays,
  getPublicBranches,
  type AvailabilityDay,
  type PublicBranch,
} from '@/features/booking/booking.api';
import { bookClientPackageCredit, listClientPackagePurchases } from './packages.api';
import { halalasToSar } from '@/lib/money';

interface CreditAvailability {
  days: AvailabilityDay[];
  date: string;
  slots: AvailableSlot[];
  loadingDays: boolean;
  daysError: boolean;
  loadingSlots: boolean;
  slotsError: boolean;
}

const emptyAvailability = (): CreditAvailability => ({
  days: [],
  date: '',
  slots: [],
  loadingDays: false,
  daysError: false,
  loadingSlots: false,
  slotsError: false,
});

function readableReason(reason: string | null | undefined, locale: 'ar' | 'en', fallback: string): string {
  if (!reason) return fallback;
  const known: Record<string, [string, string]> = {
    PREDECESSOR_INCOMPLETE: ['أكمل الجلسة السابقة أولاً', 'Complete the previous session first'],
    GROUP_INCOMPLETE: ['أكمل جلسات المجموعة السابقة أولاً', 'Complete the previous group sessions first'],
    DEPENDENCY_INCOMPLETE: ['أكمل الجلسة السابقة أولاً', 'Complete the previous session first'],
    RESERVED: ['هذه الجلسة محجوزة مؤقتاً', 'This session is reserved'],
    CONSUMED: ['استُخدمت هذه الجلسة', 'This session has already been used'],
    DELIVERED: ['اكتملت هذه الجلسة', 'This session has already been completed'],
    REFUNDED: ['تم استرداد قيمة هذه الباقة', 'This package was refunded'],
    PURCHASE_INACTIVE: ['هذه الباقة غير مفعّلة', 'This package is not active'],
    OFFERING_UNAVAILABLE: ['هذه الخدمة غير متاحة حالياً', 'This offering is unavailable'],
  };
  return known[reason.toUpperCase()]?.[locale === 'ar' ? 0 : 1] ?? reason;
}

function purchaseStatus(status: ClientPackagePurchase['status'], t: ReturnType<typeof useT>): string {
  const keys: Record<ClientPackagePurchase['status'], Parameters<typeof t>[0]> = {
    PENDING: 'packages.status.pending',
    ACTIVE: 'packages.status.active',
    COMPLETED: 'packages.status.completed',
    REFUNDED: 'packages.status.refunded',
  };
  return t(keys[status]);
}

export function PackageBalanceFeature({
  purchases: initialPurchases,
  branchId: initialBranchId,
  focusCreditId,
}: {
  purchases?: ClientPackagePurchase[];
  branchId?: string;
  focusCreditId?: string;
}) {
  const locale = useLocale();
  const t = useT();
  const [purchases, setPurchases] = useState<ClientPackagePurchase[] | null>(initialPurchases ?? null);
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [branchId, setBranchId] = useState(initialBranchId ?? '');
  const [availability, setAvailability] = useState<Record<string, CreditAvailability>>({});
  const [selectedSlots, setSelectedSlots] = useState<Record<string, AvailableSlot | null>>({});
  const [bookingCreditId, setBookingCreditId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [branchError, setBranchError] = useState(false);
  const [branchLoading, setBranchLoading] = useState(!initialBranchId);
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const requestVersions = useRef<Record<string, number>>({});
  const requestedDays = useRef(new Set<string>());
  const branchIdRef = useRef(branchId);

  const loadPurchases = useCallback(async () => {
    setLoadError(false);
    try {
      setPurchases(await listClientPackagePurchases());
    } catch {
      setPurchases(null);
      setLoadError(true);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    setBranchLoading(true);
    setBranchError(false);
    try {
      const result = await getPublicBranches();
      setBranches(result);
      if (result.length === 1) setBranchId(result[0].id);
    } catch {
      setBranchError(true);
    } finally {
      setBranchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialPurchases) return;
    let cancelled = false;
    async function requestPurchases() {
      try {
        const result = await listClientPackagePurchases();
        if (!cancelled) {
          setLoadError(false);
          setPurchases(result);
        }
      } catch {
        if (!cancelled) {
          setPurchases(null);
          setLoadError(true);
        }
      }
    }
    void requestPurchases();
    return () => { cancelled = true; };
  }, [initialPurchases]);

  useEffect(() => {
    if (initialBranchId) return;
    let cancelled = false;
    async function requestBranches() {
      try {
        const result = await getPublicBranches();
        if (cancelled) return;
        setBranches(result);
        if (result.length === 1) setBranchId(result[0].id);
      } catch {
        if (!cancelled) setBranchError(true);
      } finally {
        if (!cancelled) setBranchLoading(false);
      }
    }
    void requestBranches();
    return () => { cancelled = true; };
  }, [initialBranchId]);

  useEffect(() => {
    branchIdRef.current = branchId;
  }, [branchId]);

  const nextRequestVersion = useCallback((creditId: string) => {
    const version = (requestVersions.current[creditId] ?? 0) + 1;
    requestVersions.current[creditId] = version;
    return version;
  }, []);

  useEffect(() => {
    if (!purchases || !branchId) return;
    purchases
      .flatMap((purchase) => purchase.credits)
      .filter((credit) => !focusCreditId || credit.id === focusCreditId)
      .forEach((credit) => {
        if (
          credit.availability?.bookable === false ||
          credit.remaining <= 0 ||
          !credit.serviceIsBookable ||
          !credit.serviceId ||
          !credit.employeeId ||
          !credit.durationOptionId
        ) return;
        const requestKey = `${branchId}:${credit.id}`;
        if (requestedDays.current.has(requestKey)) return;
        requestedDays.current.add(requestKey);
        const version = nextRequestVersion(credit.id);
        setAvailability((current) => ({
          ...current,
          [credit.id]: { ...emptyAvailability(), loadingDays: true },
        }));
        void getPublicAvailabilityDays(credit.employeeId, {
          serviceId: credit.serviceId,
          branchId,
          durationOptionId: credit.durationOptionId,
          deliveryType: credit.deliveryTypeSnapshot ?? 'IN_PERSON',
          days: 21,
        })
          .then((days) => {
            if (branchIdRef.current !== branchId || requestVersions.current[credit.id] !== version) return;
            setAvailability((current) => ({
              ...current,
              [credit.id]: { ...emptyAvailability(), days },
            }));
          })
          .catch(() => {
            if (branchIdRef.current !== branchId || requestVersions.current[credit.id] !== version) return;
            setAvailability((current) => ({
              ...current,
              [credit.id]: { ...emptyAvailability(), daysError: true },
            }));
          });
      });
  }, [availabilityRetry, branchId, focusCreditId, nextRequestVersion, purchases]);

  const chooseDate = useCallback(async (
    creditId: string,
    date: string,
    credit: ClientPackagePurchase['credits'][number],
  ) => {
    if (!branchId || !credit.serviceId || !credit.employeeId || !credit.durationOptionId) return;
    const version = nextRequestVersion(creditId);
    const requestedBranchId = branchId;
    setSelectedSlots((current) => ({ ...current, [creditId]: null }));
    setAvailability((current) => ({
      ...current,
      [creditId]: {
        ...(current[creditId] ?? emptyAvailability()),
        date,
        slots: [],
        loadingSlots: true,
        slotsError: false,
      },
    }));
    try {
      const slots = await getPublicAvailability(credit.employeeId, date, credit.serviceId, requestedBranchId, {
        durationOptionId: credit.durationOptionId,
        deliveryType: credit.deliveryTypeSnapshot ?? 'IN_PERSON',
      });
      if (branchIdRef.current !== requestedBranchId || requestVersions.current[creditId] !== version) return;
      setAvailability((current) => ({
        ...current,
        [creditId]: {
          ...(current[creditId] ?? emptyAvailability()),
          date,
          slots,
          loadingSlots: false,
          slotsError: false,
        },
      }));
    } catch {
      if (branchIdRef.current !== requestedBranchId || requestVersions.current[creditId] !== version) return;
      setAvailability((current) => ({
        ...current,
        [creditId]: {
          ...(current[creditId] ?? emptyAvailability()),
          date,
          slots: [],
          loadingSlots: false,
          slotsError: true,
        },
      }));
    }
  }, [branchId, nextRequestVersion]);

  function retryDays(creditId: string) {
    requestedDays.current.delete(`${branchId}:${creditId}`);
    requestVersions.current[creditId] = (requestVersions.current[creditId] ?? 0) + 1;
    setAvailability((current) => {
      const next = { ...current };
      delete next[creditId];
      return next;
    });
    setAvailabilityRetry((value) => value + 1);
  }

  async function book(creditId: string) {
    const selected = selectedSlots[creditId];
    if (!selected || !branchId || bookingCreditId) {
      setError(t('packages.chooseAvailability'));
      return;
    }
    setError(null);
    setMessage(null);
    setBookingCreditId(creditId);
    try {
      await bookClientPackageCredit({ creditId, branchId, scheduledAt: selected.startTime });
      setMessage(t('packages.bookingSent'));
      await loadPurchases();
    } catch {
      setError(t('packages.bookingError'));
    } finally {
      setBookingCreditId(null);
    }
  }

  const handleBranchChange = (nextBranchId: string) => {
    branchIdRef.current = nextBranchId;
    Object.keys(requestVersions.current).forEach((creditId) => {
      requestVersions.current[creditId] += 1;
    });
    requestedDays.current.clear();
    setBranchId(nextBranchId);
    setAvailability({});
    setSelectedSlots({});
  };

  if (!purchases && loadError) {
    return (
      <section role="alert">
        <p>{t('packages.balanceLoadError')}</p>
        <button type="button" onClick={() => void loadPurchases()}>{t('packages.tryAgain')}</button>
      </section>
    );
  }
  if (!purchases) return <p role="status">{t('packages.loadingBalance')}</p>;
  if (purchases.length === 0) return <p role="status">{t('packages.noBalance')}</p>;

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-black text-[var(--sw-secondary-700)]">{t('packages.balanceTitle')}</h1>
      {!initialBranchId && branchError && (
        <div role="alert">
          <p>{t('packages.branchLoadError')}</p>
          <button type="button" onClick={() => void loadBranches()} disabled={branchLoading}>{t('packages.tryAgain')}</button>
        </div>
      )}
      {!initialBranchId && branchLoading && <p role="status">{t('packages.loadingBranches')}</p>}
      {branches.length > 1 && (
        <label className="block text-sm font-bold">
          {t('packages.branch')}
          <select
            value={branchId}
            onChange={(event) => handleBranchChange(event.target.value)}
            className="mt-2 block w-full max-w-md rounded-xl border border-[var(--sw-neutral-200)] p-3"
          >
            <option value="">{t('packages.chooseBranch')}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{locale === 'ar' ? branch.nameAr : branch.nameEn || branch.nameAr}</option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {purchases.map((purchase) => (
        <article key={purchase.id} className="rounded-3xl bg-white p-6 shadow-[var(--sw-shadow-xs)]">
          <h2 className="text-xl font-extrabold">{locale === 'ar' ? purchase.packageNameAr : purchase.packageNameEn || purchase.packageNameAr}</h2>
          {purchase.offerSnapshot && (
            <p className="mt-1 text-sm text-[var(--sw-body)]">
              {locale === 'ar' ? purchase.offerSnapshot.optionNameAr : purchase.offerSnapshot.optionNameEn || purchase.offerSnapshot.optionNameAr}
              {purchase.offerSnapshot.sessionCount !== null && ` · ${purchase.offerSnapshot.sessionCount} ${t('packages.sessionsTotal')}`}
            </p>
          )}
          <p className="mt-1 text-sm text-[var(--sw-body)]">{t('packages.purchaseStatus')}: {purchaseStatus(purchase.status, t)}</p>
          <p className="mt-1 text-sm text-[var(--sw-body)]">
            {t('packages.amountPaid')}: {halalasToSar(purchase.amountPaid)} {locale === 'ar' ? 'ر.س' : 'SAR'}
            {purchase.refundAmount > 0 ? ` · ${t('packages.refunded')}: ${halalasToSar(purchase.refundAmount)} ${locale === 'ar' ? 'ر.س' : 'SAR'}` : ''}
          </p>
          <div className="mt-5 space-y-4">
            {purchase.credits.filter((credit) => !focusCreditId || credit.id === focusCreditId).map((credit) => {
              const name = locale === 'ar' ? credit.serviceNameAr : credit.serviceNameEn || credit.serviceNameAr;
              const legacyMissingTarget = !credit.serviceId || !credit.employeeId || !credit.durationOptionId;
              const locked = legacyMissingTarget || credit.availability?.bookable === false || credit.remaining <= 0 || !credit.serviceIsBookable;
              const state = availability[credit.id];
              const availableDays = state?.days.filter((day) => day.hasSlots) ?? [];
              return (
                <div key={credit.id} className="rounded-2xl border border-[var(--sw-neutral-200)] p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{name}</h3>
                      <p className="text-sm text-[var(--sw-body)]">{credit.remaining} {t('packages.remaining')}</p>
                    </div>
                    {locked && <p role="note" className="text-sm text-[var(--warning)]">{legacyMissingTarget ? t('packages.supportRequired') : readableReason(credit.availability?.reason, locale, t('packages.locked'))}</p>}
                  </div>
                  {!locked && state && (
                    <>
                      {state.loadingDays && <p role="status" className="mt-3">{t('packages.loadingDates')}</p>}
                      {state.daysError && (
                        <div role="alert" className="mt-3">
                          <p>{t('packages.availableDatesLoadError')}</p>
                          <button type="button" onClick={() => retryDays(credit.id)}>{t('packages.retryDates')}</button>
                        </div>
                      )}
                      {!state.loadingDays && !state.daysError && availableDays.length === 0 && <p className="mt-3">{t('packages.noAvailableDates')}</p>}
                      {!state.loadingDays && !state.daysError && availableDays.length > 0 && (
                        <fieldset className="mt-4">
                          <legend className="text-sm font-semibold">{t('packages.chooseDate')}</legend>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {availableDays.map((day) => (
                              <button key={day.date} type="button" role="radio" aria-checked={state.date === day.date} onClick={() => void chooseDate(credit.id, day.date, credit)} className="rounded-xl border px-3 py-2 text-sm">{day.date}</button>
                            ))}
                          </div>
                        </fieldset>
                      )}
                      {state.loadingSlots && <p role="status" className="mt-3">{t('packages.loadingTimes')}</p>}
                      {state.slotsError && state.date && (
                        <div role="alert" className="mt-3">
                          <p>{t('packages.availableTimesLoadError')}</p>
                          <button type="button" onClick={() => void chooseDate(credit.id, state.date, credit)}>{t('packages.retryTimes')}</button>
                        </div>
                      )}
                      {!state.loadingSlots && !state.slotsError && state.date && state.slots.length === 0 && <p className="mt-3">{t('packages.noAvailableTimes')}</p>}
                      {!state.loadingSlots && !state.slotsError && state.slots.length > 0 && (
                        <fieldset className="mt-4">
                          <legend className="text-sm font-semibold">{t('packages.chooseTime')}</legend>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {state.slots.map((slot) => (
                              <button key={slot.startTime} type="button" role="radio" aria-checked={selectedSlots[credit.id]?.startTime === slot.startTime} onClick={() => setSelectedSlots((current) => ({ ...current, [credit.id]: slot }))} className="rounded-xl border px-3 py-2 text-sm">{new Date(slot.startTime).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' })}</button>
                            ))}
                          </div>
                        </fieldset>
                      )}
                      <button type="button" disabled={!selectedSlots[credit.id] || bookingCreditId === credit.id} onClick={() => void book(credit.id)} className="mt-4 rounded-full bg-[var(--sw-primary-500)] px-5 py-3 font-bold text-[var(--on-primary)] disabled:opacity-50">{bookingCreditId === credit.id ? t('packages.bookingPending') : `${t('packages.book')} ${name}`}</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </section>
  );
}
