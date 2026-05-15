import 'reflect-metadata';
import { SmtpCredentialsDto } from './upsert-org-email-config.dto';

describe('SmtpCredentialsDto', () => {
  it('should be defined', () => {
    const dto = new SmtpCredentialsDto();
    expect(dto).toBeDefined();
  });
});
