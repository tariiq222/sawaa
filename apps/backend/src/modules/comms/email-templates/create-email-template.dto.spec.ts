import 'reflect-metadata';
import { CreateEmailTemplateDto } from './create-email-template.dto';

describe('CreateEmailTemplateDto', () => {
  it('should be defined', () => {
    const dto = new CreateEmailTemplateDto();
    expect(dto).toBeDefined();
  });
});
