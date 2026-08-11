import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// jsdom does not implement scrollIntoView; the DateStrip's useEffect calls it
// when the slot screen mounts (same shim as features/booking/date-strip.test.tsx).
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn();

/**
 * Focused wizard test for BOOK-04: the date-strip "has slots?" probe must be
 * called with the SAME duration/delivery context as the slot fetch. The page
 * already puts selectedChoice in the days query key; this pins that the
 * queryFn actually forwards it to getPublicAvailabilityDays.
 */

const { queryFns, EMPLOYEE, OTHER_EMPLOYEE, SERVICE, BRANCH, OPTION } = vi.hoisted(() => {
  const queryFns = new Map<string, (() => unknown) | undefined>();

  const employee = (id: string, name: string) => ({
    id,
    userId: `user-${id}`,
    nameAr: name,
    nameEn: name,
    specialty: 'Psychology',
    specialtyAr: 'علم النفس',
    bio: null,
    bioAr: null,
    experience: 5,
    education: null,
    educationAr: null,
    rating: 4.5,
    reviewCount: 3,
    isActive: true,
    isBookable: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    serviceIds: ['svc-1'],
    branchIds: ['br-1'],
    availableDaysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    user: {
      id: `user-${id}`,
      firstName: name,
      lastName: '',
      email: `${id}@test.dev`,
      phone: null,
      avatarUrl: null,
    },
  });

  const service = {
    id: 'svc-1',
    nameAr: 'جلسة فردية',
    nameEn: 'Individual session',
    descriptionAr: null,
    descriptionEn: null,
    categoryId: 'cat-1',
    price: 20000,
    duration: 45,
    isActive: true,
    isHidden: false,
    hidePriceOnBooking: false,
    hideDurationOnBooking: false,
    bufferMinutes: 0,
    depositEnabled: false,
    depositPercent: null,
    maxParticipants: 1,
    minLeadMinutes: null,
    maxAdvanceDays: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const branch = {
    id: 'br-1',
    nameAr: 'الفرع الرئيسي',
    nameEn: 'Main branch',
    city: 'Riyadh',
    addressAr: 'العنوان',
    isMain: true,
  };

  const option = {
    deliveryType: 'ONLINE' as const,
    durationOptionId: 'opt-1',
    durationMins: 45,
    price: 25000,
    currency: 'SAR',
    label: null,
  };

  return { queryFns, EMPLOYEE: employee('emp-1', 'أحمد'), OTHER_EMPLOYEE: employee('emp-2', 'سارة'), SERVICE: service, BRANCH: branch, OPTION: option };
});

let searchParams = new URLSearchParams();
const routerPush = vi.fn();
const routerBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, back: routerBack }),
  useSearchParams: () => searchParams,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { queryKey: unknown[]; queryFn?: () => unknown }) => {
    if (opts.queryFn) queryFns.set(JSON.stringify(opts.queryKey), opts.queryFn);
    const key = opts.queryKey as string[];
    if (key[1] === 'employees') return { data: [EMPLOYEE, OTHER_EMPLOYEE], isLoading: false, error: null };
    if (key[1] === 'catalog') return { data: { services: [SERVICE], categories: [], vatRate: 0 }, isLoading: false, error: null };
    if (key[1] === 'branches') return { data: [BRANCH], isLoading: false, error: null };
    return { data: [], isLoading: false, error: null };
  },
}));

vi.mock('@/lib/public-fetch', () => ({
  publicFetch: vi.fn(),
}));

vi.mock('@/features/booking/booking.api', () => ({
  getPublicBranches: vi.fn().mockResolvedValue([BRANCH]),
  getPublicAvailability: vi.fn().mockResolvedValue([]),
  getPublicAvailabilityDays: vi.fn().mockResolvedValue([]),
  getPractitionerBookingOptions: vi.fn().mockResolvedValue({
    useCustomPricing: false,
    disabledDeliveryTypes: [],
    options: [OPTION],
  }),
  createBooking: vi.fn(),
  initPayment: vi.fn(),
}));

import BookingWizardPage from './page';
import { getPublicAvailabilityDays, getPublicAvailability } from '@/features/booking/booking.api';

const daysMock = getPublicAvailabilityDays as ReturnType<typeof vi.fn>;
const slotsMock = getPublicAvailability as ReturnType<typeof vi.fn>;

describe('/booking wizard — date-strip days probe context', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    routerPush.mockReset();
    routerBack.mockReset();
    queryFns.clear();
    daysMock.mockReset();
    daysMock.mockResolvedValue([]);
    slotsMock.mockReset();
    slotsMock.mockResolvedValue([]);
  });

  it('forwards the selected duration option + delivery type to the days probe (same context as slot fetch)', async () => {
    render(<BookingWizardPage />);

    // Data lands → service screen with the single bookable session.
    const serviceRadio = await waitFor(() =>
      screen.getByRole('radio', { name: /جلسة فردية/ }),
    );

    // 1. Pick the session (service-first flow selects immediately).
    fireEvent.click(serviceRadio);

    // 2. Pick a therapist (two exist, so no auto-skip; choice step opens).
    fireEvent.click(await waitFor(() => screen.getByRole('radio', { name: /سارة/ })));

    // 3. Practitioner options land → pick the ONLINE 45-min option.
    const choiceButton = await waitFor(() => screen.getByRole('button', { name: /أونلاين/ }));
    fireEvent.click(choiceButton);

    // The slot fetch already carried the choice — this is the pre-existing
    // baseline contract the days probe must match. `emp-2` is the therapist
    // selected above (سارة).
    const daysKey = JSON.stringify([
      'public',
      'availability',
      'days',
      'emp-2',
      'svc-1',
      'br-1',
      'opt-1',
      'ONLINE',
    ]);
    await waitFor(() => {
      expect(queryFns.has(daysKey)).toBe(true);
    });

    await queryFns.get(daysKey)!();

    expect(daysMock).toHaveBeenCalledWith(
      'emp-2',
      expect.objectContaining({
        serviceId: 'svc-1',
        branchId: 'br-1',
        days: 14,
        durationOptionId: 'opt-1',
        deliveryType: 'ONLINE',
      }),
    );
  });
});
