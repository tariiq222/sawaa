import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Building2 } from 'lucide-react-native';

jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ row: 'row-reverse', textAlign: 'right', isRTL: true }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key === 'home.seeAll' ? 'عرض الكل' : key }) }));

import { HomeSectionHeading } from '../HomeSectionHeading';

it('uses an icon action to open the full section without a visible see-all label', () => {
  const onSeeAll = jest.fn();
  const screen = render(<HomeSectionHeading title="العيادات" symbol="building.2.fill" icon={Building2} onSeeAll={onSeeAll} />);
  expect(screen.getByText('العيادات')).toBeTruthy();
  expect(screen.queryByText('عرض الكل')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'العيادات — عرض الكل' }));
  expect(onSeeAll).toHaveBeenCalledTimes(1);
});
