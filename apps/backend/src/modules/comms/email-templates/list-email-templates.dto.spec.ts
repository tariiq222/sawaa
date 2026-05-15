import 'reflect-metadata';
import { ListEmailTemplatesDto } from './list-email-templates.dto';

describe('ListEmailTemplatesDto', () => {
  it('should be defined', () => {
    const dto = new ListEmailTemplatesDto();
    expect(dto).toBeDefined();
  });
});
