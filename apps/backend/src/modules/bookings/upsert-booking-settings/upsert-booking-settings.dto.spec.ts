import 'reflect-metadata';
import { UpsertBookingSettingsDto } from './upsert-booking-settings.dto';

describe('UpsertBookingSettingsDto', () => {
  it('should be defined', () => {
    const dto = new UpsertBookingSettingsDto();
    expect(dto).toBeDefined();
  });
});
