import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { OrgExperienceModule } from '../../modules/org-experience/org-experience.module';
import { IdentityModule } from '../../modules/identity/identity.module';
import { PeopleModule } from '../../modules/people/people.module';
import { CommsModule } from '../../modules/comms/comms.module';
import { FinanceModule } from '../../modules/finance/finance.module';
import { AuthController } from './auth.controller';
import { PublicAuthController } from './public-auth.controller';
import { PublicMeController } from './me.controller';
import { PublicBrandingController } from './branding.controller';
import { PublicCatalogController } from './catalog.controller';
import { PublicSlotsController } from './slots.controller';
import { PublicEmployeesController } from './employees.controller';
import { PublicContactMessagesController } from './contact-messages.controller';
import { PublicOtpController } from './otp.controller';
import { PublicAvailabilityController } from './availability.controller';
import { PublicBookingsController } from './bookings.controller';
import { PublicIntakeFormsController } from './intake-forms.controller';
import { PublicPaymentsController } from './payments.controller';
import { PublicBranchesController } from './branches.controller';
import { PublicInvoicesController } from './invoices.controller';
import { PublicRefundsController } from './refunds.controller';
import { PublicSmsWebhooksController } from './sms-webhooks.controller';

import { PublicPaymentWebhookController } from './payment-webhook.controller';
import { PublicVerifyEmailController } from './verify-email.controller';
import { OrgConfigModule } from '../../modules/org-config/org-config.module';
import { PlatformModule } from '../../modules/platform/platform.module';
import { OpsModule } from '../../modules/ops/ops.module';
import { PublicHealthController } from './health.controller';
import { PublicTestimonialsController } from './testimonials.controller';
import { AppMetricsService } from '../../infrastructure/telemetry/app-metrics.service';
import { DbMetricsService } from '../../infrastructure/telemetry/db-metrics.service';
import { PublicMetricsController } from './metrics.controller';

@Module({
  imports: [DatabaseModule, BookingsModule, OrgExperienceModule, IdentityModule, PeopleModule, CommsModule, FinanceModule, OrgConfigModule, PlatformModule, OpsModule],
  controllers: [AuthController, PublicAuthController, PublicMeController, PublicBrandingController, PublicCatalogController, PublicSlotsController, PublicEmployeesController, PublicContactMessagesController, PublicOtpController, PublicAvailabilityController, PublicBookingsController, PublicIntakeFormsController, PublicPaymentsController, PublicBranchesController, PublicInvoicesController, PublicRefundsController, PublicSmsWebhooksController, PublicPaymentWebhookController, PublicVerifyEmailController, PublicHealthController, PublicMetricsController, PublicTestimonialsController],
  providers: [AppMetricsService, DbMetricsService],
})
export class PublicModule {}
