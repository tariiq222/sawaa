import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientPackagePurchase, PackageFamily } from '@sawaa/shared/types';

const mocks = vi.hoisted(() => ({
  getBranches: vi.fn(),
  getDays: vi.fn(),
  getSlots: vi.fn(),
}));

vi.mock('@sawaa/api-client', () => ({
  setMeBaseUrl: vi.fn(),
  packageFamiliesApi: {
    getMyPackagePurchase: vi.fn(),
    bookMyPackageCredit: vi.fn(),
    listMyPackagePurchases: vi.fn(),
    initPackagePurchase: vi.fn(),
  },
}));
vi.mock('@/features/booking/booking.api', () => ({
  getPublicAvailabilityDays: mocks.getDays,
  getPublicAvailability: mocks.getSlots,
  getPublicBranches: mocks.getBranches,
}));
vi.mock('@/features/auth/public', () => ({
  useCurrentClient: () => ({ client: { id: 'client-1' }, isLoading: false }),
}));

import { LocaleProvider } from '@/features/locale/locale-provider';
import { PackageCatalogFeature } from './package-catalog';
import { PackageDetailFeature } from './package-detail';
import { PackagePurchaseFeature } from './package-purchase';
import { PackageBalanceFeature } from './package-balance';
import type { ClientPackagePurchaseRow, PublicPackageFamily } from './packages.api';

// Net option price 36000 halalas (360 SAR).
const baseFamily = {
  id: 'family-1',
  nameAr: 'الباقة العلاجية',
  nameEn: 'Therapy package',
  descriptionAr: 'جلسات علاجية',
  descriptionEn: 'A therapy package',
  isActive: true,
  isPublic: true,
  isStandalone: false,
  options: [
    { id: 'offer-9', nameAr: '9 جلسات', nameEn: '9 sessions', sessionCount: 9, isActive: true, isPublic: true, price: { subtotal: 36000, discountAmount: 0, finalPrice: 36000, itemUnitPrices: [] } },
  ],
} as unknown as PackageFamily;

const withVat = (vatRate?: number): PublicPackageFamily => ({ ...baseFamily, ...(vatRate === undefined ? {} : { vatRate }) });

const purchase = {
  id: 'purchase-1',
  packageId: 'offer-9',
  packageNameAr: 'الباقة العلاجية',
  packageNameEn: 'Therapy package',
  status: 'ACTIVE',
  amountPaid: 36000,
  refundAmount: 0,
  credits: [],
} as unknown as ClientPackagePurchase;

function renderEn(children: React.ReactNode) {
  return render(<LocaleProvider locale="en">{children}</LocaleProvider>);
}

describe('package prices with VAT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBranches.mockResolvedValue([{ id: 'branch-1', nameAr: 'الفرع', nameEn: 'Branch' }]);
  });

  describe.each([
    ['vatRate 0', 0],
    ['missing vatRate', undefined],
  ])('%s', (_label, vatRate) => {
    it('catalog shows the net price with no VAT text', () => {
      renderEn(<PackageCatalogFeature families={[withVat(vatRate)]} />);
      expect(screen.getByText(/From 360\.00 SAR · 9/)).toBeTruthy();
      expect(screen.queryByText(/VAT/)).toBeNull();
    });

    it('detail shows the net price with no VAT text', () => {
      renderEn(<PackageDetailFeature family={withVat(vatRate)} />);
      expect(screen.getAllByText('360.00 SAR').length).toBeGreaterThan(0);
      expect(screen.queryByText(/VAT/)).toBeNull();
    });

    it('checkout shows the net price with no VAT breakdown', async () => {
      renderEn(<PackagePurchaseFeature family={withVat(vatRate)} packageId="offer-9" />);
      await waitFor(() => expect(mocks.getBranches).toHaveBeenCalled());
      expect(screen.getByText('360.00 SAR')).toBeTruthy();
      expect(screen.queryByText(/VAT/)).toBeNull();
    });
  });

  describe('vatRate 0.15', () => {
    it('catalog shows the VAT-inclusive starting price', () => {
      renderEn(<PackageCatalogFeature families={[withVat(0.15)]} />);
      expect(screen.getByText(/From 414\.00 SAR \(incl\. VAT\)/)).toBeTruthy();
    });

    it('detail shows the VAT-inclusive price and an inclusion note', () => {
      renderEn(<PackageDetailFeature family={withVat(0.15)} />);
      expect(screen.getAllByText(/414\.00 SAR/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/360\.00/)).toBeNull();
      expect(screen.getByText('incl. VAT')).toBeTruthy();
    });

    it('checkout shows the gross amount charged and the net + VAT breakdown', async () => {
      renderEn(<PackagePurchaseFeature family={withVat(0.15)} packageId="offer-9" />);
      await waitFor(() => expect(mocks.getBranches).toHaveBeenCalled());
      expect(screen.getByText('414.00 SAR')).toBeTruthy();
      expect(screen.getByText('incl. VAT · Package price: 360.00 SAR · VAT: 54.00 SAR')).toBeTruthy();
    });

    it('checkout breakdown is in plain Arabic', async () => {
      render(<LocaleProvider locale="ar"><PackagePurchaseFeature family={withVat(0.15)} packageId="offer-9" /></LocaleProvider>);
      await waitFor(() => expect(mocks.getBranches).toHaveBeenCalled());
      expect(screen.getByText('414.00 ر.س')).toBeTruthy();
      expect(screen.getByText('شامل الضريبة · سعر الباقة: 360.00 ر.س · ضريبة القيمة المضافة: 54.00 ر.س')).toBeTruthy();
    });
  });

  describe('account balance amount paid', () => {
    it('shows the VAT-inclusive total charged when present', () => {
      const row: ClientPackagePurchaseRow = { ...purchase, vatAmount: 5400, totalCharged: 41400 };
      renderEn(<PackageBalanceFeature purchases={[row]} branchId="branch-1" />);
      expect(screen.getByText(/Amount paid: 414\.00 SAR/)).toBeTruthy();
    });

    it('falls back to amountPaid for older responses without totalCharged', () => {
      renderEn(<PackageBalanceFeature purchases={[purchase]} branchId="branch-1" />);
      expect(screen.getByText(/Amount paid: 360\.00 SAR/)).toBeTruthy();
    });
  });
});
