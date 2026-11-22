import type { InitPackagePurchaseDto } from './init-package-purchase.dto';

/** The self-purchase command: the DTO plus the authenticated client id. */
export type InitPackagePurchaseCommand = InitPackagePurchaseDto & {
  /** Authenticated client id (set by the controller from the client session). */
  clientId: string;
};

export interface InitPackagePurchaseResult {
  purchaseId: string;
  invoiceId: string;
  paymentId: string;
  redirectUrl: string;
}
