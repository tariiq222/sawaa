import { hasBookingPermission, resolveCancellationMode } from '../employee-booking-actions';

const user = (permissions: string[]) => ({ permissions, isSuperAdmin: false });

describe('employee booking capability hints match flattened API permissions', () => {
  it.each(['*', 'booking:*', 'booking:delete', '*:delete'])('allows direct cancel for %s', (permission) => {
    expect(resolveCancellationMode(user([permission]))).toBe('direct_cancel');
  });
  it.each(['booking:update', '*:update'])('requests rather than cancels for %s', (permission) => {
    expect(resolveCancellationMode(user([permission]))).toBe('request_cancel');
  });
  it.each(['booking:read', 'Booking:delete', 'booking:manage', 'all:manage', '*:*', ''])('fails closed for %s', (permission) => {
    expect(resolveCancellationMode(user([permission]))).toBe('none');
  });
  it('fails closed when signed out', () => expect(resolveCancellationMode(null)).toBe('none'));
  it('does not derive update permission from delete', () => {
    expect(hasBookingPermission(user(['booking:delete']), 'update')).toBe(false);
  });
  it('supports authoritative superadmin flag', () => {
    expect(resolveCancellationMode({ permissions: [], isSuperAdmin: true })).toBe('direct_cancel');
  });
});
