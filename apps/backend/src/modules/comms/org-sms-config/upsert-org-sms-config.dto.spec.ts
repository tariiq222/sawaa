import 'reflect-metadata';
import { UnifonicCredentialsDto } from './upsert-org-sms-config.dto';

describe('UnifonicCredentialsDto', () => {
  it('should be defined', () => {
    const dto = new UnifonicCredentialsDto();
    expect(dto).toBeDefined();
  });
});
