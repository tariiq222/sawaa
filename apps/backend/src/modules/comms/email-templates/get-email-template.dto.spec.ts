import 'reflect-metadata';
import { GetEmailTemplateDto } from './get-email-template.dto';

describe('GetEmailTemplateDto', () => {
  it('should be defined', () => {
    const dto = new GetEmailTemplateDto();
    expect(dto).toBeDefined();
  });
});
