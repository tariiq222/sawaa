import 'reflect-metadata';
import { UpdatePlatformEmailTemplateDto } from './update-platform-email-template.dto';

describe('UpdatePlatformEmailTemplateDto', () => {
  it('should be defined', () => {
    const dto = new UpdatePlatformEmailTemplateDto();
    expect(dto).toBeDefined();
  });
});
