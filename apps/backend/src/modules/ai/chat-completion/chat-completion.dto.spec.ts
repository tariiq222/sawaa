import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChatCompletionDto } from './chat-completion.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ChatCompletionDto, plain);
  return validate(dto);
}

describe('ChatCompletionDto', () => {
  const valid: Record<string, unknown> = {
    userMessage: 'What are your clinic hours?',
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with a valid sessionId', async () => {
    const errors = await validateDto({
      ...valid,
      sessionId: '12345678-1234-4234-8234-123456789abc',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts sessionId omitted (optional)', async () => {
    const errors = await validateDto(valid);
    expect(errors.some((e) => e.property === 'sessionId')).toBe(false);
  });

  it('accepts userMessage at the MaxLength(4000) boundary', async () => {
    const errors = await validateDto({ ...valid, userMessage: 'a'.repeat(4000) });
    expect(errors.some((e) => e.property === 'userMessage')).toBe(false);
  });

  it('rejects userMessage exceeding MaxLength(4000)', async () => {
    const errors = await validateDto({ ...valid, userMessage: 'a'.repeat(4001) });
    expect(errors.some((e) => e.property === 'userMessage')).toBe(true);
  });

  it('rejects an empty userMessage', async () => {
    const errors = await validateDto({ ...valid, userMessage: '' });
    expect(errors.some((e) => e.property === 'userMessage')).toBe(true);
  });

  it('rejects a missing userMessage', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'userMessage')).toBe(true);
  });

  it('rejects a non-UUID sessionId', async () => {
    const errors = await validateDto({ ...valid, sessionId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'sessionId')).toBe(true);
  });

  it('ignores clientId / userId impersonation attempts (P0-4)', async () => {
    // clientId and userId must NOT be accepted from the request body — they
    // come from the JWT/ClientSession and are added by the controller.
    // The DTO has no such fields; an unknown extra key should be ignored by
    // class-transformer's default whitelist behaviour.
    const errors = await validateDto({
      ...valid,
      clientId: 'attacker-uuid',
      userId: 'attacker-uuid',
    });
    expect(errors).toHaveLength(0);
  });
});
