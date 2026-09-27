jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/hooks/queries', () => ({}));
jest.mock('@/hooks/useDir', () => ({}));
jest.mock('@/hooks/useA11y', () => ({}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  FadeInDown: { duration: () => ({ delay: () => ({ duration: () => ({ easing: () => undefined }) }) }) },
  Easing: { out: () => undefined, cubic: undefined },
}));

import { getAppointmentTabLabel } from '../appointments';

describe('appointment tab labels', () => {
  it('uses a tab name that includes both completed cancellations and pending requests', () => {
    expect(getAppointmentTabLabel('cancelled', false)).toBe('Cancellations');
    expect(getAppointmentTabLabel('cancelled', true)).toBe('الإلغاءات');
  });
});
