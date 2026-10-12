import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { ClientPackageCredit } from '@sawaa/shared/types';
import type { DirState } from '@/hooks/useDir';

const mockBranding: { data: { contactPhone: string | null } } = { data: { contactPhone: '0500000000' } };
jest.mock('@/hooks/queries/useBranding', () => ({ useBranding: () => mockBranding }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));

import { PackageCreditCard } from '../PackageCreditCard';

const dir = {
  locale: 'en', isRTL: false, row: 'row', rowReverse: 'row-reverse', alignStart: 'flex-start',
  alignEnd: 'flex-end', textAlign: 'left', writingDirection: 'ltr', iconScaleX: 1,
} as DirState;

const flexible = {
  id: 'c1', serviceId: null, employeeId: null, durationOptionId: null, serviceNameAr: 'رصيد', serviceNameEn: 'Credit',
  durationLabelAr: 'ساعة', durationLabelEn: '1 hour', durationMins: 60, serviceIsBookable: true, remaining: 2,
  constraints: [], totalQuantity: 2, usedQuantity: 0, reservedQuantity: 0, unitPriceSnapshot: 1,
  availability: { bookable: true, reason: null },
} as unknown as ClientPackageCredit;

const renderCard = (credit: ClientPackageCredit) =>
  render(<PackageCreditCard credit={credit} dir={dir} f400="System" f600="System" f700="System" onBook={jest.fn()} />);

describe('flexible package credit', () => {
  it('offers a call action to the center instead of a dead end', () => {
    const dial = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const view = renderCard(flexible);
    fireEvent.press(view.getByText('packages.callCenter'));
    expect(dial).toHaveBeenCalledWith('tel:0500000000');
    dial.mockRestore();
  });

  it('hides the call action when the center phone is missing', () => {
    mockBranding.data = { contactPhone: null };
    expect(renderCard(flexible).queryByText('packages.callCenter')).toBeNull();
    mockBranding.data = { contactPhone: '0500000000' };
  });
});
