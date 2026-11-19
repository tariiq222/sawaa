import type { AvailableSlot, Service, EmployeeWithUser } from '@sawaa/shared';
import type { PublicPaymentMethods } from '@/features/booking/booking.api';

/**
 * Types, class tokens and the two tiny presentational helpers used by
 * `client-info-step.tsx`. Moved verbatim; the step's markup stays untouched.
 */

export interface ClientInfoStepProps {
  slot: AvailableSlot;
  service: Service;
  employee: EmployeeWithUser;
  /**
   * Fractional org VAT rate (a fraction of 1, 0 when VAT is off). Display-only: the total is shown
   * VAT-inclusive when > 0; the backend computes the real invoice.
   */
  vatRate?: number;
  /**
   * Pre-tax price in halalas for the chosen duration option. When provided,
   * this overrides service.price so the displayed total matches what the
   * backend derives from durationOptionId. Falls back to service.price when
   * absent (e.g. services with no duration options).
   */
  selectedPriceHalalas?: number;
  /** @deprecated back is handled by the wizard header — kept for compatibility */
  onBack?: () => void;
  /**
   * Payment capabilities for this deployment. `undefined` while the lookup is
   * still in flight or after it failed: a paid booking is never submitted on a
   * guess, because the backend rejects a disabled method outright (400) and the
   * whole booking is lost.
   */
  paymentMethods: PublicPaymentMethods | undefined;
  /** True only while the capability lookup is in flight (drives the copy). */
  paymentMethodsLoading: boolean;
  /** Confirm the booking using the selected collection path. */
  onSubmitInfo: (payAtClinic: boolean) => void;
  isSubmitting: boolean;
}

export type WebsitePaymentMethod = 'ONLINE' | 'AT_CENTER';

export const fieldLabelClass = 'block text-[0.8125rem] font-bold mb-2';
export const fieldLabelStyle = {
  color: 'var(--sw-secondary-700)',
};

export const baseInputClass =
  'w-full ps-11 pe-3.5 py-3.5 text-[0.9375rem] rounded-xl bg-[var(--surface)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 placeholder:opacity-40';

export function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    border: invalid
      ? '1.5px solid var(--error)'
      : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
    color: 'var(--sw-secondary-700)',
    fontWeight: 500,
  };
}

export function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 -translate-y-1/2 start-3.5 grid place-items-center pointer-events-none"
      style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 50%, transparent)' }}
    >
      {children}
    </span>
  );
}
