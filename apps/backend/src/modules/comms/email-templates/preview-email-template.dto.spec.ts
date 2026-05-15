import 'reflect-metadata';
import { PreviewEmailTemplateDto } from './preview-email-template.dto';

describe('PreviewEmailTemplateDto', () => {
  it('should be defined', () => {
    const dto = new PreviewEmailTemplateDto();
    expect(dto).toBeDefined();
  });
});
