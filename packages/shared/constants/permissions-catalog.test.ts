import { describe, it, expect } from 'vitest';
import {
  PERMISSION_SUBJECTS,
  PERMISSION_ACTIONS,
  type PermissionSubject,
  type PermissionAction,
} from './permissions-catalog';

describe('permissions catalog', () => {
  it('exposes the canonical Subject list (PascalCase, alphabetical)', () => {
    expect(PERMISSION_SUBJECTS).toEqual([
      'Billing',
      'Booking',
      'Branch',
      'Branding',
      'Category',
      'Client',
      'Coupon',
      'Department',
      'Employee',
      'Invoice',
      'Payment',
      'Plan',
      'Report',
      'Role',
      'Service',
      'Setting',
      'Subscription',
      'User',
    ]);
  });

  it('exposes the CASL action vocabulary (lowercase)', () => {
    expect(PERMISSION_ACTIONS).toEqual([
      'manage',
      'create',
      'read',
      'update',
      'delete',
    ]);
  });

  it('PermissionSubject type accepts a known subject', () => {
    const s: PermissionSubject = 'Booking';
    expect(PERMISSION_SUBJECTS).toContain(s);
  });

  it('PermissionAction type accepts a known action', () => {
    const a: PermissionAction = 'manage';
    expect(PERMISSION_ACTIONS).toContain(a);
  });

  it('forbids accidental duplicates in the subject list', () => {
    expect(new Set(PERMISSION_SUBJECTS).size).toBe(PERMISSION_SUBJECTS.length);
  });
});
