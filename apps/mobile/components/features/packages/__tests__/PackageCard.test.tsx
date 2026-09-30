import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { PackageFamily } from '@sawaa/shared/types';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left' }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { count?: number }) => (options?.count !== undefined ? `${key} ${options.count}` : key) }),
}));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children }: React.PropsWithChildren) => require('react').createElement(require('react-native').View, null, children),
}));

import { PackageCard } from '../PackageCard';

function option(id: string, sessionCount: number, finalPrice: number) {
  return { id, nameAr: id, nameEn: id, sessionCount, price: { finalPrice }, displayGroups: [] } as unknown as PackageFamily['options'][number];
}

const base = { id: 'family', nameAr: 'باقة', nameEn: 'Care package', descriptionAr: null, descriptionEn: 'Sessions over time', isStandalone: false };

describe('PackageCard', () => {
  it('shows the lowest option price and real feature lines, and opens the family', () => {
    const onPress = jest.fn();
    const screen = render(<PackageCard family={{ ...base, options: [option('big', 8, 120000), option('small', 4, 70000)] }} onPress={onPress} />);
    expect(screen.getByText('Care package')).toBeTruthy();
    expect(screen.getByText('Sessions over time')).toBeTruthy();
    expect(screen.getByText('packages.startsFrom')).toBeTruthy();
    expect(screen.getByText('700.00 SAR')).toBeTruthy();
    expect(screen.getByText('packages.optionsCount 2')).toBeTruthy();
    expect(screen.getByText('packages.sessionsFrom 4')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'packages.buy' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not claim a popularity or validity the catalog does not provide', () => {
    const screen = render(<PackageCard family={{ ...base, options: [option('only', 6, 50000)] }} onPress={jest.fn()} />);
    expect(screen.queryByText('packages.startsFrom')).toBeNull();
    expect(screen.getByText('500.00 SAR')).toBeTruthy();
    expect(screen.getByText('packages.sessionCount 6')).toBeTruthy();
    expect(screen.queryByText(/popular|valid/i)).toBeNull();
  });
});
