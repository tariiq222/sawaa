import { isClientBankTransferAvailable } from '@/features/booking/payment-methods';

describe('isClientBankTransferAvailable', () => {
  const account = {
    id: 'bank-1',
    label: 'Main',
    bankName: 'Bank',
    beneficiaryName: 'Sawa',
    iban: 'SA0380000000608010167519',
  };

  it('requires the method to be enabled and at least one account', () => {
    expect(isClientBankTransferAvailable({ enabled: true, accounts: [account] })).toBe(true);
    expect(isClientBankTransferAvailable({ enabled: false, accounts: [account] })).toBe(false);
    expect(isClientBankTransferAvailable({ enabled: true, accounts: [] })).toBe(false);
    expect(isClientBankTransferAvailable(undefined)).toBe(false);
  });
});
