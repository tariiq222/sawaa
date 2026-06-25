import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { DashboardOrganizationSettingsController } from '../../api/dashboard/organization-settings.controller';
import { CreateServiceHandler } from './services/create-service.handler';
import { UpdateServiceHandler } from './services/update-service.handler';
import { ListServicesHandler } from './services/list-services.handler';
import { GetServiceHandler } from './services/get-service.handler';
import { ArchiveServiceHandler } from './services/archive-service.handler';
import { RestoreServiceHandler } from './services/restore-service.handler';
import { PriceResolverService } from './services/price-resolver.service';
import { GetDurationOptionsHandler } from './services/get-duration-options.handler';
import { SetDurationOptionsHandler } from './services/set-duration-options.handler';
import { SetEmployeeServiceOptionsHandler } from './services/set-employee-service-options.handler';
import { SetServiceBookingConfigsHandler } from './services/set-service-booking-configs.handler';
import { GetServiceBookingConfigsHandler } from './services/get-service-booking-configs.handler';
import { ListServiceEmployeesHandler } from './services/list-service-employees.handler';
import { SetEmployeeCustomPricingHandler } from './services/set-employee-custom-pricing/set-employee-custom-pricing.handler';
import { SetEmployeeDurationsHandler } from './services/set-employee-durations/set-employee-durations.handler';
import { SetEmployeeDeliveryTypesHandler } from './services/set-employee-delivery-types/set-employee-delivery-types.handler';
import { GetPractitionerBookingOptionsHandler } from './services/get-practitioner-booking-options/get-practitioner-booking-options.handler';
import { SetEmployeePricingModeHandler } from './services/set-employee-pricing-mode/set-employee-pricing-mode.handler';
import { GetPublicBrandingHandler } from './branding/public/get-public-branding.handler';
import { CreateIntakeFormHandler } from './intake-forms/create-intake-form.handler';
import { GetIntakeFormHandler } from './intake-forms/get-intake-form.handler';
import { ListIntakeFormsHandler } from './intake-forms/list-intake-forms.handler';
import { DeleteIntakeFormHandler } from './intake-forms/delete-intake-form.handler';
import { UpdateIntakeFormHandler } from './intake-forms/update-intake-form.handler';
import { SetIntakeFieldsHandler } from './intake-forms/set-intake-fields.handler';
import { GetIntakeFormResponsesHandler } from './intake-forms/get-intake-form-responses.handler';
import { ResolveApplicableIntakeFormsHandler } from './resolve-applicable-intake-forms/resolve-applicable-intake-forms.handler';
import { SubmitIntakeResponseHandler } from './submit-intake-response/submit-intake-response.handler';
import { SubmitRatingHandler } from './ratings/submit-rating.handler';
import { ListRatingsHandler } from './ratings/list-ratings.handler';
import { ListPublicTestimonialsHandler } from './ratings/list-public-testimonials.handler';
import { UpdateRatingVisibilityHandler } from './ratings/update-rating-visibility.handler';
import { GetOrgSettingsHandler } from './org-settings/get-org-settings.handler';
import { UpsertOrgSettingsHandler } from './org-settings/upsert-org-settings.handler';
import { GetBookingSettingsHandler } from '../bookings/get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from '../bookings/upsert-booking-settings/upsert-booking-settings.handler';
import { DashboardDiscountReasonsController } from '../../api/dashboard/discount-reasons.controller';
import { ListDiscountReasonsHandler } from './discount-reasons/list-discount-reasons.handler';
import { CreateDiscountReasonHandler } from './discount-reasons/create-discount-reason.handler';
import { UpdateDiscountReasonHandler } from './discount-reasons/update-discount-reason.handler';
import { DeleteDiscountReasonHandler } from './discount-reasons/delete-discount-reason.handler';
import { ComputePackagePriceService } from './compute-package-price.service';
import { CreateSessionPackageHandler } from './session-packages/create-session-package/create-session-package.handler';
import { UpdateSessionPackageHandler } from './session-packages/update-session-package/update-session-package.handler';
import { ListSessionPackagesHandler } from './session-packages/list-session-packages/list-session-packages.handler';
import { GetSessionPackageHandler } from './session-packages/get-session-package/get-session-package.handler';
import { ArchiveSessionPackageHandler } from './session-packages/archive-session-package/archive-session-package.handler';
import { ListPublicPackagesHandler } from './session-packages/list-public-packages/list-public-packages.handler';
import { GetPublicPackageHandler } from './session-packages/get-public-package/get-public-package.handler';

const serviceHandlers = [
  CreateServiceHandler, UpdateServiceHandler, ListServicesHandler, GetServiceHandler, ArchiveServiceHandler,
  RestoreServiceHandler,
  PriceResolverService, GetDurationOptionsHandler, SetDurationOptionsHandler, SetEmployeeServiceOptionsHandler,
  SetServiceBookingConfigsHandler, GetServiceBookingConfigsHandler,
  ListServiceEmployeesHandler,
  SetEmployeeCustomPricingHandler,
  SetEmployeeDurationsHandler,
  SetEmployeeDeliveryTypesHandler,
  GetPractitionerBookingOptionsHandler,
  SetEmployeePricingModeHandler,
];

const discountReasonHandlers = [
  ListDiscountReasonsHandler, CreateDiscountReasonHandler,
  UpdateDiscountReasonHandler, DeleteDiscountReasonHandler,
];

const sessionPackageHandlers = [
  CreateSessionPackageHandler,
  UpdateSessionPackageHandler,
  ListSessionPackagesHandler,
  GetSessionPackageHandler,
  ArchiveSessionPackageHandler,
  ListPublicPackagesHandler,
  GetPublicPackageHandler,
];

@Module({
  imports: [DatabaseModule, MessagingModule],
  controllers: [DashboardOrganizationSettingsController, DashboardDiscountReasonsController],
  providers: [
    ...serviceHandlers,
    ...discountReasonHandlers,
    ...sessionPackageHandlers,
    ComputePackagePriceService,
    GetPublicBrandingHandler,
    CreateIntakeFormHandler, GetIntakeFormHandler, ListIntakeFormsHandler, DeleteIntakeFormHandler,
    UpdateIntakeFormHandler, SetIntakeFieldsHandler, GetIntakeFormResponsesHandler,
    ResolveApplicableIntakeFormsHandler, SubmitIntakeResponseHandler,
    SubmitRatingHandler, ListRatingsHandler, ListPublicTestimonialsHandler, UpdateRatingVisibilityHandler,
    GetOrgSettingsHandler, UpsertOrgSettingsHandler,
    GetBookingSettingsHandler, UpsertBookingSettingsHandler,
  ],
  exports: [
    ...serviceHandlers,
    ...discountReasonHandlers,
    ...sessionPackageHandlers,
    ComputePackagePriceService,
    GetPublicBrandingHandler,
    CreateIntakeFormHandler, GetIntakeFormHandler, ListIntakeFormsHandler, DeleteIntakeFormHandler,
    UpdateIntakeFormHandler, SetIntakeFieldsHandler, GetIntakeFormResponsesHandler,
    ResolveApplicableIntakeFormsHandler, SubmitIntakeResponseHandler,
    SubmitRatingHandler, ListRatingsHandler, ListPublicTestimonialsHandler, UpdateRatingVisibilityHandler,
    GetOrgSettingsHandler, UpsertOrgSettingsHandler,
    GetBookingSettingsHandler, UpsertBookingSettingsHandler,
  ],
})
export class OrgExperienceModule {}
