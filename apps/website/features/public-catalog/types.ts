/**
 * Wire types for `GET /api/v1/public/services`.
 *
 * These mirror the documented response schemas in the committed OpenAPI
 * snapshot (`CatalogDepartmentDto`, `CatalogCategoryDto`, `CatalogServiceDto`,
 * `CatalogServiceDurationOptionDto`, `CatalogServiceBookingConfigDto`,
 * `PublicCatalogDto`). The website has no generated-types artifact of its own
 * (see MNT-09), so this file is the hand-maintained mirror.
 *
 * Fields that the runtime already treats as tolerant stay optional on purpose:
 * `vatRate` may be missing from an older cached response, and the catalog
 * selectors deliberately read `isActive !== false` / `archivedAt == null` /
 * `service.isHidden !== true` because a legacy response may omit those flags.
 * Required here = required by the snapshot.
 */

export interface PublicDepartment {
  id: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  icon: string | null;
  sortOrder: number;
  isVisible: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicServiceCategory {
  id: string;
  ref: number;
  departmentId: string | null;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
  bookingMode?: 'DIRECT' | 'SERVICES';
  kind?: 'CLINIC' | 'SERVICE_GROUP';
  archivedAt?: string | null;
  imageUrl: string | null;
  iconName: string | null;
  iconBgColor: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PublicDeliveryType = 'IN_PERSON' | 'ONLINE';

export interface PublicServiceDurationOption {
  id: string;
  label: string;
  durationMins: number;
  price: string;
  sortOrder: number;
}

export interface PublicServiceBookingConfig {
  id: string;
  deliveryType: PublicDeliveryType;
  price: string;
  durationMins: number;
}

export interface PublicService {
  id: string;
  /** Nullable in the schema (Prisma `Service.categoryId String?`): a service may sit outside any category. */
  categoryId: string | null;
  isHidden?: boolean;
  isActive?: boolean;
  archivedAt?: string | null;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  durationMins: number;
  price: string;
  currency: string;
  imageUrl: string | null;
  iconName: string | null;
  iconBgColor: string | null;
  showPrice?: boolean;
  showDuration?: boolean;
  durationOptions?: PublicServiceDurationOption[];
  bookingConfigs?: PublicServiceBookingConfig[];
}

export interface PublicCatalog {
  departments: PublicDepartment[];
  categories: PublicServiceCategory[];
  services: PublicService[];
  /**
   * Org VAT rate as a fraction of 1 (0 when VAT is off). Optional for tolerance: older
   * cached responses may lack the field — always read with `?? 0`.
   */
  vatRate?: number;
}
