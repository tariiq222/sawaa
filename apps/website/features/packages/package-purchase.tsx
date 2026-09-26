'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ClientPackagePurchase, PackageFamily, PackageFamilyOption } from '@sawaa/shared/types';
import { useCurrentClient } from '@/features/auth/public';
import { useLocale, useT } from '@/features/locale/locale-provider';
import { getPublicBranches, type PublicBranch } from '@/features/booking/booking.api';
import { getClientPackagePurchase, initClientPackagePurchase } from './packages.api';
import { halalasToSar } from '@/lib/money';

export function getPackagePurchaseIdempotencyKey(familyId: string, packageId: string, branchId: string, clientId = 'anonymous'): string {
  const storageKey = `sawaa:package-purchase:${clientId}:${familyId}:${packageId}:${branchId}`;
  if (typeof window !== 'undefined') {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
  }
  if (typeof crypto === 'undefined' || !('randomUUID' in crypto)) {
    throw new Error('Secure idempotency key generation is unavailable.');
  }
  const value = crypto.randomUUID();
  if (typeof window !== 'undefined') window.sessionStorage.setItem(storageKey, value);
  return value;
}

interface PackagePurchaseAttempt {
  storageKey: string;
  clientId: string;
  familyId: string;
  packageId: string;
  branchId: string;
}

function packagePurchaseAttemptStorageKey(purchaseId: string): string {
  return `sawaa:package-purchase-attempt:${purchaseId}`;
}

export function rememberPackagePurchaseAttempt(purchaseId: string, attempt: PackagePurchaseAttempt): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(packagePurchaseAttemptStorageKey(purchaseId), JSON.stringify(attempt));
  }
}

export function clearPackagePurchaseAttempt(purchase: ClientPackagePurchase): void {
  if (typeof window === 'undefined') return;
  const mappingKey = packagePurchaseAttemptStorageKey(purchase.id);
  const raw = window.sessionStorage.getItem(mappingKey);
  if (!raw) return;
  try {
    const attempt = JSON.parse(raw) as PackagePurchaseAttempt;
    const familyMatches = !purchase.offerSnapshot?.familyId || purchase.offerSnapshot.familyId === attempt.familyId;
    if (familyMatches && purchase.packageId === attempt.packageId) {
      window.sessionStorage.removeItem(attempt.storageKey);
      window.sessionStorage.removeItem(mappingKey);
    }
  } catch {
    window.sessionStorage.removeItem(mappingKey);
  }
}

export function PackagePurchaseFeature({ family, packageId }: { family: PackageFamily; packageId: string }) {
  const locale = useLocale();
  const t = useT();
  const branchLoadError = t('packages.branchLoadError');
  const { client, isLoading } = useCurrentClient();
  const selected: PackageFamilyOption | undefined = family.options.find((option) => option.id === packageId);
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPublicBranches().then((result) => {
      setBranches(result);
      if (result.length === 1) setBranchId(result[0].id);
    }).catch(() => setError(branchLoadError));
  }, [branchLoadError, locale]);

  const loginHref = useMemo(() => {
    const current = `/packages/purchase?packageId=${encodeURIComponent(packageId)}&packageFamilyId=${encodeURIComponent(family.id)}`;
    return `/login?redirect=${encodeURIComponent(current)}`;
  }, [family.id, packageId]);

  if (isLoading) return <p role="status">{t('packages.loading')}</p>;
  if (!client) {
    return <div className="rounded-3xl bg-[var(--surface)] p-8 text-center"><p className="mb-4">{t('packages.signInPrompt')}</p><Link href={loginHref} className="rounded-full bg-[var(--sw-primary-500)] px-6 py-3 font-bold text-[var(--on-primary)]">{t('packages.signIn')}</Link></div>;
  }
  if (!selected) return <p role="alert">{t('packages.optionUnavailable')}</p>;
  const selectedOption = selected;
  const currentClient = client;

  async function submit() {
    if (!branchId) { setError(t('packages.chooseBranch')); return; }
    if (!selectedOption || !currentClient) { setError(t('packages.optionUnavailable')); return; }
    setSubmitting(true); setError(null);
    try {
      const storageKey = `sawaa:package-purchase:${currentClient.id}:${family.id}:${selectedOption.id}:${branchId}`;
      const idempotencyKey = getPackagePurchaseIdempotencyKey(family.id, selectedOption.id, branchId, currentClient.id);
      const result = await initClientPackagePurchase({ packageId: selectedOption.id, packageFamilyId: family.isStandalone ? undefined : family.id, branchId, idempotencyKey });
      rememberPackagePurchaseAttempt(result.purchaseId, { storageKey, clientId: currentClient.id, familyId: family.id, packageId: selectedOption.id, branchId });
      window.location.assign(result.redirectUrl);
    } catch { setError(t('packages.startPaymentError')); }
    finally { setSubmitting(false); }
  }

  return (
    <section className="mx-auto max-w-xl rounded-3xl bg-[var(--surface)] p-6 shadow-[var(--sw-shadow-sm)] sm:p-8">
      <h1 className="text-2xl font-black text-[var(--sw-secondary-700)]">{locale === 'ar' ? family.nameAr : family.nameEn || family.nameAr}</h1>
      <p className="mt-2 text-sm text-[var(--sw-body)]">{locale === 'ar' ? selected.nameAr : selected.nameEn || selected.nameAr}</p>
      <p className="mt-5 text-2xl font-black text-[var(--sw-primary-700)]">{halalasToSar(selected.price.finalPrice)} {locale === 'ar' ? 'ر.س' : 'SAR'}</p>
      {branches.length > 1 && <label className="mt-6 block text-sm font-bold">{t('packages.branch')}<select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-2 block w-full rounded-xl border border-[var(--sw-neutral-200)] p-3"><option value="">{t('packages.chooseBranch')}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{locale === 'ar' ? branch.nameAr : branch.nameEn || branch.nameAr}</option>)}</select></label>}
      {error && <p role="alert" className="mt-4 text-sm text-[var(--error)]">{error}</p>}
      <button type="button" onClick={() => void submit()} disabled={submitting || !branchId} className="mt-7 w-full rounded-full bg-[var(--sw-primary-500)] px-6 py-3 font-bold text-[var(--on-primary)] disabled:opacity-50">{submitting ? t('packages.redirecting') : t('packages.pay')}</button>
    </section>
  );
}

type PurchaseState = { phase: 'loading' | 'pending' | 'active' | 'failed' | 'error'; purchase?: ClientPackagePurchase };

export function PackagePurchaseStatusFeature({ purchaseId, pollIntervalMs = 3000 }: { purchaseId: string; pollIntervalMs?: number }) {
  const locale = useLocale();
  const t = useT();
  const [state, setState] = useState<PurchaseState>({ phase: 'loading' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    async function poll() {
      try {
        const purchase = await getClientPackagePurchase(purchaseId);
        if (cancelled) return;
        if (purchase.status === 'ACTIVE' || purchase.status === 'COMPLETED') {
          clearPackagePurchaseAttempt(purchase);
          return setState({ phase: 'active', purchase });
        }
        if (purchase.status === 'REFUNDED') return setState({ phase: 'failed', purchase });
        attempts += 1;
        if (attempts >= 10) return setState({ phase: 'pending', purchase });
        setState({ phase: 'pending', purchase });
        window.setTimeout(poll, pollIntervalMs);
      } catch {
        if (!cancelled) setState({ phase: 'error' });
      }
    }
    void poll();
    return () => { cancelled = true; };
  }, [pollIntervalMs, purchaseId, retry]);

  if (state.phase === 'loading') return <p role="status">{t('packages.paymentChecking')}</p>;
  if (state.phase === 'pending') return <section role="status" className="mx-auto max-w-xl rounded-3xl bg-[var(--surface)] p-8 text-center"><h1 className="text-2xl font-black">{t('packages.paymentProcessing')}</h1><p className="mt-3">{t('packages.paymentPendingDescription')}</p><button type="button" onClick={() => { setState({ phase: 'loading' }); setRetry((value) => value + 1); }} className="mt-6 rounded-full bg-[var(--sw-primary-500)] px-5 py-3 font-bold text-[var(--on-primary)]">{t('packages.checkStatus')}</button></section>;
  if (state.phase === 'error') return <section className="mx-auto max-w-xl rounded-3xl bg-[var(--surface)] p-8 text-center"><p role="alert">{t('packages.paymentStatusUnavailable')}</p><button type="button" onClick={() => { setState({ phase: 'loading' }); setRetry((value) => value + 1); }} className="mt-5 rounded-full border border-[var(--sw-primary-500)] px-5 py-3 font-bold">{t('packages.tryAgain')}</button></section>;
  if (state.phase === 'failed') return <p role="alert">{t('packages.paymentIncomplete')}</p>;
  const title = state.purchase ? (locale === 'ar' ? state.purchase.packageNameAr : state.purchase.packageNameEn || state.purchase.packageNameAr) : '';
  return <section className="mx-auto max-w-xl rounded-3xl bg-[var(--surface)] p-8 text-center"><div role="status"><h1 className="text-2xl font-black">{t('packages.paymentActive')}</h1><p className="mt-3">{title}</p></div><Link href="/account/packages" className="mt-6 inline-flex rounded-full bg-[var(--sw-primary-500)] px-5 py-3 font-bold text-[var(--on-primary)]">{t('packages.viewBalance')}</Link><button type="button" className="ms-3 mt-6 rounded-full border border-[var(--sw-primary-500)] px-5 py-3 font-bold" onClick={() => { setState({ phase: 'loading' }); setRetry((value) => value + 1); }}>{t('packages.checkStatus')}</button></section>;
}
