import type { PackageFormData } from "./schemas/package.schema"

export const DEFAULT_PACKAGE_EDITOR_VALUES: PackageFormData = {
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionEn: "",
  imageUrl: null,
  iconName: null,
  iconBgColor: null,
  sortOrder: 0,
  isActive: true,
  isPublic: false,
  ownerEmployeeId: null,
  ownerChangeRevision: 0,
  items: [],
}
