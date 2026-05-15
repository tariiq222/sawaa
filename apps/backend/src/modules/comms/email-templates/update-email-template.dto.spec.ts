import 'reflect-metadata';
import { UpdateEmailTemplateDto } from './update-email-template.dto';

describe('UpdateEmailTemplateDto', () => {
  it('should be defined', () => {
    const dto = new UpdateEmailTemplateDto();
    expect(dto).toBeDefined();
  });
});
