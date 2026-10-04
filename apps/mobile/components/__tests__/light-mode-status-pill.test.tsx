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

  it('renders available with readable Sawa teal, not the old lime', () => {
    expect(renderedColor('available', 'Available')).toBe(lightTheme.colors.statusForeground?.available);
    expect(renderedColor('available', 'Available')).not.toBe('#82CC17');
  });

  it('renders the positive payment and booking statuses with the Sawa teal', () => {
    expect(renderedColor('confirmed', 'Confirmed')).toBe(lightTheme.colors.statusForeground?.confirmed);
    expect(renderedColor('paid', 'Paid')).toBe(lightTheme.colors.statusForeground?.paid);
    expect(lightTheme.colors.success).toBe(sawaaColors.teal[700]);
  });

  it('uses the dedicated readable status foregrounds', () => {
    expect(renderedColor('pending', 'Pending')).toBe(lightTheme.colors.statusForeground?.pending);
    expect(renderedColor('cancelled', 'Cancelled')).toBe(lightTheme.colors.statusForeground?.cancelled);
    expect(renderedColor('cancel_requested', 'Cancellation requested')).toBe(lightTheme.colors.statusForeground?.pendingCancellation);
    expect(renderedColor('refunded', 'Refunded')).toBe(lightTheme.colors.statusForeground?.refunded);
    expect(renderedColor('failed', 'Failed')).toBe(lightTheme.colors.statusForeground?.failed);
  });
});
