import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientPackagePurchase, PackageFamily } from '@sawaa/shared/types';

const mocks = vi.hoisted(() => ({
  getPurchase: vi.fn(),
  bookCredit: vi.fn(),
  listPurchases: vi.fn(),
  setMeBaseUrl: vi.fn(),
  getDays: vi.fn(),
  getSlots: vi.fn(),
  getBranches: vi.fn(),
}));

vi.mock('@sawaa/api-client', () => ({
  setMeBaseUrl: mocks.setMeBaseUrl,
  packageFamiliesApi: {
    getMyPackagePurchase: mocks.getPurchase,
    bookMyPackageCredit: mocks.bookCredit,
    listMyPackagePurchases: mocks.listPurchases,
  },
}));
vi.mock('@/features/booking/booking.api', () => ({
  getPublicAvailabilityDays: mocks.getDays,
  getPublicAvailability: mocks.getSlots,
  getPublicBranches: mocks.getBranches,
}));

import { LocaleProvider } from '@/features/locale/locale-provider';
import { PackageCatalogFeature } from './package-catalog';
import { PackageDetailFeature } from './package-detail';
import { clearPackagePurchaseAttempt, getPackagePurchaseIdempotencyKey, PackagePurchaseStatusFeature, rememberPackagePurchaseAttempt } from './package-purchase';
import { PackageBalanceFeature } from './package-balance';

const family = {
  id: 'family-1',
  nameAr: 'الباقة العلاجية',
  nameEn: 'Therapy package',
  descriptionAr: 'جلسات علاجية',
  descriptionEn: 'A therapy package',
  isActive: true,
  isPublic: true,
  isStandalone: false,
  options: [
    { id: 'offer-5', nameAr: '5 جلسات', nameEn: '5 sessions', sessionCount: 5, isActive: true, isPublic: true, price: { subtotal: 20000, discountAmount: 0, finalPrice: 20000, itemUnitPrices: [] } },
    { id: 'offer-9', nameAr: '9 جلسات', nameEn: '9 sessions', sessionCount: 9, isActive: true, isPublic: true, price: { subtotal: 32400, discountAmount: 2400, finalPrice: 30000, itemUnitPrices: [] } },
  ],
} as unknown as PackageFamily;

const purchase = {
  id: 'purchase-1',
  packageId: 'offer-9',
  packageNameAr: 'الباقة العلاجية',
  packageNameEn: 'Therapy package',
  modelVersion: 'GROUPED_V2',
  status: 'ACTIVE',
  subtotalSnapshot: 32400,
  discountSnapshot: 2400,
  amountPaid: 30000,
  refundAmount: 0,
  paidAt: '2026-09-14T08:00:00.000Z',
  refundedAt: null,
  createdAt: '2026-09-14T08:00:00.000Z',
  credits: [
    {
      id: 'credit-locked',
      serviceId: 'service-1',
      employeeId: 'employee-1',
      durationOptionId: 'duration-1',
      serviceNameAr: 'جلسة أولى',
      serviceNameEn: 'First session',
      employeeNameAr: 'مختص',
      employeeNameEn: 'Therapist',
      durationLabelAr: 'ساعة',
      durationLabelEn: '60 minutes',
      durationMins: 60,
      serviceIsBookable: true,
      totalQuantity: 1,
      usedQuantity: 0,
      reservedQuantity: 0,
      remaining: 1,
      availability: { bookable: false, reason: 'DEPENDENCY_INCOMPLETE' },
      constraints: [],
      unitPriceSnapshot: 3000,
    },
    {
      id: 'credit-ready',
      serviceId: 'service-2',
      employeeId: 'employee-2',
      durationOptionId: 'duration-2',
      serviceNameAr: 'جلسة متابعة',
      serviceNameEn: 'Follow-up session',
      employeeNameAr: 'مختص',
      employeeNameEn: 'Therapist',
      durationLabelAr: 'ساعة',
      durationLabelEn: '60 minutes',
      durationMins: 60,
      serviceIsBookable: true,
      totalQuantity: 1,
      usedQuantity: 0,
      reservedQuantity: 0,
      remaining: 1,
      availability: { bookable: true, reason: null },
      constraints: [],
      unitPriceSnapshot: 3000,
    },
  ],
} as unknown as ClientPackagePurchase;

function renderWithLocale(children: React.ReactNode) {
  return render(<LocaleProvider locale="en">{children}</LocaleProvider>);
}

describe('website package journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bookCredit.mockResolvedValue({ id: 'booking-1', status: 'PENDING', packageCreditId: 'credit-ready' });
    mocks.listPurchases.mockResolvedValue([purchase]);
    mocks.getDays.mockResolvedValue([{ date: '2026-09-20', hasSlots: true }]);
    mocks.getSlots.mockResolvedValue([{ startTime: '2026-09-20T10:00:00.000Z', endTime: '2026-09-20T11:00:00.000Z' }]);
    mocks.getBranches.mockResolvedValue([]);
  });

  it('exposes the public family from the catalog and links to its detail page', () => {
    renderWithLocale(<PackageCatalogFeature families={[family]} />);

    expect(screen.getByRole('heading', { name: 'Therapy package' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /view package/i }).getAttribute('href')).toBe('/packages/family-1');
  });

  it('lets a visitor choose the 5 or 9 session option and carries the selected offer into checkout', () => {
    renderWithLocale(<PackageDetailFeature family={family} />);

    const nineSessions = screen.getByRole('radio', { name: /9 sessions/i });
    fireEvent.click(nineSessions);

    expect((nineSessions as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByText('300.00 SAR').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /continue to purchase/i }).getAttribute('href')).toBe(
      '/packages/purchase?packageId=offer-9&packageFamilyId=family-1',
    );
  });

  it('renders pending, active, and failed payment-return states from server purchase status', async () => {
    mocks.getPurchase
      .mockResolvedValueOnce({ ...purchase, status: 'PENDING', credits: [] })
      .mockResolvedValueOnce(purchase)
      .mockRejectedValueOnce(new Error('payment status unavailable'));

    renderWithLocale(<PackagePurchaseStatusFeature purchaseId="purchase-1" pollIntervalMs={1} />);

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/processing|activated/i));
    await waitFor(() => expect(screen.getByText('Therapy package')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /check payment status/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/unavailable/i));
  });

  it('shows locked reasons and books an owned available credit only after a date is selected', async () => {
    renderWithLocale(<PackageBalanceFeature purchases={[purchase]} branchId="branch-1" />);

    expect(screen.getByText('Complete the previous session first')).toBeTruthy();
    const date = await screen.findByRole('radio', { name: '2026-09-20' });
    fireEvent.click(date);
    const slot = await screen.findByRole('radio', { name: /01:00 PM/ });
    fireEvent.click(slot);
    await waitFor(() => expect(slot.getAttribute('aria-checked')).toBe('true'));
    await waitFor(() => expect((screen.getByRole('button', { name: /book follow-up session/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /book follow-up session/i }));

    await waitFor(() =>
      expect(mocks.bookCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          creditId: 'credit-ready',
          branchId: 'branch-1',
          scheduledAt: expect.any(String),
        }),
      ),
    );
    expect((await screen.findByRole('status')).textContent).toMatch(/booking request sent/i);
  });

  it('reuses one idempotency key for retries of the same selected package attempt', () => {
    window.sessionStorage.clear();
    const first = getPackagePurchaseIdempotencyKey('family-1', 'offer-9', 'branch-1');
    const retry = getPackagePurchaseIdempotencyKey('family-1', 'offer-9', 'branch-1');
    const differentBranch = getPackagePurchaseIdempotencyKey('family-1', 'offer-9', 'branch-2');

    expect(first).toBe(retry);
    expect(differentBranch).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('clears only the confirmed purchase attempt and keeps another pending key', () => {
    window.sessionStorage.clear();
    const keyA = getPackagePurchaseIdempotencyKey('family-a', 'offer-a', 'branch-a', 'client-1');
    const keyB = getPackagePurchaseIdempotencyKey('family-b', 'offer-b', 'branch-b', 'client-1');
    rememberPackagePurchaseAttempt('purchase-a', {
      storageKey: 'sawaa:package-purchase:client-1:family-a:offer-a:branch-a',
      clientId: 'client-1',
      familyId: 'family-a',
      packageId: 'offer-a',
      branchId: 'branch-a',
    });
    rememberPackagePurchaseAttempt('purchase-b', {
      storageKey: 'sawaa:package-purchase:client-1:family-b:offer-b:branch-b',
      clientId: 'client-1',
      familyId: 'family-b',
      packageId: 'offer-b',
      branchId: 'branch-b',
    });

    clearPackagePurchaseAttempt({
      ...purchase,
      id: 'purchase-a',
      packageId: 'offer-a',
      offerSnapshot: { familyId: 'family-a', familyNameAr: 'أ', familyNameEn: 'A', optionNameAr: 'أ', optionNameEn: 'A', sessionCount: 1 },
    });

    expect(window.sessionStorage.getItem('sawaa:package-purchase:client-1:family-a:offer-a:branch-a')).toBeNull();
    expect(window.sessionStorage.getItem('sawaa:package-purchase:client-1:family-b:offer-b:branch-b')).toBe(keyB);
    expect(keyA).not.toBe(keyB);
  });

  it('ignores availability dates that resolve after the branch changes', async () => {
    let resolveBranchOne!: (days: { date: string; hasSlots: boolean }[]) => void;
    let resolveBranchTwo!: (days: { date: string; hasSlots: boolean }[]) => void;
    mocks.getBranches.mockResolvedValue([
      { id: 'branch-1', nameAr: 'الفرع الأول', nameEn: 'Branch one', city: null, addressAr: null, isMain: true },
      { id: 'branch-2', nameAr: 'الفرع الثاني', nameEn: 'Branch two', city: null, addressAr: null, isMain: false },
    ]);
    mocks.getDays.mockImplementation((_employeeId: string, options: { branchId?: string }) => new Promise((resolve) => {
      if (options.branchId === 'branch-1') resolveBranchOne = resolve;
      else resolveBranchTwo = resolve;
    }));

    renderWithLocale(<PackageBalanceFeature purchases={[purchase]} />);
    const branchSelect = await screen.findByRole('combobox');
    fireEvent.change(branchSelect, { target: { value: 'branch-1' } });
    await waitFor(() => expect(mocks.getDays).toHaveBeenCalledWith('employee-2', expect.objectContaining({ branchId: 'branch-1' })));
    fireEvent.change(branchSelect, { target: { value: 'branch-2' } });
    await waitFor(() => expect(mocks.getDays).toHaveBeenCalledWith('employee-2', expect.objectContaining({ branchId: 'branch-2' })));

    resolveBranchOne([{ date: 'stale-date', hasSlots: true }]);
    resolveBranchTwo([{ date: 'fresh-date', hasSlots: true }]);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'fresh-date' })).toBeTruthy());
    expect(screen.queryByRole('radio', { name: 'stale-date' })).toBeNull();
  });

  it('ignores stale slots and clears a selected slot when the date changes', async () => {
    let resolveFirstDate!: (slots: { startTime: string; endTime: string }[]) => void;
    let resolveSecondDate!: (slots: { startTime: string; endTime: string }[]) => void;
    mocks.getDays.mockResolvedValue([
      { date: '2026-09-20', hasSlots: true },
      { date: '2026-09-21', hasSlots: true },
    ]);
    mocks.getSlots.mockImplementation((_employeeId: string, date: string) => new Promise((resolve) => {
      if (date === '2026-09-20') resolveFirstDate = resolve;
      else resolveSecondDate = resolve;
    }));

    renderWithLocale(<PackageBalanceFeature purchases={[purchase]} branchId="branch-1" />);
    const firstDate = await screen.findByRole('radio', { name: '2026-09-20' });
    const secondDate = screen.getByRole('radio', { name: '2026-09-21' });
    fireEvent.click(firstDate);
    await waitFor(() => expect(mocks.getSlots).toHaveBeenCalledWith('employee-2', '2026-09-20', 'service-2', 'branch-1', expect.anything()));
    resolveFirstDate([{ startTime: '2026-09-20T10:00:00.000Z', endTime: '2026-09-20T11:00:00.000Z' }]);
    const firstSlot = await screen.findByRole('radio', { name: /01:00 PM/ });
    fireEvent.click(firstSlot);
    await waitFor(() => expect((screen.getByRole('button', { name: /book follow-up session/i }) as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(secondDate);
    expect((screen.getByRole('button', { name: /book follow-up session/i }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(mocks.getSlots).toHaveBeenCalledWith('employee-2', '2026-09-21', 'service-2', 'branch-1', expect.anything()));
    resolveFirstDate([{ startTime: '2026-09-20T10:00:00.000Z', endTime: '2026-09-20T11:00:00.000Z' }]);
    resolveSecondDate([{ startTime: '2026-09-21T11:00:00.000Z', endTime: '2026-09-21T12:00:00.000Z' }]);
    await waitFor(() => expect(screen.getByRole('radio', { name: /02:00 PM/ })).toBeTruthy());
    expect(screen.queryByRole('radio', { name: /01:00 PM/ })).toBeNull();
    expect((screen.getByRole('button', { name: /book follow-up session/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
