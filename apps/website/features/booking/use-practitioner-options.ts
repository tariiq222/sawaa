'use client';

import { useCallback, useMemo, useRef } from 'react';
import { getPractitionerBookingOptions } from '@/features/booking/booking.api';
import type { UiAction } from '@/features/booking/booking-wizard-state';
import { useWizardMountedRef } from '@/features/booking/use-booking-wizard-effects';

type UiDispatch = (action: UiAction) => void;

/**
 * Owns the practitioner-options fetch: the monotonic request generation, the
 * mounted guard, and the exact dispatch sequence (clear options → loading →
 * choice screen → write back only if still latest). Behaviour is unchanged
 * from the pre-split inline loader.
 */
export function usePractitionerOptions(dispatchUi: UiDispatch) {
  // Monotonic request generation for the practitioner-options fetch. Every
  // load captures the current value and only writes back if it is still the
  // latest — older in-flight loads observe a mismatch on resolve or fail
  // and bail. This is the only mechanism that guarantees a stale slower
  // request cannot overwrite options for a newer pair after back/reselect.
  const practitionerOptionsRequestRef = useRef(0);
  // Mounted-ref guard so an in-flight load that resolves after the wizard
  // unmounts does not dispatch into an unmounted tree.
  const mountedRef = useRef(true);
  useWizardMountedRef(mountedRef, practitionerOptionsRequestRef);

  /**
   * Shared practitioner-options loader. Bumps the monotonic request
   * generation so any older in-flight load observes a stale id on resolve
   * or fail and bails. Used by both the therapist-first
   * `handleServiceSelect` (carried therapist) and
   * `selectTherapistAndLoadOptions` so they take the same
   * sequencing/invalidation contract.
   *
   * The loader owns the entire fetch + UI sequence: it clears any prior
   * options, marks loading=true, enters the choice step, awaits the fetch,
   * and only writes options / clears loading if its generation is still the
   * latest. Callers must clear `selectedChoice` before invoking this helper
   * so the summary reflects the new therapist context.
   */
  const loadPractitionerOptions = useCallback((svcId: string, empId: string) => {
    practitionerOptionsRequestRef.current += 1;
    const myRequestId = practitionerOptionsRequestRef.current;
    dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS', opts: null });
    dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS_LOADING', loading: true });
    dispatchUi({ type: 'ENTER_CHOICE_STEP' });
    void (async () => {
      try {
        const opts = await getPractitionerBookingOptions(svcId, empId);
        if (practitionerOptionsRequestRef.current !== myRequestId) return;
        if (!mountedRef.current) return;
        dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS', opts });
      } catch {
        if (practitionerOptionsRequestRef.current !== myRequestId) return;
        if (!mountedRef.current) return;
        // Preserve existing failure behavior: the LATEST failed request
        // stores null options; stale failures are ignored.
        dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS', opts: null });
      } finally {
        if (practitionerOptionsRequestRef.current !== myRequestId) return;
        if (!mountedRef.current) return;
        // Only the latest load may end the loading state — a stale load
        // must not silently clear a newer load's spinner.
        dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS_LOADING', loading: false });
      }
    })();
  }, [dispatchUi]);

  /**
   * Invalidate any in-flight practitioner-options load WITHOUT starting a
   * replacement. Used by back / reset / unmount paths that need a late
   * response to never repopulate options on an earlier screen.
   */
  const invalidatePractitionerOptionsLoad = useCallback(() => {
    practitionerOptionsRequestRef.current += 1;
  }, []);

  return useMemo(
    () => ({ loadPractitionerOptions, invalidatePractitionerOptionsLoad }),
    [loadPractitionerOptions, invalidatePractitionerOptionsLoad],
  );
}
