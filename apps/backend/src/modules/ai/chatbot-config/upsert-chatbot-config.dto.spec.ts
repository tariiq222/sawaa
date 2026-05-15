import 'reflect-metadata';
import { UpsertChatbotConfigDto } from './upsert-chatbot-config.dto';

describe('UpsertChatbotConfigDto', () => {
  it('should be defined', () => {
    const dto = new UpsertChatbotConfigDto();
    expect(dto).toBeDefined();
  });
});
