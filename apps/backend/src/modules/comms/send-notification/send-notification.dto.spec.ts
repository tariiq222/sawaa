import 'reflect-metadata';
import { SendNotificationDto } from './send-notification.dto';

describe('SendNotificationDto', () => {
  it('should be defined', () => {
    const dto = new SendNotificationDto();
    expect(dto).toBeDefined();
  });
});
