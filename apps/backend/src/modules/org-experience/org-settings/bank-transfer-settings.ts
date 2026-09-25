import type { BankTransferAccount } from '@sawaa/shared';
import { isValidSaudiIban, normalizeSaudiIban } from '@sawaa/shared';

type OrganizationBankTransferSettings = {
  paymentBankTransferEnabled?: boolean | null;
  bankTransferAccounts?: unknown;
} | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getValidBankTransferAccounts(value: unknown): BankTransferAccount[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((account): BankTransferAccount[] => {
    if (!isRecord(account)) return [];
    const { id, label, bankName, beneficiaryName, iban } = account;
    if (
      typeof id !== 'string' || !id.trim() ||
      typeof label !== 'string' || !label.trim() ||
      typeof bankName !== 'string' || !bankName.trim() ||
      typeof beneficiaryName !== 'string' || !beneficiaryName.trim() ||
      typeof iban !== 'string' || !isValidSaudiIban(iban)
    ) return [];
    return [{
      id: id.trim(),
      label: label.trim(),
      bankName: bankName.trim(),
      beneficiaryName: beneficiaryName.trim(),
      iban: normalizeSaudiIban(iban),
    }];
  });
}

export function isClientBankTransferEnabled(settings: OrganizationBankTransferSettings): boolean {
  return settings?.paymentBankTransferEnabled === true &&
    getValidBankTransferAccounts(settings.bankTransferAccounts).length > 0;
}
