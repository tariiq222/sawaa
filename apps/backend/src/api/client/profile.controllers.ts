import type { Provider, Type } from '@nestjs/common';
import { ClientEmailController, ClientPhoneController, ClientProfileController } from './profile.controller';
import { ClientNotificationsController } from './notifications.controller';
import { ClientPortalController } from './portal.controller';

/** Controllers for the unified /api/v1/client surface — profile area. */
export const PROFILE_CONTROLLERS: Type<unknown>[] = [
  ClientProfileController,
  ClientEmailController,
  ClientPhoneController,
  ClientNotificationsController,
  ClientPortalController,
];
/** Providers that only this area needs beyond what the feature modules export. */
export const PROFILE_PROVIDERS: Provider[] = [];
