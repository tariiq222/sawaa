import i18n from '@/i18n';

describe('appointment tab labels', () => {
  it('uses the i18n tab names in Arabic and English', () => {
    const ar = i18n.getFixedT('ar');
    const en = i18n.getFixedT('en');
    expect([ar('appointments.upcoming'), ar('appointments.past'), ar('appointments.cancelled')])
      .toEqual(['القادمة', 'السابقة', 'الملغاة']);
    expect(ar('appointments.bookNew')).toBe('احجز موعدًا');
    expect([en('appointments.upcoming'), en('appointments.past'), en('appointments.cancelled')])
      .toEqual(['Upcoming', 'Past', 'Cancelled']);
  });
});
