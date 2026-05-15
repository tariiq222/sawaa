import 'reflect-metadata';
import { ListTenantDeliveryLogsDto } from './list-tenant-delivery-logs.dto';

describe('ListTenantDeliveryLogsDto', () => {
  it('should be defined', () => {
    const dto = new ListTenantDeliveryLogsDto();
    expect(dto).toBeDefined();
  });
});
