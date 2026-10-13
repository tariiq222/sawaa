/**
 * Canonical permission catalog — single source of truth for CASL Subjects
 * and Actions used by the backend authorization guard, the
 * list-permissions handler (admin-UI role editor), and any frontend
 * `canDo(module, action)` checks.
 *
 * Naming rules:
 *  • Subjects are PascalCase singular nouns (matches `@casl/ability` convention
 *    and the existing `casl-ability.factory.ts` BUILT_IN map).
 *  • Actions are lowercase verbs from the CASL action vocabulary.
 *  • Order is alphabetical so future additions land deterministically.
 *
 * NOTE: The frontend's `flattenPermissions()` helper lower-cases subjects
 * when emitting `module:action` strings (e.g. `Booking` → `booking:read`).
 * Keep both halves of the contract (PascalCase here, lowercase on the wire)
 * in sync — never rename a subject without updating both ends.
 */

export const PERMISSION_SUBJECTS = [
  'Booking',
  'Branch',
  'Category',
  'Client',
  'Content',
  'Conversation',
  'Coupon',
  'Department',
  'Employee',
  'Integration',
  'Invoice',
  'Payment',
  'PersonalData',
  'ProviderConfig',
  'Refund',
  'Report',
  'Role',
  'Service',
  'Setting',
  'User',
] as const;

export type PermissionSubject = (typeof PERMISSION_SUBJECTS)[number];

/**
 * Subjects split out of the former catch-all `Setting` subject. The data
 * migration `20261013000000_expand_setting_permission_subjects` copies every
 * stored `Setting` permission row onto each of these, so no existing role
 * changes effective access. Keep in sync with that migration's VALUES list.
 */
export const SETTING_SPLIT_SUBJECTS = [
  'Content',
  'PersonalData',
  'ProviderConfig',
  'Refund',
] as const satisfies readonly PermissionSubject[];

export const PERMISSION_ACTIONS = [
  'manage',
  'create',
  'read',
  'update',
  'delete',
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/**
 * Canonical display order for permission actions in admin UIs (role editor,
 * permission matrix, etc.). Derived from `PERMISSION_ACTIONS` so the order
 * cannot drift from the source of truth — `satisfies` guarantees every entry
 * is a real catalog action. If a UI needs an extra column for a legacy
 * action (e.g. `view`, `edit`, `use` from a previous translation-key era),
 * append it after the catalog entries rather than re-ordering this list.
 */
export const STANDARD_ACTION_ORDER = [
  'manage',
  'read',
  'create',
  'update',
  'delete',
] as const satisfies readonly PermissionAction[];

/** Convenience pair used by the role-editor UI. */
export interface PermissionDescriptor {
  subject: PermissionSubject;
  action: PermissionAction;
}
