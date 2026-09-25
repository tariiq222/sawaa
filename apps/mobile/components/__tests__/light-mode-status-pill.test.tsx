import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { buildTheme } from '@/theme/tokens';
import { sawaaColors } from '@/theme/sawaa/tokens';

// Renders the pill with the real light theme: `StatusPill` reads `theme.colors`,
// which is where the pre-Sawa palette used to reach the light appearance.
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light'), scheme: 'light' }),
}));

import { StatusPill } from '../ui/StatusPill';

const lightTheme = buildTheme(null, 'light');

function renderedColor(status: string, label: string): string {
  const view = render(<StatusPill status={status} label={label} />);
  return StyleSheet.flatten(view.getByText(label).props.style).color as string;
}

describe('StatusPill in the light appearance', () => {
  it('renders completed with the Sawa teal, not the old royal blue', () => {
    expect(renderedColor('completed', 'Completed')).toBe(sawaaColors.teal[700]);
    expect(renderedColor('completed', 'Completed')).not.toBe('#354FD8');
  });

  it('renders available with the Sawa teal ramp, not the old lime', () => {
    expect(renderedColor('available', 'Available')).toBe(sawaaColors.teal[500]);
    expect(renderedColor('available', 'Available')).not.toBe('#82CC17');
  });

  it('renders the positive payment and booking statuses with the Sawa teal', () => {
    expect(renderedColor('confirmed', 'Confirmed')).toBe(sawaaColors.teal[700]);
    expect(renderedColor('paid', 'Paid')).toBe(sawaaColors.teal[700]);
    expect(lightTheme.colors.success).toBe(sawaaColors.teal[700]);
  });

  it('keeps the readable attention and negative hues it shipped with', () => {
    expect(renderedColor('pending', 'Pending')).toBe('#F59E0B');
    expect(renderedColor('cancelled', 'Cancelled')).toBe('#DC2626');
    expect(renderedColor('cancel_requested', 'Cancellation requested')).toBe('#F97316');
    expect(renderedColor('refunded', 'Refunded')).toBe('#7C3AED');
    expect(renderedColor('failed', 'Failed')).toBe('#DC2626');
  });
});
