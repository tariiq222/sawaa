import { MediaModule } from '../media/media.module';
import { Module } from '@nestjs/common';
import { serviceHandlers, discountReasonHandlers, sessionPackageHandlers, packageFamilyHandlers, mobileHomeCardHandlers } from './org-experience.handlers';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { DashboardOrganizationServicesController } from '../../api/dashboard/organization-services.controller';
import { DashboardOrganizationIntakeFormsController } from '../../api/dashboard/organization-intake-forms.controller';
import { DashboardOrganizationPackagesController } from '../../api/dashboard/organization-packages.controller';
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
import { GetClientBankTransferSettingsHandler } from './org-settings/get-client-bank-transfer-settings.handler';
import { DashboardDiscountReasonsController } from '../../api/dashboard/discount-reasons.controller';
import { DashboardMobileHomeCardsController } from '../../api/dashboard/mobile-home-cards.controller';
import { ComputePackagePriceService } from './compute-package-price.service';
import { GetPublicCatalogHandler } from './public-catalog/get-public-catalog.handler';
import { DashboardPackageFamiliesController } from '../../api/dashboard/package-families.controller';

@Module({
  imports: [MediaModule, DatabaseModule, MessagingModule],
  controllers: [DashboardOrganizationServicesController, DashboardOrganizationIntakeFormsController, DashboardOrganizationPackagesController, DashboardDiscountReasonsController, DashboardPackageFamiliesController, DashboardMobileHomeCardsController],
  providers: [
    ...serviceHandlers,
    ...discountReasonHandlers,
    ...sessionPackageHandlers,
    ...packageFamilyHandlers,
    ...mobileHomeCardHandlers,
    ComputePackagePriceService,
    GetPublicBrandingHandler,
    GetPublicCatalogHandler,
    CreateIntakeFormHandler, GetIntakeFormHandler, ListIntakeFormsHandler, DeleteIntakeFormHandler,
    UpdateIntakeFormHandler, SetIntakeFieldsHandler, GetIntakeFormResponsesHandler,
    ResolveApplicableIntakeFormsHandler, SubmitIntakeResponseHandler,
    SubmitRatingHandler, ListRatingsHandler, ListPublicTestimonialsHandler, UpdateRatingVisibilityHandler,
    GetOrgSettingsHandler, UpsertOrgSettingsHandler, GetClientBankTransferSettingsHandler,
  ],
  exports: [
    ...serviceHandlers,
    ...discountReasonHandlers,
    ...sessionPackageHandlers,
    ...packageFamilyHandlers,
    ...mobileHomeCardHandlers,
    ComputePackagePriceService,
    GetPublicBrandingHandler,
    GetPublicCatalogHandler,
    CreateIntakeFormHandler, GetIntakeFormHandler, ListIntakeFormsHandler, DeleteIntakeFormHandler,
    UpdateIntakeFormHandler, SetIntakeFieldsHandler, GetIntakeFormResponsesHandler,
    ResolveApplicableIntakeFormsHandler, SubmitIntakeResponseHandler,
    SubmitRatingHandler, ListRatingsHandler, ListPublicTestimonialsHandler, UpdateRatingVisibilityHandler,
    GetOrgSettingsHandler, UpsertOrgSettingsHandler, GetClientBankTransferSettingsHandler,
  ],
})
export class OrgExperienceModule {}
