import type { PublicCatalogRaw } from '@/services/client/catalog';

const normalize = (value: string) => value.normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g, '').replace(/أ|إ|آ/g, 'ا').trim().toLowerCase().replace(/\s+/g, ' ');
const assessmentNames = new Set([
  'القياس والتقويم', 'خدمات القياس والتقويم', 'القياس والتقييم', 'خدمات القياس والتقييم',
  'Assessment & Evaluation', 'measurement and evaluation', 'assessment and evaluation', 'psychological assessments',
].map(normalize));
const isAssessmentGroup = (row: { nameAr: string; nameEn: string | null }) =>
  assessmentNames.has(normalize(row.nameAr)) || (row.nameEn != null && assessmentNames.has(normalize(row.nameEn)));

/** Resolve the existing named catalog group, then join services by categoryId.
 * The public contract has no semantic group key yet. Keep these explicit aliases
 * here, never infer membership from an individual service title or create IDs.
 */
export function getAssessmentServices(catalog: PublicCatalogRaw | undefined) {
  if (!catalog) return [];
  const departments = new Set(catalog.departments
    .filter((row) => row.isActive !== false && row.isVisible !== false && isAssessmentGroup(row))
    .map((row) => row.id));
  const categories = new Set(catalog.categories
    .filter((row) => row.isActive !== false && row.archivedAt == null && row.bookingMode !== 'DIRECT'
      && (isAssessmentGroup(row) || (row.departmentId != null && departments.has(row.departmentId))))
    .map((row) => row.id));
  return catalog.services.filter((service) => service.categoryId != null && categories.has(service.categoryId)
    && service.isActive !== false && service.isHidden !== true && service.archivedAt == null);
}
