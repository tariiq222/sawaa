import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { getSawaaColors, getSawaaRoles } from '@/theme/sawaa/tokens';
import { PackageBookingAction } from '../PackageBookingAction';
import { PackagePaymentStatus } from '../PackagePaymentStatus';

jest.mock('@/theme/sawaa', () => jest.requireActual('@/theme/sawaa/tokens'));

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ scheme: mockScheme }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => { mockScheme = 'light'; });

it('updates payment copy on appearance changes without remounting', () => {
  const element = <PackagePaymentStatus state="pending" onBack={jest.fn()} dir={{ textAlign: 'left' }} f400="System" f600="System" f700="System" />;
  const view = render(element);
  expect(view.getByText('packages.paymentPending')).toHaveStyle({ color: getSawaaColors('light').ink[900] });
  mockScheme = 'dark';
  view.rerender(React.cloneElement(element));
  expect(view.getByText('packages.paymentPending')).toHaveStyle({ color: getSawaaColors('dark').ink[900] });
  expect(view.getByText('packages.paymentPendingDescription')).toHaveStyle({ color: getSawaaColors('dark').ink[500] });
});

it.each(['light', 'dark'] as const)('pairs an opaque action label with action fill in %s mode and preserves disabled behavior', (scheme) => {
  mockScheme = scheme;
  const onPress = jest.fn();
  const view = render(<PackageBookingAction enabled pending={false} onPress={onPress} fontFamily="System" />);
  const action = getSawaaRoles(scheme).action;
  expect(view.getByRole('button')).toHaveStyle({ backgroundColor: action.fill });
  expect(view.getByText('packages.confirmBooking')).toHaveStyle({ color: action.foreground });
  fireEvent.press(view.getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
  view.rerender(<PackageBookingAction enabled pending onPress={onPress} fontFamily="System" />);
  fireEvent.press(view.getByRole('button'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
