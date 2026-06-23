import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertOrgSettingsDto } from './upsert-org-settings.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpsertOrgSettingsDto, plain);
  return validate(dto);
}

describe('UpsertOrgSettingsDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      companyNameAr: 'عيادة الرعاية',
      companyNameEn: 'Sawaa Clinic',
      productTagline: 'مركز الاستشارات الأسرية',
      businessRegistration: '1234567890',
      vatRegistrationNumber: '300000000000003',
      vatRate: 0.15,
      sellerAddress: '123 King Fahad Rd, Riyadh',
      organizationCity: 'Riyadh',
      postalCode: '12345',
      contactPhone: '+966500000000',
      contactEmail: 'info@clinic.sa',
      address: 'Riyadh, Saudi Arabia',
      socialMedia: { instagram: 'clinic_sa' },
      aboutAr: 'نبذة',
      aboutEn: 'About',
      privacyPolicyAr: 'سياسة',
      privacyPolicyEn: 'Privacy',
      termsAr: 'شروط',
      termsEn: 'Terms',
      cancellationPolicyAr: 'إلغاء',
      cancellationPolicyEn: 'Cancellation',
      defaultLanguage: 'ar',
      timezone: 'Asia/Riyadh',
      weekStartDay: 'sunday',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      emailHeaderShowLogo: true,
      emailHeaderShowName: true,
      emailFooterPhone: '+966500000000',
      emailFooterWebsite: 'https://example.com',
      emailFooterInstagram: 'clinic_sa',
      emailFooterTwitter: 'clinic_sa',
      emailFooterSnapchat: 'clinic_sa',
      emailFooterTiktok: 'clinic_sa',
      emailFooterLinkedin: 'https://linkedin.com/company/clinic',
      emailFooterYoutube: 'https://youtube.com/@clinic',
      sessionDuration: 60,
      reminderBeforeMinutes: 60,
      bookingFlowOrder: 'service_first',
      paymentMoyasarEnabled: true,
      paymentAtClinicEnabled: true,
      payMethodCashEnabled: true,
      payMethodBankEnabled: true,
      payMethodMadaEnabled: false,
      payMethodTabbyEnabled: false,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string companyNameAr', async () => {
    const errors = await validateDto({ companyNameAr: 42 });
    expect(errors.some((e) => e.property === 'companyNameAr')).toBe(true);
  });

  it('rejects a non-boolean emailHeaderShowLogo', async () => {
    const errors = await validateDto({ emailHeaderShowLogo: 'true' });
    expect(errors.some((e) => e.property === 'emailHeaderShowLogo')).toBe(true);
  });

  it('rejects vatRate < 0', async () => {
    const errors = await validateDto({ vatRate: -0.1 });
    expect(errors.some((e) => e.property === 'vatRate')).toBe(true);
  });

  it('rejects vatRate > 1', async () => {
    const errors = await validateDto({ vatRate: 1.1 });
    expect(errors.some((e) => e.property === 'vatRate')).toBe(true);
  });

  it('accepts vatRate at the upper boundary (exactly 1)', async () => {
    const errors = await validateDto({ vatRate: 1 });
    expect(errors).toHaveLength(0);
  });

  it('rejects sessionDuration < 15', async () => {
    const errors = await validateDto({ sessionDuration: 10 });
    expect(errors.some((e) => e.property === 'sessionDuration')).toBe(true);
  });

  it('rejects sessionDuration > 480', async () => {
    const errors = await validateDto({ sessionDuration: 600 });
    expect(errors.some((e) => e.property === 'sessionDuration')).toBe(true);
  });

  it('accepts sessionDuration at the lower boundary (exactly 15)', async () => {
    const errors = await validateDto({ sessionDuration: 15 });
    expect(errors).toHaveLength(0);
  });

  it('accepts sessionDuration at the upper boundary (exactly 480)', async () => {
    const errors = await validateDto({ sessionDuration: 480 });
    expect(errors).toHaveLength(0);
  });

  it('rejects reminderBeforeMinutes < 0', async () => {
    const errors = await validateDto({ reminderBeforeMinutes: -1 });
    expect(errors.some((e) => e.property === 'reminderBeforeMinutes')).toBe(true);
  });

  it('rejects an out-of-set bookingFlowOrder', async () => {
    const errors = await validateDto({ bookingFlowOrder: 'random_order' });
    expect(errors.some((e) => e.property === 'bookingFlowOrder')).toBe(true);
  });

  it('accepts each valid bookingFlowOrder', async () => {
    for (const bookingFlowOrder of ['service_first', 'employee_first', 'both']) {
      const errors = await validateDto({ bookingFlowOrder });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects a non-boolean paymentMoyasarEnabled', async () => {
    const errors = await validateDto({ paymentMoyasarEnabled: 1 });
    expect(errors.some((e) => e.property === 'paymentMoyasarEnabled')).toBe(true);
  });

  it('rejects a non-boolean payMethodTabbyEnabled', async () => {
    const errors = await validateDto({ payMethodTabbyEnabled: 'false' });
    expect(errors.some((e) => e.property === 'payMethodTabbyEnabled')).toBe(true);
  });

  it('rejects a non-integer sessionDuration', async () => {
    const errors = await validateDto({ sessionDuration: 30.5 });
    expect(errors.some((e) => e.property === 'sessionDuration')).toBe(true);
  });

  it('rejects a non-integer reminderBeforeMinutes', async () => {
    const errors = await validateDto({ reminderBeforeMinutes: 5.5 });
    expect(errors.some((e) => e.property === 'reminderBeforeMinutes')).toBe(true);
  });

  it('rejects a non-numeric vatRate', async () => {
    const errors = await validateDto({ vatRate: 'not-a-number' });
    expect(errors.some((e) => e.property === 'vatRate')).toBe(true);
  });
});
