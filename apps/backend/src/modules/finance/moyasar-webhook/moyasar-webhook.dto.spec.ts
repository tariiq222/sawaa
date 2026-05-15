import 'reflect-metadata';
import { MoyasarWebhookMetadataDto } from './moyasar-webhook.dto';

describe('MoyasarWebhookMetadataDto', () => {
  it('should be defined', () => {
    const dto = new MoyasarWebhookMetadataDto();
    expect(dto).toBeDefined();
  });
});
