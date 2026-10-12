import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { OrgExperienceModule } from '../../modules/org-experience/org-experience.module';
import { IdentityModule } from '../../modules/identity/identity.module';
import { PeopleModule } from '../../modules/people/people.module';
import { CommsModule } from '../../modules/comms/comms.module';
import { FinanceModule } from '../../modules/finance/finance.module';
import { PROFILE_CONTROLLERS, PROFILE_PROVIDERS } from './profile.controllers';
import { BOOKINGS_CONTROLLERS, BOOKINGS_PROVIDERS } from './bookings.controllers';
import { PAYMENTS_CONTROLLERS, PAYMENTS_PROVIDERS } from './payments.controllers';
import { CHAT_CONTROLLERS, CHAT_PROVIDERS } from './chat.controllers';

/**
 * Unified, surface-agnostic client API (`/api/v1/client/*`).
 *
 * One route family for the website and the mobile app. The legacy prefixes
 * (`/public/me/*`, `/mobile/client/*`) stay as deprecated aliases until sunset;
 * see docs/architecture/client-api-unification.md §4.
 */
@Module({
  imports: [DatabaseModule, BookingsModule, PeopleModule, FinanceModule, CommsModule, OrgExperienceModule, IdentityModule],
  controllers: [...PROFILE_CONTROLLERS, ...BOOKINGS_CONTROLLERS, ...PAYMENTS_CONTROLLERS, ...CHAT_CONTROLLERS],
  providers: [...PROFILE_PROVIDERS, ...BOOKINGS_PROVIDERS, ...PAYMENTS_PROVIDERS, ...CHAT_PROVIDERS],
})
export class ClientApiModule {}
