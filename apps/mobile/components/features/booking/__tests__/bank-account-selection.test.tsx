import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { BankTransferAccount } from '@sawaa/shared';

jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'dark' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('dark') }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import { BankTransferAccountDetails } from '../BankTransferAccountDetails';

const accounts: BankTransferAccount[] = [
  { id: 'first', label: 'First account', bankName: 'Bank', beneficiaryName: 'Sawa', iban: 'SA0000000000000000000001' },
  { id: 'second', label: 'Second account', bankName: 'Bank', beneficiaryName: 'Sawa', iban: 'SA0000000000000000000002' },
];

it('shows one visible selected cue and changes the account through the existing callback', () => {
  const onSelectAccount = jest.fn();
  const view = render(<BankTransferAccountDetails accounts={accounts} selectedAccountId="first" onSelectAccount={onSelectAccount} amountLabel="125 SAR" />);
  expect(view.getAllByTestId('bank-account-selected-check')).toHaveLength(1);
  fireEvent.press(view.getByRole('radio', { name: 'Second account' }));
  expect(onSelectAccount).toHaveBeenCalledWith('second');
  view.rerender(<BankTransferAccountDetails accounts={accounts} selectedAccountId="second" onSelectAccount={onSelectAccount} amountLabel="125 SAR" />);
  expect(view.getByRole('radio', { name: 'Second account' })).toHaveProp('accessibilityState', { selected: true });
  expect(view.getByRole('radio', { name: 'First account' })).toHaveProp('accessibilityState', { selected: false });
  expect(view.getAllByTestId('bank-account-selected-check')).toHaveLength(1);
});
