/**
 * Org-experience provider rosters, kept out of the module file so it stays
 * inside the 120-line budget (MNT-20). Registration order is unchanged.
 */
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
import { CreateMobileHomeCardHandler } from './mobile-home-cards/create-mobile-home-card.handler';
import { ListMobileHomeCardsHandler } from './mobile-home-cards/list-mobile-home-cards.handler';
import { ReorderMobileHomeCardsHandler } from './mobile-home-cards/reorder-mobile-home-cards.handler';
import { UpdateMobileHomeCardHandler } from './mobile-home-cards/update-mobile-home-card.handler';
import { GetPublicMobileHomeCardsHandler } from './mobile-home-cards/get-public-mobile-home-cards.handler';
import { ListDiscountReasonsHandler } from './discount-reasons/list-discount-reasons.handler';
import { CreateDiscountReasonHandler } from './discount-reasons/create-discount-reason.handler';
import { UpdateDiscountReasonHandler } from './discount-reasons/update-discount-reason.handler';
import { DeleteDiscountReasonHandler } from './discount-reasons/delete-discount-reason.handler';
import { CreateSessionPackageHandler } from './session-packages/create-session-package/create-session-package.handler';
import { UpdateSessionPackageHandler } from './session-packages/update-session-package/update-session-package.handler';
import { ListSessionPackagesHandler } from './session-packages/list-session-packages/list-session-packages.handler';
import { GetSessionPackageHandler } from './session-packages/get-session-package/get-session-package.handler';
import { ArchiveSessionPackageHandler } from './session-packages/archive-session-package/archive-session-package.handler';
import { ListPublicPackagesHandler } from './session-packages/list-public-packages/list-public-packages.handler';
import { GetPublicPackageHandler } from './session-packages/get-public-package/get-public-package.handler';
import { CreatePackageFamilyHandler } from './package-families/create-package-family/create-package-family.handler';
import { UpdatePackageFamilyHandler } from './package-families/update-package-family/update-package-family.handler';
import { ListPackageFamiliesHandler } from './package-families/list-package-families/list-package-families.handler';
import { GetPackageFamilyHandler } from './package-families/get-package-family/get-package-family.handler';
import { ListPublicPackageFamiliesHandler } from './package-families/list-public-package-families/list-public-package-families.handler';
import { GetPublicPackageFamilyHandler } from './package-families/get-public-package-family/get-public-package-family.handler';
import { ArchivePackageFamilyHandler } from './package-families/archive-package-family/archive-package-family.handler';

export const serviceHandlers = [
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

export const discountReasonHandlers = [
  ListDiscountReasonsHandler, CreateDiscountReasonHandler,
  UpdateDiscountReasonHandler, DeleteDiscountReasonHandler,
];

export const sessionPackageHandlers = [
  CreateSessionPackageHandler,
  UpdateSessionPackageHandler,
  ListSessionPackagesHandler,
  GetSessionPackageHandler,
  ArchiveSessionPackageHandler,
  ListPublicPackagesHandler,
  GetPublicPackageHandler,
];

export const packageFamilyHandlers = [
  CreatePackageFamilyHandler,
  UpdatePackageFamilyHandler,
  ListPackageFamiliesHandler,
  GetPackageFamilyHandler,
  ListPublicPackageFamiliesHandler,
  GetPublicPackageFamilyHandler,
  ArchivePackageFamilyHandler,
];

export const mobileHomeCardHandlers = [
  CreateMobileHomeCardHandler,
  ListMobileHomeCardsHandler,
  ReorderMobileHomeCardsHandler,
  UpdateMobileHomeCardHandler,
  GetPublicMobileHomeCardsHandler,
];
