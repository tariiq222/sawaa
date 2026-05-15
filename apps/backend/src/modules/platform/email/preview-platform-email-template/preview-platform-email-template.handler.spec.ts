import { Test, TestingModule } from '@nestjs/testing';
import { PreviewPlatformEmailTemplateHandler } from './preview-platform-email-template.handler';
import { GetPlatformEmailTemplateHandler } from '../get-platform-email-template/get-platform-email-template.handler';

describe('PreviewPlatformEmailTemplateHandler', () => {
  let handler: PreviewPlatformEmailTemplateHandler;
  let getHandler: jest.Mocked<Partial<GetPlatformEmailTemplateHandler>>;

  beforeEach(async () => {
    getHandler = { execute: jest.fn().mockResolvedValue({ subjectEn: 'Hello {{name}}', htmlBody: '<p>Welcome {{name}}</p>' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreviewPlatformEmailTemplateHandler,
        { provide: GetPlatformEmailTemplateHandler, useValue: getHandler },
      ],
    }).compile();

    handler = module.get<PreviewPlatformEmailTemplateHandler>(PreviewPlatformEmailTemplateHandler);
  });

  it('should interpolate vars into template', async () => {
    const result = await handler.execute('welcome', { name: 'Ahmed' });
    expect(result.subject).toBe('Hello Ahmed');
    expect(result.html).toBe('<p>Welcome Ahmed</p>');
  });

  it('should leave unknown vars as placeholders', async () => {
    const result = await handler.execute('welcome', {});
    expect(result.subject).toBe('Hello {{name}}');
    expect(result.html).toBe('<p>Welcome {{name}}</p>');
  });

  it('should use empty vars when not provided', async () => {
    const result = await handler.execute('welcome');
    expect(result.subject).toBe('Hello {{name}}');
  });
});
