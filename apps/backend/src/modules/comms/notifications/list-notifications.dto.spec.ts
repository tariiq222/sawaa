import 'reflect-metadata';
import { ListNotificationsDto } from './list-notifications.dto';

describe('ListNotificationsDto', () => {
  it('should be defined', () => {
    const dto = new ListNotificationsDto();
    expect(dto).toBeDefined();
  });
});
