import type { Provider, Type } from '@nestjs/common';
import { ClientBookingsController } from './bookings.controller';
import { ClientProgramsController } from './programs.controller';
import { ClientPackagesController } from './packages.controller';
import { ClientPackageBookHandler } from '../../modules/bookings/client/client-package-book.handler';
import { ClientPackagePurchaseStatusHandler } from '../../modules/bookings/client/client-package-purchase-status.handler';

/** Controllers for the unified /api/v1/client surface — bookings area. */
export const BOOKINGS_CONTROLLERS: Type<unknown>[] = [
  ClientBookingsController,
  ClientProgramsController,
  ClientPackagesController,
];
/** Providers that only this area needs beyond what the feature modules export. */
export const BOOKINGS_PROVIDERS: Provider[] = [ClientPackageBookHandler, ClientPackagePurchaseStatusHandler];
