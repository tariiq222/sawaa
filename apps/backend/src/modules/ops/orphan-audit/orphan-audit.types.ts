/**
 * DB-13 — Canonical list of cross-BC string foreign keys.
 *
 * These fields reference entities in another Bounded Context (BC) via a plain
 * string ID — Prisma has no FK relation for them so the DB cannot enforce
 * referential integrity automatically.
 *
 * Source of truth: schema comments in prisma/schema/bookings.prisma,
 * finance.prisma, organization.prisma.
 *
 * Rules:
 *  - parentModel: the Prisma model that "owns" the referenced entity.
 *  - parentField: the id field on that model (always "id").
 *  - childModel: the Prisma model that holds the plain-string ref.
 *  - childField: the field name on childModel that stores the parent's id.
 *  - All checks are scoped by organizationId — we never compare across tenants.
 */
export interface OrphanCheck {
  /** Human-readable label for ActivityLog entries and logging. */
  label: string;
  /** Prisma model that holds the orphan candidate field. */
  childModel: string;
  /** Field on childModel that should reference parentModel.id. */
  childField: string;
  /** Prisma model that should own the referenced entity. */
  parentModel: string;
}

/**
 * Discovered cross-BC string FK pairs.
 *
 * Booking → Client (clientId): Booking.clientId → Client.id (people BC)
 * Booking → Employee (employeeId): Booking.employeeId → Employee.id (people BC)
 * Booking → Service (serviceId): Booking.serviceId → Service.id (org-config BC)
 * Booking → Branch (branchId): Booking.branchId → Branch.id (org-config BC)
 * Invoice → Client (clientId): Invoice.clientId → Client.id (people BC)
 * Invoice → Employee (employeeId): Invoice.employeeId → Employee.id (people BC)
 * Invoice → Branch (branchId): Invoice.branchId → Branch.id (org-config BC)
 * Rating → Client (clientId): Rating.clientId → Client.id (people BC)
 * Rating → Employee (employeeId): Rating.employeeId → Employee.id (people BC)
 */
export const ORPHAN_CHECKS: OrphanCheck[] = [
  { label: 'Booking.clientId → Client', childModel: 'booking', childField: 'clientId', parentModel: 'client' },
  { label: 'Booking.employeeId → Employee', childModel: 'booking', childField: 'employeeId', parentModel: 'employee' },
  { label: 'Booking.serviceId → Service', childModel: 'booking', childField: 'serviceId', parentModel: 'service' },
  { label: 'Booking.branchId → Branch', childModel: 'booking', childField: 'branchId', parentModel: 'branch' },
  { label: 'Invoice.clientId → Client', childModel: 'invoice', childField: 'clientId', parentModel: 'client' },
  { label: 'Invoice.employeeId → Employee', childModel: 'invoice', childField: 'employeeId', parentModel: 'employee' },
  { label: 'Invoice.branchId → Branch', childModel: 'invoice', childField: 'branchId', parentModel: 'branch' },
  { label: 'Rating.clientId → Client', childModel: 'rating', childField: 'clientId', parentModel: 'client' },
  { label: 'Rating.employeeId → Employee', childModel: 'rating', childField: 'employeeId', parentModel: 'employee' },
];
