'use client';

import { useReducer, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reduce, INITIAL_WIZARD_STATE, WizardStep } from '@sawaa/shared';
import type { Service, EmployeeWithUser } from '@sawaa/shared';
import { ServicePicker } from '@/features/booking/service-picker';
import { TherapistPicker } from '@/features/booking/therapist-picker';
import { SlotPicker } from '@/features/booking/slot-picker';
import { BranchStep } from '@/features/booking/branch-step';
import { ClientInfoStep } from '@/features/booking/client-info-step';
import { useOtpSession } from '@/features/otp/use-otp-session';
import { publicFetch } from '@/lib/public-fetch';
import {
  getPublicAvailability,
  getPublicBranches,
  createGuestBooking,
  initGuestPayment,
  type PublicBranch,
} from '@/features/booking/booking.api';
import { PaymentRedirect } from '@/features/payment/payment-redirect';
import { BookingSkeleton } from '@/features/booking/booking-skeleton';
import { useT } from '@/features/locale/locale-provider';

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', direction: 'rtl' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={`progress-${i}`}
          style={{
            flex: 1,
            height: '4px',
            borderRadius: '2px',
            background:
              i <= current
                ? 'var(--primary)'
                : 'color-mix(in srgb, var(--primary) 15%, transparent)',
          }}
        />
      ))}
    </div>
  );
}

export default function BookingWizardPage() {
  const t = useT();
  const [state, dispatch] = useReducer(reduce, INITIAL_WIZARD_STATE);
  // Whether we are on the intermediate branch-selection step (between THERAPIST and SLOT).
  const [awaitingBranch, setAwaitingBranch] = useState(false);
  const [pendingEmployee, setPendingEmployee] = useState<EmployeeWithUser | null>(null);


  const [selectedBranch, setSelectedBranch] = useState<PublicBranch | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(
    todayLocalIso(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const { token } = useOtpSession();

  // React Query: fetch initial data with caching, deduping, and error handling
  const { data: employees = [], isLoading: loadingEmployees, error: employeesError } = useQuery({
    queryKey: ['public', 'employees'],
    queryFn: async () => {
      const json = await publicFetch<{ data?: EmployeeWithUser[] } | EmployeeWithUser[]>('/public/employees');
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  const { data: services = [], isLoading: loadingServices, error: servicesError } = useQuery({
    queryKey: ['public', 'services'],
    queryFn: async () => {
      const json = await publicFetch<{ data?: { services: Service[] } } | { services: Service[] }>('/public/services');
      const payload = 'data' in json && json.data ? json.data : (json as { services: Service[] });
      return payload.services ?? [];
    },
  });

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['public', 'branches'],
    queryFn: getPublicBranches,
  });

  const loadingData = loadingEmployees || loadingServices || loadingBranches;
  const loadError = employeesError?.message ?? servicesError?.message ?? null;

  const service =
    state.step === WizardStep.THERAPIST ||
    state.step === WizardStep.SLOT ||
    state.step === WizardStep.INFO_OTP ||
    state.step === WizardStep.PAYMENT
      ? state.service
      : null;
  const employee =
    state.step === WizardStep.SLOT ||
    state.step === WizardStep.INFO_OTP ||
    state.step === WizardStep.PAYMENT
      ? state.employee
      : null;
  const slot =
    state.step === WizardStep.INFO_OTP || state.step === WizardStep.PAYMENT
      ? state.slot
      : null;

  const hasBranchStep = branches.length > 1;
  const totalSteps = hasBranchStep ? 5 : 4;

  // Single-branch orgs skip BranchStep; default to the only branch so we
  // never send `branchId: ''` to the backend (which rejects with 400 — the
  // DTO is @IsUUID()). For multi-branch orgs, fall back to the user's
  // explicit selection.
  const effectiveBranch = selectedBranch ?? (!hasBranchStep ? branches[0] ?? null : null);
  const effectiveBranchId = effectiveBranch?.id;

  const stepIndex = (() => {
    if (awaitingBranch) return 2;
    switch (state.step) {
      case WizardStep.SERVICE: return 0;
      case WizardStep.THERAPIST: return 1;
      case WizardStep.SLOT: return hasBranchStep ? 3 : 2;
      case WizardStep.INFO_OTP: return hasBranchStep ? 4 : 3;
      default: return totalSteps - 1;
    }
  })();

  const employeeId = employee?.id;
  const serviceId = service?.id;

  const branchId = effectiveBranchId;
  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['public', 'availability', employeeId, selectedDate, serviceId, branchId],
    queryFn: () => getPublicAvailability(employeeId!, selectedDate, serviceId, branchId),
    enabled: state.step === WizardStep.SLOT && !!employeeId && !!branchId,
  });

  if (redirectUrl && bookingId) {
    return <PaymentRedirect redirectUrl={redirectUrl} bookingId={bookingId} />;
  }

  const handleEmployeeSelect = (emp: EmployeeWithUser) => {
    if (hasBranchStep) {
      setPendingEmployee(emp);
      setAwaitingBranch(true);
    } else {
      dispatch({ type: 'SELECT_EMPLOYEE', employee: emp });
    }
  };

  const handleBranchSelect = (branch: PublicBranch) => {
    setSelectedBranch(branch);
    setAwaitingBranch(false);
    dispatch({ type: 'SELECT_EMPLOYEE', employee: pendingEmployee! });
  };

  const backBtn = (onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
        borderRadius: 'var(--radius)',
        padding: '0.5rem 1rem',
        cursor: 'pointer',
        alignSelf: 'start',
      }}
    >
      {t('booking.back')}
    </button>
  );

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem' }}>
      <ProgressBar current={stepIndex} total={totalSteps} />

      {(loadError || submitError) && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
            borderRadius: 'var(--radius)',
            color: 'var(--destructive)',
            fontSize: '0.875rem',
          }}
        >
          {loadError || submitError}
        </div>
      )}

      {state.step === WizardStep.SERVICE && (
        loadingData ? (
          <BookingSkeleton count={4} />
        ) : (
          <ServicePicker
            services={services}
            selected={null}
            onSelect={(svc) => dispatch({ type: 'SELECT_SERVICE', service: svc })}
          />
        )
      )}

      {state.step === WizardStep.THERAPIST && !awaitingBranch && service && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {backBtn(() => dispatch({ type: 'RESET' }))}
          {loadingData ? (
            <BookingSkeleton count={4} />
          ) : (
            <TherapistPicker therapists={employees} selected={null} onSelect={handleEmployeeSelect} />
          )}
        </div>
      )}

      {awaitingBranch && (
        <BranchStep
          branches={branches}
          onSelect={handleBranchSelect}
          onBack={() => {
            setAwaitingBranch(false);
            setPendingEmployee(null);
          }}
        />
      )}

      {state.step === WizardStep.SLOT && !awaitingBranch && service && employee && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {backBtn(() => {
            if (hasBranchStep) {
              setPendingEmployee(employee);
              setAwaitingBranch(true);
            } else {
              dispatch({ type: 'SELECT_EMPLOYEE', employee });
            }
          })}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              {t('booking.selectDate')}
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={todayLocalIso()}
              suppressHydrationWarning
              style={{
                padding: '0.5rem',
                border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                borderRadius: 'var(--radius)',
              }}
            />
          </div>
          <SlotPicker
            slots={slots}
            selected={null}
            onSelect={(s) => dispatch({ type: 'SELECT_SLOT', slot: s })}
            isLoading={loadingSlots}
          />
        </div>
      )}

      {state.step === WizardStep.INFO_OTP && service && employee && slot && (
        <ClientInfoStep
          slot={slot}
          onBack={() => dispatch({ type: 'SELECT_SLOT', slot })}
          onSubmitInfo={async (client) => {
            if (!token) return;
            setIsSubmitting(true);
            setSubmitError(null);
            try {
              if (!effectiveBranchId) {
                setSubmitError(t('booking.errors.missingBranch'));
                setIsSubmitting(false);
                return;
              }
              const booking = await createGuestBooking(
                {
                  serviceId: service.id,
                  employeeId: employee.id,
                  branchId: effectiveBranchId,
                  startsAt: slot.startTime,
                  client,
                },
                token,
              );
              const payment = await initGuestPayment(booking.bookingId, token);
              setBookingId(booking.bookingId);
              setRedirectUrl(payment.redirectUrl);
            } catch (err) {
              setSubmitError(err instanceof Error ? err.message : t('common.bookingFailed'));
            } finally {
              setIsSubmitting(false);
            }
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {state.step === WizardStep.CONFIRMATION && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          {state.status === 'success' ? (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
                {t('booking.confirmed')}
              </h2>
              <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
                {t('booking.confirmedDesc')}
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
                {t('booking.paymentFailed')}
              </h2>
              <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
                {t('booking.paymentFailedDesc')}
              </p>
            </>
          )}
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            style={{
              padding: '0.875rem 2rem',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {state.status === 'success' ? t('booking.bookAnother') : t('booking.tryAgain')}
          </button>
        </div>
      )}
    </div>
  );
}
