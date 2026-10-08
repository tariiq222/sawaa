import React from 'react';
import type { ClientPackageCredit } from '@sawaa/shared/types';
import type { DirState } from '@/hooks/useDir';

import { PackageBookingAction } from '../PackageBookingAction';
import { PackageCreditCard } from '../PackageCreditCard';
import { PackagePaymentStatus } from '../PackagePaymentStatus';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/hooks/queries/useBranding', () => ({
  useBranding: () => ({ data: undefined }),
}));

interface TestNode {
  type: unknown;
  props: {
    children?: unknown;
    accessibilityRole?: string;
    accessibilityState?: { disabled?: boolean; busy?: boolean };
    onPress?: () => void;
  };
}
interface TestRendererInstance {
  root: { findAll: (predicate: (node: TestNode) => boolean) => TestNode[] };
  update: (element: React.ReactElement) => void;
}
const TestRenderer = require('react-test-renderer') as {
  create: (element: React.ReactElement) => TestRendererInstance;
  act: (callback: () => void) => void;
};
const { act } = TestRenderer;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => ({
    'packages.locked.depleted': 'No sessions remaining',
    'packages.book': 'Book session',
    'packages.paymentPending': 'Payment is processing',
    'packages.paymentPendingDescription': 'Checking payment',
    'packages.backToBalance': 'Back to package balance',
    'packages.paymentPolling': 'Refreshing',
    'packages.confirmBooking': 'Confirm booking',
    'packages.booking': 'Booking',
  }[key] ?? key),
  }),
}));

const dir: DirState = {
  locale: 'en',
  isRTL: false,
  row: 'row',
  rowReverse: 'row-reverse',
  alignStart: 'flex-start',
  alignEnd: 'flex-end',
  textAlign: 'left',
  writingDirection: 'ltr',
  iconScaleX: 1,
};
const credit = (remaining: number): ClientPackageCredit => ({
  id: 'credit-1',
  serviceId: 'service-1',
  employeeId: 'employee-1',
  durationOptionId: 'duration-1',
  serviceNameAr: 'جلسة',
  serviceNameEn: 'Session',
  employeeNameAr: 'مختصة',
  employeeNameEn: 'Therapist',
  durationLabelAr: 'ساعة',
  durationLabelEn: '1 hour',
  durationMins: 60,
  serviceIsBookable: true,
  remaining,
  constraints: [],
  totalQuantity: 2,
  usedQuantity: 2 - remaining,
  reservedQuantity: 0,
  unitPriceSnapshot: 10000,
  availability: { bookable: true, reason: null },
});

describe('mobile package journey screens', () => {
  it('renders a locked credit without a booking action and an available credit with one', () => {
    const onBook = jest.fn();
    let renderer!: ReturnType<typeof TestRenderer.create>;
    act(() => {
      renderer = TestRenderer.create(
        <>
          <PackageCreditCard credit={credit(0)} dir={dir} f400="System" f600="System" f700="System" onBook={onBook} />
          <PackageCreditCard credit={credit(1)} dir={dir} f400="System" f600="System" f700="System" onBook={onBook} />
        </>,
      );
    });
    const text = renderer.root.findAll((node: TestNode) => node.type === 'Text' && typeof node.props.children === 'string').map((node) => node.props.children as string).join(' ');

    expect(text).toContain('No sessions remaining');
    const booking = renderer.root.findAll((node) => node.props?.accessibilityRole === 'button').find((node) => node.props?.children);
    expect(booking).toBeTruthy();
    act(() => booking?.props.onPress?.());
    expect(onBook).toHaveBeenCalledTimes(1);
  });

  it('shows pending payment and lets the client return to balance', () => {
    const onBack = jest.fn();
    let renderer!: ReturnType<typeof TestRenderer.create>;
    act(() => {
      renderer = TestRenderer.create(
        <PackagePaymentStatus state="pending" onBack={onBack} dir={dir} f400="System" f600="System" f700="System" />,
      );
    });
    const text = renderer.root.findAll((node: TestNode) => node.type === 'Text' && typeof node.props.children === 'string').map((node) => node.props.children as string).join(' ');

    expect(text).toContain('Payment is processing');
    const back = renderer.root.findAll((node) => node.props?.accessibilityRole === 'button')[0];
    act(() => back.props.onPress?.());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('submits the selected booking once and disables the action while pending', () => {
    const onPress = jest.fn();
    let renderer!: ReturnType<typeof TestRenderer.create>;
    act(() => {
      renderer = TestRenderer.create(
        <PackageBookingAction enabled pending={false} onPress={onPress} fontFamily="System" />,
      );
    });
    const button = renderer.root.findAll((node) => node.props?.accessibilityRole === 'button')[0];
    act(() => button.props.onPress?.());
    expect(onPress).toHaveBeenCalledTimes(1);

    act(() => renderer.update(<PackageBookingAction enabled pending onPress={onPress} fontFamily="System" />));
    const text = renderer.root.findAll((node: TestNode) => node.type === 'Text' && typeof node.props.children === 'string').map((node) => node.props.children as string).join(' ');
    expect(text).toContain('Confirm booking');
    const pendingButton = renderer.root.findAll((node) => node.props?.accessibilityRole === 'button')[0];
    expect(pendingButton.props.accessibilityState).toEqual({ disabled: true, busy: true });
    act(() => pendingButton.props.onPress?.());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
