import type { PermissionAction, PermissionSubject } from '@sawaa/shared/constants';

export type Rule = {
  action: PermissionAction | 'manage' | Array<PermissionAction | 'manage'>;
  subject: PermissionSubject | 'all';
};

const ADMIN_RULES: readonly Rule[] = [
  { action: 'manage', subject: 'User' },
  { action: 'manage', subject: 'Role' },
  { action: 'manage', subject: 'Booking' },
  { action: 'manage', subject: 'Client' },
  { action: 'manage', subject: 'Employee' },
  { action: 'manage', subject: 'Invoice' },
  { action: 'manage', subject: 'Payment' },
  { action: 'manage', subject: 'Report' },
  { action: 'manage', subject: 'Setting' },
  { action: 'manage', subject: 'Department' },
  { action: 'manage', subject: 'Category' },
  { action: 'manage', subject: 'Service' },
  { action: 'manage', subject: 'Branch' },
  { action: 'manage', subject: 'Branding' },
  { action: 'manage', subject: 'Content' },
  { action: 'manage', subject: 'Integration' },
  { action: 'manage', subject: 'Coupon' },
];

export const BUILT_IN: Record<string, readonly Rule[]> = {
  SUPER_ADMIN: [{ action: 'manage', subject: 'all' }],
  OWNER: [...ADMIN_RULES],
  ADMIN: ADMIN_RULES,
  RECEPTIONIST: [
    { action: ['create', 'read', 'update'], subject: 'Booking' },
    { action: ['create', 'read', 'update'], subject: 'Client' },
    { action: 'read', subject: 'Employee' },
    { action: 'read', subject: 'Invoice' },
    { action: 'read', subject: 'Service' },
    { action: 'read', subject: 'Category' },
  ],
  ACCOUNTANT: [
    { action: 'manage', subject: 'Invoice' },
    { action: 'manage', subject: 'Payment' },
    { action: 'read', subject: 'Booking' },
    { action: 'read', subject: 'Report' },
  ],
  EMPLOYEE: [
    { action: 'read', subject: 'Booking' },
    { action: 'read', subject: 'Client' },
    { action: 'update', subject: 'Booking' },
  ],
  CLIENT: [
    { action: 'read', subject: 'Booking' },
    { action: 'create', subject: 'Booking' },
    { action: 'read', subject: 'Invoice' },
  ],
};
