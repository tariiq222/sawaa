import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertChatbotConfigDto } from './upsert-chatbot-config.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpsertChatbotConfigDto, plain);
  return validate(dto);
}

describe('UpsertChatbotConfigDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a full payload', async () => {
    const errors = await validateDto({
      systemPromptAr: 'أنت مساعد',
      systemPromptEn: 'You are an assistant',
      greetingAr: 'مرحباً',
      greetingEn: 'Hi!',
      escalateToHumanAt: 5,
      settings: { tone: 'friendly' },
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial payload (only systemPromptAr)', async () => {
    const errors = await validateDto({ systemPromptAr: 'مرحباً' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string systemPromptAr', async () => {
    const errors = await validateDto({ systemPromptAr: 123 });
    expect(errors.some((e) => e.property === 'systemPromptAr')).toBe(true);
  });

  it('rejects escalateToHumanAt < 1', async () => {
    const errors = await validateDto({ escalateToHumanAt: 0 });
    expect(errors.some((e) => e.property === 'escalateToHumanAt')).toBe(true);
  });

  it('accepts escalateToHumanAt = 1 (Min boundary)', async () => {
    const errors = await validateDto({ escalateToHumanAt: 1 });
    expect(errors.some((e) => e.property === 'escalateToHumanAt')).toBe(false);
  });

  it('rejects a non-integer escalateToHumanAt', async () => {
    const errors = await validateDto({ escalateToHumanAt: 2.5 });
    expect(errors.some((e) => e.property === 'escalateToHumanAt')).toBe(true);
  });

  it('rejects settings that is not an object', async () => {
    const errors = await validateDto({ settings: 'not-an-object' });
    expect(errors.some((e) => e.property === 'settings')).toBe(true);
  });

  it('accepts settings as an empty object', async () => {
    const errors = await validateDto({ settings: {} });
    expect(errors).toHaveLength(0);
  });
});
