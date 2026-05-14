'use client';

import { useReducer } from 'react';
import {
  reduce,
  INITIAL_WIZARD_STATE,
  WizardStep,
  type WizardState,
} from '@sawaa/shared';

export function useBookingWizard() {
  const [state, dispatch] = useReducer(reduce, INITIAL_WIZARD_STATE);

  return { state, dispatch };
}

export { WizardStep } from '@sawaa/shared';
export type { WizardState, WizardEvent } from '@sawaa/shared';