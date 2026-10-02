export type ClinicBookingEntry =
  | { kind: 'therapist'; serviceId: string; steps: 3 }
  | { kind: 'service'; steps: 4 }
  | { kind: 'misconfigured' };

/** First booking step for a clinic. See docs/architecture/clinic-service-booking-contract.md. */
export function clinicBookingEntry(
  clinic: { bookingMode: 'DIRECT' | 'SERVICES'; directServiceId: string | null },
): ClinicBookingEntry {
  if (clinic.bookingMode === 'SERVICES') return { kind: 'service', steps: 4 };
  // Never fall back to a visible service when the hidden internal one is missing.
  return clinic.directServiceId
    ? { kind: 'therapist', serviceId: clinic.directServiceId, steps: 3 }
    : { kind: 'misconfigured' };
}

export type BookingScreen = 'service' | 'therapist' | 'time' | 'confirm';

function parseSteps(steps?: string): 2 | 3 | 4 {
  return steps === '4' ? 4 : steps === '3' ? 3 : 2;
}

/** `steps` is the raw route param. Missing/invalid → legacy 2-step numbering. */
export function bookingStep(screen: BookingScreen, steps?: string): { step: number; total: number } {
  const total = parseSteps(steps);
  const fromEnd = screen === 'confirm' ? 0 : screen === 'time' ? 1 : screen === 'therapist' ? 2 : 3;
  return { step: Math.max(1, total - fromEnd), total };
}

/** Total to pass on when the therapist step is skipped (single therapist). */
export function stepsAfterSkip(steps?: string): string | undefined {
  const total = parseSteps(steps);
  return steps === undefined ? undefined : String(Math.max(2, total - 1));
}
