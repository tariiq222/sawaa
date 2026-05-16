import { flattenPermissions } from './flatten-permissions';

describe('flattenPermissions', () => {
  it('flattens owner permissions with wildcards', () => {
    const result = flattenPermissions({
      role: 'OWNER',
      customRole: null,
    });
    expect(result).toContain('booking:*');
    expect(result).toContain('user:*');
  });

  it('returns * for manage+all', () => {
    const result = flattenPermissions({
      role: 'SUPER_ADMIN',
      customRole: null,
    });
    expect(result).toContain('*');
  });

  it('flattens customRole permissions', () => {
    const result = flattenPermissions({
      role: null,
      customRole: {
        permissions: [
          { action: 'read', subject: 'Booking' },
          { action: 'update', subject: 'Invoice' },
        ],
      },
    });
    expect(result).toContain('booking:read');
    expect(result).toContain('invoice:update');
  });

  it('flattens array actions', () => {
    const result = flattenPermissions({
      role: null,
      customRole: {
        permissions: [{ action: 'read', subject: 'Booking' }, { action: 'update', subject: 'Booking' }],
      },
    });
    expect(result).toContain('booking:read');
    expect(result).toContain('booking:update');
  });

  it('flattens array subjects', () => {
    const result = flattenPermissions({
      role: null,
      customRole: {
        permissions: [{ action: 'read', subject: 'Booking' }, { action: 'read', subject: 'Invoice' }],
      },
    });
    expect(result).toContain('booking:read');
    expect(result).toContain('invoice:read');
  });
});
