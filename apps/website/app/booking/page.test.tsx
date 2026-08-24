import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { PractitionerBookingOptions } from '@/features/booking/booking.api';

// jsdom does not implement scrollIntoView; the DateStrip's useEffect calls it
// when the slot screen mounts (same shim as features/booking/date-strip.test.tsx).
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn();

/**
 * Focused wizard test for BOOK-04: the date-strip "has slots?" probe must be
 * called with the SAME duration/delivery context as the slot fetch. The page
 * already puts selectedChoice in the days query key; this pins that the
 * queryFn actually forwards it to getPublicAvailabilityDays.
 */

const { queryFns, runtimeState, EMPLOYEE, OTHER_EMPLOYEE, SERVICE, BRANCH, OPTION, SLOT } = vi.hoisted(() => {
  const queryFns = new Map<string, (() => unknown) | undefined>();
  const runtimeState = {
    slots: [] as Array<{ startTime: string; endTime: string }>,
    employees: [] as Array<Record<string, unknown>>,
  };

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

  const slot = {
    startTime: '2026-08-20T14:00:00.000Z',
    endTime: '2026-08-20T14:45:00.000Z',
  };

  return {
    queryFns,
    runtimeState,
    EMPLOYEE: employee('emp-1', 'أحمد'),
    OTHER_EMPLOYEE: employee('emp-2', 'سارة'),
    SERVICE: service,
    BRANCH: branch,
    OPTION: option,
    SLOT: slot,
  };
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
    if (key[1] === 'employees') {
      return { data: runtimeState.employees, isLoading: false, error: null };
    }
    if (key[1] === 'catalog') return { data: { services: [SERVICE], categories: [], vatRate: 0 }, isLoading: false, error: null };
    if (key[1] === 'branches') return { data: [BRANCH], isLoading: false, error: null };
    if (key[1] === 'availability' && key[2] !== 'days') {
      return { data: runtimeState.slots, isLoading: false, error: null };
    }
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

vi.mock('@/features/booking/client-info-step', () => ({
  ClientInfoStep: ({
    onSubmitInfo,
  }: {
    onSubmitInfo: (payAtClinic: boolean) => Promise<void>;
  }) => (
    <div>
      <button type="button" onClick={() => void onSubmitInfo(true)}>
        Submit at center
      </button>
      <button type="button" onClick={() => void onSubmitInfo(false)}>
        Submit online
      </button>
    </div>
  ),
}));

vi.mock('@/features/payment/payment-redirect', () => ({
  PaymentRedirect: ({ redirectUrl }: { redirectUrl: string }) => (
    <div>Redirecting to {redirectUrl}</div>
  ),
}));

import BookingWizardPage from './page';
import {
  createBooking,
  getPublicAvailabilityDays,
  getPublicAvailability,
  getPractitionerBookingOptions,
  initPayment,
} from '@/features/booking/booking.api';

const daysMock = getPublicAvailabilityDays as ReturnType<typeof vi.fn>;
const slotsMock = getPublicAvailability as ReturnType<typeof vi.fn>;
const createBookingMock = createBooking as ReturnType<typeof vi.fn>;
const initPaymentMock = initPayment as ReturnType<typeof vi.fn>;
const practitionerOptionsMock = getPractitionerBookingOptions as ReturnType<typeof vi.fn>;

async function advanceToInfoStep() {
  fireEvent.click(await waitFor(() => screen.getByRole('radio', { name: /جلسة فردية/ })));
  fireEvent.click(await waitFor(() => screen.getByRole('radio', { name: /سارة/ })));
  fireEvent.click(await waitFor(() => screen.getByRole('button', { name: /أونلاين/ })));
  const slotGroup = await waitFor(() =>
    screen.getByRole('radiogroup', { name: /اختر الوقت|Select Time/i }),
  );
  fireEvent.click(within(slotGroup).getByRole('radio'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Submit at center' })).toBeTruthy());
}

describe('/booking wizard — date-strip days probe context', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    routerPush.mockReset();
    routerBack.mockReset();
    queryFns.clear();
    runtimeState.slots = [];
    runtimeState.employees = [EMPLOYEE, OTHER_EMPLOYEE];
    daysMock.mockReset();
    daysMock.mockResolvedValue([]);
    slotsMock.mockReset();
    slotsMock.mockResolvedValue([]);
    createBookingMock.mockReset();
    initPaymentMock.mockReset();
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

  it('confirms a pay-at-center booking without initializing Moyasar', async () => {
    runtimeState.slots = [SLOT];
    createBookingMock.mockResolvedValue({
      id: 'booking-center',
      status: 'CONFIRMED',
      invoiceId: null,
    });

    render(<BookingWizardPage />);
    await advanceToInfoStep();
    fireEvent.click(screen.getByRole('button', { name: 'Submit at center' }));

    await waitFor(() => {
      expect(createBookingMock).toHaveBeenCalledWith(
        expect.objectContaining({ payAtClinic: true }),
      );
    });
    expect(initPaymentMock).not.toHaveBeenCalled();
  });

  it('keeps online payment on the Moyasar initialization path', async () => {
    runtimeState.slots = [SLOT];
    createBookingMock.mockResolvedValue({
      id: 'booking-online',
      status: 'AWAITING_PAYMENT',
      invoiceId: 'invoice-online',
    });
    initPaymentMock.mockResolvedValue({
      paymentId: 'payment-online',
      redirectUrl: 'https://checkout.moyasar.com/pay/payment-online',
    });

    render(<BookingWizardPage />);
    await advanceToInfoStep();
    fireEvent.click(screen.getByRole('button', { name: 'Submit online' }));

    await waitFor(() => {
      expect(createBookingMock).toHaveBeenCalledWith(
        expect.objectContaining({ payAtClinic: false }),
      );
    });
    await waitFor(() => expect(initPaymentMock).toHaveBeenCalledWith('invoice-online'));
  });

  describe('booking wizard header — Sawa logo branding (BOOKING-HEADER-LOGO-1)', () => {
    it('renders the Sawa center logo as an accessible image in the header', async () => {
      render(<BookingWizardPage />);

      // Wait for the wizard to mount the header row.
      const img = (await waitFor(() =>
        screen.getByRole('img', { name: 'مركز سواء' }),
      )) as HTMLImageElement;

      // The same image is also addressable by its English alt — bilingual alt covers both locales.
      expect(img).toBe(screen.getByRole('img', { name: 'مركز سواء' }));
      expect(img.tagName).toBe('IMG');

      // The image source is the single-sourced SITE logo path (no hardcoded duplication in the page).
      // next/image rewrites /logos/sawa-logo.png into /_next/image with the original encoded as the url query param.
      expect(img.getAttribute('src') ?? '').toContain(encodeURIComponent('/logos/sawa-logo.png'));
    });

    it('does NOT render the legacy "Private & secure" / "موعد آمن وسرّي" pill in the wizard header', async () => {
      render(<BookingWizardPage />);

      // Wait until the wizard has finished mounting the header row (so we know
      // the absence is real, not a render-timing artifact).
      await waitFor(() =>
        expect(screen.queryByRole('img', { name: 'مركز سواء' })).not.toBeNull(),
      );

      const container = document.body;
      expect(container.textContent ?? '').not.toContain('موعد آمن وسرّي');
      expect(container.textContent ?? '').not.toContain('Private & secure');
      expect(screen.queryByText('موعد آمن وسرّي')).toBeNull();
      expect(screen.queryByText('Private & secure')).toBeNull();
    });

    it('does NOT wrap the Sawa logo in an anchor (must not navigate away from the wizard)', async () => {
      render(<BookingWizardPage />);

      const img = (await waitFor(() =>
        screen.getByRole('img', { name: 'مركز سواء' }),
      )) as HTMLImageElement;

      // A wrapping <a> (or Link) would unmount the wizard and destroy the
      // in-progress booking selection. This is the regression class the header
      // logo must avoid.
      expect(img.closest('a')).toBeNull();
    });
  });
});

describe('booking wizard — option-card titles (BOOKING-OPTION-LABEL-1)', () => {
  // The default test locale is AR (no LocaleProvider wrapper → context default
  // is 'ar'). Compute the expected price text at test time so the assertion is
  // robust to whichever digit set the ICU build emits (Arabic-Indic or Latin).
  // 40000 halalas with vatRate=0 → 400 SAR.
  const expectedPrice = new Intl.NumberFormat('ar-SA', {
    style: 'decimal',
    maximumFractionDigits: 2,
  }).format(400);
  const expectedCurrency = 'ر.س';

  it('renders attendance-type titles only — the backend label (service name) is ignored', async () => {
    // Two options with the SAME backend-supplied label (the service name +
    // duration the backend returns), differing only by deliveryType. This is
    // the exact bug shape: previously both cards showed the service name in
    // the title, making the two cards indistinguishable at a glance.
    practitionerOptionsMock.mockResolvedValueOnce({
      useCustomPricing: false,
      disabledDeliveryTypes: [],
      options: [
        {
          deliveryType: 'IN_PERSON',
          durationOptionId: 'opt-person',
          durationMins: 60,
          price: 40000,
          currency: 'SAR',
          label: 'تقييم نفسي أولي (60 دقيقة)',
        },
        {
          deliveryType: 'ONLINE',
          durationOptionId: 'opt-online',
          durationMins: 60,
          price: 40000,
          currency: 'SAR',
          label: 'تقييم نفسي أولي (60 دقيقة)',
        },
      ],
    });

    render(<BookingWizardPage />);

    // Drive: service → therapist → choice step.
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /جلسة فردية/ })),
    );
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /سارة/ })),
    );

    // Both attendance-type titles must render — these are the only titles
    // the user should see on the option cards.
    const inPersonButton = await waitFor(() =>
      screen.getByRole('button', { name: /حضوري/ }),
    );
    const onlineButton = await waitFor(() =>
      screen.getByRole('button', { name: /أونلاين/ }),
    );
    expect(inPersonButton).toBeTruthy();
    expect(onlineButton).toBeTruthy();

    // The service name (carried inside the backend-supplied `label`) must NOT
    // appear as part of any option-card button's accessible name. Before the
    // fix this regex matched both cards (the bug: two cards both titled
    // "تقييم نفسي أولي (60 دقيقة)").
    expect(screen.queryByRole('button', { name: /تقييم نفسي أولي/ })).toBeNull();

    // Duration still renders on the subline of each card.
    expect(inPersonButton.textContent ?? '').toContain('60 دقيقة');
    expect(onlineButton.textContent ?? '').toContain('60 دقيقة');

    // Price (value + currency label) still renders on each card.
    expect(inPersonButton.textContent ?? '').toContain(expectedPrice);
    expect(inPersonButton.textContent ?? '').toContain(expectedCurrency);
    expect(onlineButton.textContent ?? '').toContain(expectedPrice);
    expect(onlineButton.textContent ?? '').toContain(expectedCurrency);
  });

  it('does not duplicate the attendance type on the duration subline', async () => {
    practitionerOptionsMock.mockResolvedValueOnce({
      useCustomPricing: false,
      disabledDeliveryTypes: [],
      options: [
        {
          deliveryType: 'IN_PERSON',
          durationOptionId: 'opt-person',
          durationMins: 60,
          price: 40000,
          currency: 'SAR',
          label: null,
        },
        {
          deliveryType: 'ONLINE',
          durationOptionId: 'opt-online',
          durationMins: 60,
          price: 40000,
          currency: 'SAR',
          label: null,
        },
      ],
    });

    render(<BookingWizardPage />);

    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /جلسة فردية/ })),
    );
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /سارة/ })),
    );

    const inPersonButton = await waitFor(() =>
      screen.getByRole('button', { name: /حضوري/ }),
    );
    const onlineButton = await waitFor(() =>
      screen.getByRole('button', { name: /أونلاين/ }),
    );

    // The subline span text must be exactly the duration — no separator or
    // attendance-type suffix. The old code rendered "60 دقيقة · حضوري" /
    // "60 دقيقة · أونلاين" which made the two cards visually identical.
    const inPersonSubline = within(inPersonButton).getByText('60 دقيقة');
    const onlineSubline = within(onlineButton).getByText('60 دقيقة');
    expect(inPersonSubline.textContent).toBe('60 دقيقة');
    expect(onlineSubline.textContent).toBe('60 دقيقة');
  });
});

describe('booking wizard — only one step renders at a time (BOOKING-STEP-EXCLUSIVE-1)', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    routerPush.mockReset();
    routerBack.mockReset();
    queryFns.clear();
    runtimeState.slots = [];
    runtimeState.employees = [EMPLOYEE, OTHER_EMPLOYEE];
    daysMock.mockReset();
    daysMock.mockResolvedValue([]);
    slotsMock.mockReset();
    slotsMock.mockResolvedValue([]);
    createBookingMock.mockReset();
    initPaymentMock.mockReset();
  });

  it('renders only the info step at INFO_OTP — choice-step option cards are gone, info step IS rendered (exactly one step)', async () => {
    runtimeState.slots = [SLOT];
    render(<BookingWizardPage />);
    await advanceToInfoStep();

    // The info step IS in the document (the mocked ClientInfoStep renders its
    // submit button on mount).
    expect(
      screen.getByRole('button', { name: 'Submit at center' }),
    ).toBeTruthy();

    // The choice-step option cards (the attendance-type buttons rendered by
    // PractitionerChoicePicker) are NO LONGER in the document. The info step
    // must be exclusive — no other step heading can leak through.
    expect(screen.queryByRole('button', { name: /أونلاين/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /حضوري/ })).toBeNull();

    // Exactly one step heading is rendered (the choice heading "المدة والسعر"
    // must be absent from the document at INFO_OTP).
    expect(screen.queryByRole('heading', { name: 'المدة والسعر' })).toBeNull();
  });

  it('does not render the info step at the choice step — only the choice screen is mounted', async () => {
    // Slots are present so the slot step would be eligible to render — this
    // is the precise scenario the bug manifested in (pre-change, both the
    // choice screen and the slot screen rendered simultaneously at the
    // choice step).
    runtimeState.slots = [SLOT];
    render(<BookingWizardPage />);
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /جلسة فردية/ })),
    );
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /سارة/ })),
    );

    // The choice step is mounted.
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'المدة والسعر' }),
      ).toBeTruthy(),
    );

    // The info step must NOT render at the choice step.
    expect(screen.queryByRole('button', { name: 'Submit at center' })).toBeNull();

    // The slot picker must NOT also render at the choice step — the choice
    // step is exclusive. Pre-change, the slot-screen render guard keys off
    // state.step=SLOT while the choice-screen render guard keys off
    // showingChoiceStep=true, so both screens mounted together.
    expect(
      screen.queryByRole('heading', { name: /اختر الوقت|Select Time/i }),
    ).toBeNull();
  });

  it('ProgressBar counter reflects the info step ("5 من 5") once the user reaches "بياناتك" — not the choice step ("3 من 5")', async () => {
    runtimeState.slots = [SLOT];
    render(<BookingWizardPage />);
    await advanceToInfoStep();

    // The progress bar is labelled "Booking progress" and shows the current
    // step's counter as "N من 5". For the info step (5th of 5) it must read
    // "5 من 5"; pre-change a stale showingChoiceStep at INFO_OTP would have
    // shown "3 من 5" because currentScreen returned 'choice' from the raw
    // flag.
    const progressBar = screen.getByRole('navigation', {
      name: 'Booking progress',
    });
    expect(within(progressBar).getByText('5 من 5')).toBeTruthy();
    // The visible current-step label is "البيانات" (booking.step.info in
    // Arabic), rendered as the only non-sr-only label span inside the
    // progress bar. Asserting on its direct textContent avoids the sr-only
    // spans for every other step that share the same string set.
    const visibleLabel = progressBar.querySelector(
      'span.text-sm.font-extrabold.tracking-tight',
    );
    expect(visibleLabel?.textContent).toBe('البيانات');
  });
});

describe('booking wizard — single-therapist service-first path enters the choice screen (BOOKING-CHOICE-COMMIT-1)', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    routerPush.mockReset();
    routerBack.mockReset();
    queryFns.clear();
    runtimeState.slots = [];
    // Single bookable therapist for the chosen service — the auto-skip
    // shortcut must still surface the dedicated choice screen.
    runtimeState.employees = [OTHER_EMPLOYEE];
    daysMock.mockReset();
    daysMock.mockResolvedValue([]);
    slotsMock.mockReset();
    slotsMock.mockResolvedValue([]);
    createBookingMock.mockReset();
    initPaymentMock.mockReset();
    practitionerOptionsMock.mockReset();
    practitionerOptionsMock.mockResolvedValue({
      useCustomPricing: false,
      disabledDeliveryTypes: [],
      options: [OPTION],
    });
  });

  it('auto-skips the therapist step but enters the dedicated choice screen — slot radiogroup does NOT render until a choice is committed', async () => {
    const callCountBefore = practitionerOptionsMock.mock.calls.length;
    // Slots are populated from the start so the SlotPicker would render its
    // radiogroup if the page advanced past the choice step without a choice
    // commit. This is the regression we are guarding against.
    runtimeState.slots = [SLOT];
    render(<BookingWizardPage />);

    // 1. Select the single service.
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /جلسة فردية/ })),
    );

    // 2. The dedicated choice screen must mount ("المدة والسعر", step 3 of 5)
    //    — the auto-skip must NOT jump straight to the slot screen. The slot
    //    radiogroup MUST NOT render yet.
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'المدة والسعر' }),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByRole('radiogroup', { name: /اختر الوقت|Select Time/i }),
    ).toBeNull();

    // 3. The progress bar reflects the choice step as 3 of 5.
    const progressBar = screen.getByRole('navigation', {
      name: 'Booking progress',
    });
    expect(within(progressBar).getByText('3 من 5')).toBeTruthy();
    const visibleLabel = progressBar.querySelector(
      'span.text-sm.font-extrabold.tracking-tight',
    );
    expect(visibleLabel?.textContent).toBe('المدة والسعر');

    // 4. Practitioner options were fetched exactly once for the only
    //    therapist — the single-therapist path does not double-fetch and
    //    does not skip the call.
    await waitFor(() =>
      expect(practitionerOptionsMock.mock.calls.length).toBeGreaterThan(
        callCountBefore,
      ),
    );
    expect(practitionerOptionsMock.mock.calls.length).toBe(callCountBefore + 1);
    expect(practitionerOptionsMock).toHaveBeenCalledWith('svc-1', 'emp-2');

    // 5. Confirm the only option → the choice step exits and the slot
    //    radiogroup is now mounted. The availability query picks up the
    //    chosen duration/delivery context.
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: /أونلاين/ })));

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'المدة والسعر' }),
      ).toBeNull(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('radiogroup', { name: /اختر الوقت|Select Time/i }),
      ).toBeTruthy(),
    );

    // 6. The slot availability query key now carries the chosen duration
    //    option id and delivery type — confirming the committed choice
    //    reaches the availability query context.
    await waitFor(() => {
      const matched = Array.from(queryFns.keys()).some((k) =>
        k.includes('emp-2') &&
        k.includes('svc-1') &&
        k.includes('br-1') &&
        k.includes('opt-1') &&
        k.includes('ONLINE') &&
        // exclude the days probe which uses a different "availability" / "days" segment
        k.includes('"availability"') &&
        !k.includes('"days"'),
      );
      expect(matched).toBe(true);
    });
  });
});

describe('booking wizard — therapist-first path enters the dedicated choice screen (BOOKING-CHOICE-COMMIT-1)', () => {
  beforeEach(() => {
    // Deep-link: ?employeeId=emp-2 — no service yet. The user must pick a
    // service and land on the dedicated choice screen with that therapist.
    searchParams = new URLSearchParams('employeeId=emp-2');
    routerPush.mockReset();
    routerBack.mockReset();
    queryFns.clear();
    runtimeState.slots = [];
    runtimeState.employees = [OTHER_EMPLOYEE];
    daysMock.mockReset();
    daysMock.mockResolvedValue([]);
    slotsMock.mockReset();
    slotsMock.mockResolvedValue([]);
    createBookingMock.mockReset();
    initPaymentMock.mockReset();
    practitionerOptionsMock.mockReset();
    practitionerOptionsMock.mockResolvedValue({
      useCustomPricing: false,
      disabledDeliveryTypes: [],
      options: [OPTION],
    });
  });

  it('selecting a service while a therapist is carried in enters the dedicated choice screen — no inline choice UI on the service card', async () => {
    render(<BookingWizardPage />);

    // Therapist-first first paints the therapist picker; the carried
    // therapist is auto-locked so the user only sees the service step on
    // first render? Actually, the lock is set in the deep-link effect and
    // therapistStepDone is still false, so the therapist picker mounts.
    // Select the carried therapist to mark therapistStepDone=true.
    const therapistRadio = await waitFor(() =>
      screen.getByRole('radio', { name: /سارة/ }),
    );
    fireEvent.click(therapistRadio);

    // Now the service picker is mounted — locked-therapist banner present.
    const serviceRadio = await waitFor(() =>
      screen.getByRole('radio', { name: /جلسة فردية/ }),
    );

    // Sanity: the service card is a plain radio — no duration/attendance/
    // price/option-count text.
    const cardText = serviceRadio.textContent ?? '';
    expect(cardText).not.toMatch(/\d+\s*(?:min|دقيقة)/);
    expect(cardText).not.toMatch(/(?:In-person|Online|حضوري|أونلاين)/);

    // Selecting the service MUST open the dedicated choice screen, not a
    // service-level inline picker.
    fireEvent.click(serviceRadio);

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'المدة والسعر' }),
      ).toBeTruthy(),
    );

    // Sanity on the now-superseded service card: the service radio was
    // removed from the DOM when the choice screen mounted. No inline
    // choice UI is exposed on it.
    expect(screen.queryByRole('radio', { name: /جلسة فردية/ })).toBeNull();
    expect(screen.queryByText(/How would you like to attend/)).toBeNull();
    expect(screen.queryByText(/Pick a session length/i)).toBeNull();

    // Practitioner options are fetched exactly once for the carried therapist.
    await waitFor(() =>
      expect(practitionerOptionsMock).toHaveBeenCalledWith('svc-1', 'emp-2'),
    );
    expect(practitionerOptionsMock).toHaveBeenCalledTimes(1);
  });
});

describe('booking wizard — choice/summary race + latch reset corrections (BOOKING-CHOICE-COMMIT-1-CORRECTION-1)', () => {
  // Format a SAR total the same way SummaryRail does so the assertion is
  // robust to whichever digit set the ICU build emits (Arabic-Indic vs Latin).
  const formatSar = (halalas: number) =>
    new Intl.NumberFormat('ar-SA', {
      style: 'decimal',
      maximumFractionDigits: 2,
    }).format(halalas / 100);

  beforeEach(() => {
    searchParams = new URLSearchParams();
    routerPush.mockReset();
    routerBack.mockReset();
    queryFns.clear();
    runtimeState.slots = [];
    daysMock.mockReset();
    daysMock.mockResolvedValue([]);
    slotsMock.mockReset();
    slotsMock.mockResolvedValue([]);
    createBookingMock.mockReset();
    initPaymentMock.mockReset();
    practitionerOptionsMock.mockReset();
  });

  it('clears the prior therapist committed choice from the summary when the user picks a different therapist (no stale duration/delivery/total)', async () => {
    // Two therapists so we can navigate back to therapist and pick a
    // different one (single-therapist auto-skip would otherwise re-route us).
    runtimeState.employees = [EMPLOYEE, OTHER_EMPLOYEE];
    runtimeState.slots = [SLOT];
    practitionerOptionsMock.mockResolvedValue({
      useCustomPricing: false,
      disabledDeliveryTypes: [],
      options: [OPTION],
    });

    render(<BookingWizardPage />);

    // 1. svc-1 → therapist step → emp-1 (أحمد) → choice → commit ONLINE.
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /جلسة فردية/ })),
    );
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /أحمد/ })),
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'المدة والسعر' })).toBeTruthy(),
    );
    fireEvent.click(
      await waitFor(() => screen.getByRole('button', { name: /أونلاين/ })),
    );

    // 2. Now on slot step. The summary aside must show the committed total
    //    resolved from practitioner options via resolvedPriceHalalas.
    await waitFor(() =>
      expect(
        screen.getByRole('radiogroup', { name: /اختر الوقت|Select Time/i }),
      ).toBeTruthy(),
    );

    // The summary is the dedicated aside with aria-label ملخص الموعد. Scope
    // every assertion into `aside` so the choice-step buttons (which also
    // contain "أونلاين") cannot contaminate the summary checks.
    const aside = await waitFor(() =>
      screen.getByRole('complementary', { name: 'ملخص الموعد' }),
    );
    // Sanity: the aside renders the committed total. Without this baseline,
    // the negative assertion below would be vacuously true.
    expect(within(aside).getByText(formatSar(OPTION.price))).toBeTruthy();

    // 3. Back → therapist step (state.step drops back to THERAPIST, latch
    //    and choice cleared). The therapist picker is now visible.
    fireEvent.click(screen.getByRole('button', { name: 'رجوع' }));
    await waitFor(() =>
      expect(
        screen.getByRole('radiogroup', { name: /اختر المعالج|Select Therapist/i }),
      ).toBeTruthy(),
    );

    // 4. Pick emp-2 (سارة) → dedicated choice screen for emp-2 opens. Until
    //    the user commits a new option for emp-2, the summary must be empty
    //    for these fields — even though emp-1's choice was committed moments
    //    earlier and is still in the user's session memory.
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /سارة/ })),
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'المدة والسعر' })).toBeTruthy(),
    );

    // 5. CRITICAL assertion: the summary aside must NOT show emp-1's total
    //    while emp-2's choice screen is open. The committed-only summary
    //    contract is preserved across the therapist transition.
    expect(within(aside).queryByText(formatSar(OPTION.price))).toBeNull();

    // 6. The total row must show the empty-state placeholder "—" until the
    //    user commits a fresh option for emp-2. (Multiple "—" placeholders
    //    can render in the aside — slot, info, total — so we only assert
    //    the placeholder exists, not that it is unique.)
    expect(within(aside).queryAllByText('—').length).toBeGreaterThan(0);
  });

  it('ignores stale slower practitioner-options requests: newer request wins even if the older request resolves last', async () => {
    // 2 therapists; we control practitioner-options responses with deferred
    // promises so we can interleave the resolve order and prove the race
    // fix.
    runtimeState.employees = [EMPLOYEE, OTHER_EMPLOYEE];

    let resolveA!: (opts: PractitionerBookingOptions) => void;
    let resolveB!: (opts: PractitionerBookingOptions) => void;
    const promiseA = new Promise<PractitionerBookingOptions>((r) => {
      resolveA = r;
    });
    const promiseB = new Promise<PractitionerBookingOptions>((r) => {
      resolveB = r;
    });
    // First call = A (emp-1), second call = B (emp-2). Subsequent calls
    // fall back to the default mock (not exercised in this flow).
    practitionerOptionsMock
      .mockImplementationOnce(() => promiseA)
      .mockImplementationOnce(() => promiseB);

    const EMP1_OPTIONS: PractitionerBookingOptions = {
      useCustomPricing: false,
      disabledDeliveryTypes: [],
      options: [
        {
          deliveryType: 'ONLINE',
          durationOptionId: 'opt-30-emp1',
          durationMins: 30,
          price: 10000,
          currency: 'SAR',
          label: null,
        },
      ],
    };
    const EMP2_OPTIONS: PractitionerBookingOptions = {
      useCustomPricing: false,
      disabledDeliveryTypes: [],
      options: [
        {
          deliveryType: 'IN_PERSON',
          durationOptionId: 'opt-90-emp2',
          durationMins: 90,
          price: 35000,
          currency: 'SAR',
          label: null,
        },
      ],
    };

    render(<BookingWizardPage />);

    // 1. svc-1 → therapist step → emp-1 (أحمد) → request A starts. The
    //    choice screen mounts with the BookingSkeleton (loading=true,
    //    options still null).
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /جلسة فردية/ })),
    );
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /أحمد/ })),
    );
    await waitFor(() =>
      expect(practitionerOptionsMock).toHaveBeenCalledTimes(1),
    );
    // Loading state holds the choice screen — the BookingSkeleton has
    // role="status"; no option buttons exist yet because A is unresolved.
    expect(screen.queryByRole('status')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /أونلاين/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /حضوري/ })).toBeNull();

    // 2. Back to therapist step. invalidatePractitionerOptionsLoad bumps
    //    the generation so A's late resolve will be silently dropped even
    //    though no replacement request is starting on this path.
    fireEvent.click(screen.getByRole('button', { name: 'رجوع' }));
    await waitFor(() =>
      expect(
        screen.getByRole('radiogroup', { name: /اختر المعالج|Select Therapist/i }),
      ).toBeTruthy(),
    );

    // 3. Pick emp-2 (سارة) → request B starts. The shared loader bumps
    //    the generation again, permanently invalidating A.
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /سارة/ })),
    );
    await waitFor(() =>
      expect(practitionerOptionsMock).toHaveBeenCalledTimes(2),
    );

    // 4. Resolve B FIRST with emp-2 options. This is the NEWER request —
    //    it MUST land and drive the choice screen.
    resolveB(EMP2_OPTIONS);
    await waitFor(() => screen.getByRole('button', { name: /حضوري/ }));

    // 5. THEN resolve A with emp-1 options. This is the OLDER request —
    //    it MUST be ignored. The choice screen continues to show emp-2's
    //    options; emp-1's option buttons/text must not appear.
    resolveA(EMP1_OPTIONS);

    // Allow a microtask flush so any (incorrect) stale dispatch would have
    // a chance to land before we assert.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /حضوري/ })).toBeTruthy();
    });

    // emp-1's options must NEVER appear on the page. If the race guard
    // were missing, A's late resolve would overwrite the state and the
    // choice screen would start showing emp-1's ONLINE 30-min option.
    expect(screen.queryByText(/30 دقيقة/)).toBeNull();
    expect(screen.queryByRole('button', { name: /أونلاين/ })).toBeNull();

    // The committed button text must be emp-2's — 90 دقيقة, 350 SAR.
    const inPersonButton = screen.getByRole('button', { name: /حضوري/ });
    expect(inPersonButton.textContent ?? '').toContain('90 دقيقة');
    expect(inPersonButton.textContent ?? '').toContain(formatSar(35000));
  });

  it('single-therapist re-entry: back from the choice step returns through the choice screen (auto-skip re-fires), not parked on the therapist picker or jumping to slot', async () => {
    // Single therapist so the auto-skip is the only path to the choice step.
    runtimeState.employees = [OTHER_EMPLOYEE];
    practitionerOptionsMock.mockResolvedValue({
      useCustomPricing: false,
      disabledDeliveryTypes: [],
      options: [OPTION],
    });

    render(<BookingWizardPage />);

    // 1. Pick the service → auto-skip fires → choice step mounts.
    fireEvent.click(
      await waitFor(() => screen.getByRole('radio', { name: /جلسة فردية/ })),
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'المدة والسعر' })).toBeTruthy(),
    );
    expect(
      screen.queryByRole('radiogroup', { name: /اختر المعالج|Select Therapist/i }),
    ).toBeNull();

    // 2. Back from choice → therapist step (machine). With the latch reset
    //    in handleStepBack showingChoiceStep, the auto-skip RE-FIRES and
    //    the user lands on the choice step again. Without the fix the user
    //    would be parked on the therapist step with no way to advance.
    fireEvent.click(screen.getByRole('button', { name: 'رجوع' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'المدة والسعر' })).toBeTruthy(),
    );

    // 3. The therapist picker MUST NOT be visible (would indicate parking).
    expect(
      screen.queryByRole('radiogroup', { name: /اختر المعالج|Select Therapist/i }),
    ).toBeNull();

    // 4. The slot radiogroup MUST NOT be visible (would indicate jumping
    //    directly past the choice step).
    expect(
      screen.queryByRole('radiogroup', { name: /اختر الوقت|Select Time/i }),
    ).toBeNull();

    // 5. The choice-step options are still rendered (B loaded in step 1 is
    //    reused on this re-entry, but only because the request id was the
    //    same — in practice the loader re-runs).
    expect(screen.getByRole('button', { name: /أونلاين/ })).toBeTruthy();
  });
});
