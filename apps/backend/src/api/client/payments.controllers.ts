import type { Provider, Type } from '@nestjs/common';
import { ClientInvoicesController } from './invoices.controller';
import { ClientPackagePurchasesController } from './package-purchases.controller';
import { ClientPaymentsController } from './payments.controller';
import { ClientRefundsController } from './refunds.controller';

/** Controllers for the unified /api/v1/client surface — payments area. */
export const PAYMENTS_CONTROLLERS: Type<unknown>[] = [
  ClientPaymentsController,
  ClientInvoicesController,
  ClientPackagePurchasesController,
  ClientRefundsController,
];
/**
 * Providers that only this area needs beyond what the feature modules export.
 * None: every handler comes from FinanceModule / OrgExperienceModule and
 * MinioService from the global StorageModule.
 */
export const PAYMENTS_PROVIDERS: Provider[] = [];
