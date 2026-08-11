import { SpecialistRegistryService } from './specialist-registry.service';

describe('SpecialistRegistryService', () => {
  const registry = new SpecialistRegistryService();

  it('routes booking requests to the booking specialist', () => {
    expect(registry.route('أريد حجز موعد')).toBe('NEW_BOOKING');
    expect(registry.getToolNames('NEW_BOOKING')).toContain('proposeBooking');
  });

  it('keeps booking support tools separate from booking creation', () => {
    expect(registry.route('أريد إلغاء حجزي')).toBe('BOOKING_SUPPORT');
    expect(registry.getToolNames('BOOKING_SUPPORT')).not.toContain('proposeBooking');
  });

  it('fails closed for human handoff requests', () => {
    expect(registry.route('أريد التحدث مع موظف')).toBe('HUMAN');
    expect(registry.getToolNames('HUMAN')).toEqual([]);
  });
});
