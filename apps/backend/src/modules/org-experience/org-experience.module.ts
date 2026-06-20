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
import { BundlePriceService } from './bundles/bundle-price.service';
import { CreateBundleHandler } from './bundles/create-bundle.handler';
import { UpdateBundleHandler } from './bundles/update-bundle.handler';
import { ListBundlesHandler } from './bundles/list-bundles.handler';
import { GetBundleHandler } from './bundles/get-bundle.handler';
import { ArchiveBundleHandler } from './bundles/archive-bundle.handler';
import { DashboardDiscountReasonsController } from '../../api/dashboard/discount-reasons.controller';
import { ListDiscountReasonsHandler } from './discount-reasons/list-discount-reasons.handler';
import { CreateDiscountReasonHandler } from './discount-reasons/create-discount-reason.handler';
import { UpdateDiscountReasonHandler } from './discount-reasons/update-discount-reason.handler';
import { DeleteDiscountReasonHandler } from './discount-reasons/delete-discount-reason.handler';

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

const bundleHandlers = [
  CreateBundleHandler, UpdateBundleHandler, ListBundlesHandler, GetBundleHandler, ArchiveBundleHandler,
  BundlePriceService,
];

const discountReasonHandlers = [
  ListDiscountReasonsHandler, CreateDiscountReasonHandler,
  UpdateDiscountReasonHandler, DeleteDiscountReasonHandler,
];

@Module({
  imports: [DatabaseModule, MessagingModule],
  controllers: [DashboardOrganizationSettingsController, DashboardDiscountReasonsController],
  providers: [
    ...serviceHandlers,
    ...bundleHandlers,
    ...discountReasonHandlers,
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
    ...bundleHandlers,
    ...discountReasonHandlers,
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
