import type { ClientBankTransferSettings } from '@sawaa/shared';

export function isClientBankTransferAvailable(
  settings: ClientBankTransferSettings | undefined,
): boolean {
  return settings?.enabled === true && settings.accounts.length > 0;
}
