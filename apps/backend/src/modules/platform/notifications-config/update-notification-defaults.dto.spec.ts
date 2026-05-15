import 'reflect-metadata';
import { QuietHoursDto } from './update-notification-defaults.dto';

describe('QuietHoursDto', () => {
  it('should be defined', () => {
    const dto = new QuietHoursDto();
    expect(dto).toBeDefined();
  });
});
