import { BadRequestException, ConflictException } from '@nestjs/common';
import { TestAiProviderConfigHandler } from './test-ai-provider-config.handler';
import { UpsertAiProviderConfigHandler } from './upsert-ai-provider-config.handler';
import { GetAiProviderConfigHandler } from './get-ai-provider-config.handler';
import { AiConnectionStatus, AiProvider } from './ai-provider-config.types';

const row = (overrides: Record<string, unknown> = {}) => ({ id: 'id', singletonKey: 'singleton', provider: AiProvider.OPENROUTER, credentialCiphertext: 'v1.fake', model: 'deepseek/deepseek-v4-flash-0731', temperature: .4, maxTokens: 800, isEnabled: false, connectionStatus: AiConnectionStatus.CONNECTED, lastTestedAt: new Date(), lastTestOk: true, lastTestErrorCode: null, configVersion: 3, testedConfigHash: 'hash', createdAt: new Date(), updatedAt: new Date(), ...overrides });
const dto = (overrides: Record<string, unknown> = {}) => ({ provider: AiProvider.OPENROUTER, model: 'deepseek/deepseek-v4-flash-0731', candidateApiKey: 'candidate-key', saveCredential: true, ...overrides }) as any;

describe('AI provider settings handlers', () => {
  const noSecretAudit = (audit: jest.Mock) => {
    const serialized = JSON.stringify(audit.mock.calls);
    expect(serialized).not.toContain('candidate-key');
    expect(serialized).not.toContain('v1.secret-ciphertext');
    expect(serialized).not.toContain('provider body');
  };

  it('creates and audits the first saved configuration in the same transaction', async () => {
    const audit = jest.fn(); const create = jest.fn().mockResolvedValue(row({ credentialCiphertext: 'v1.secret-ciphertext' }));
    const tx = { aiProviderConfig: { create }, activityLog: { create: audit } };
    const rls = { withTransaction: jest.fn(async (fn: any) => fn(tx)) };
    const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(null) } };
    const result = await new TestAiProviderConfigHandler(prisma as any, { createCandidateClient: jest.fn(() => ({ chat: { completions: { create: jest.fn().mockResolvedValue({}) } } })) } as any, { encrypt: jest.fn().mockReturnValue('v1.secret-ciphertext'), fingerprint: jest.fn().mockReturnValue('hash') } as any, rls as any).execute(dto());
    expect(result).toMatchObject({ ok: true, persisted: true });
    expect(create).toHaveBeenCalled(); expect(audit).toHaveBeenCalled();
    expect(rls.withTransaction).toHaveBeenCalledTimes(1); noSecretAudit(audit);
  });

  it('maps singleton P2002 to ConflictException and rethrows generic create failures', async () => {
    const base = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(null) } };
    const client = { createCandidateClient: jest.fn(() => ({ chat: { completions: { create: jest.fn().mockResolvedValue({}) } } })) };
    const creds = { encrypt: jest.fn().mockReturnValue('cipher'), fingerprint: jest.fn().mockReturnValue('hash') };
    const p2002 = { code: 'P2002' }; const generic = new Error('db down');
    for (const error of [p2002, generic]) {
      const rls = { withTransaction: jest.fn(async (fn: any) => fn({ aiProviderConfig: { create: jest.fn().mockRejectedValue(error) }, activityLog: { create: jest.fn() } })) };
      const promise = new TestAiProviderConfigHandler(base as any, client as any, creds as any, rls as any).execute(dto());
      if (error === p2002) await expect(promise).rejects.toBeInstanceOf(ConflictException);
      else await expect(promise).rejects.toBe(error);
    }
  });

  it('maps an exact matching 401 to RETEST_REQUIRED and timeout/5xx to FAILED', async () => {
    for (const error of [{ status: 401 }, { name: 'AbortError' }, { status: 503 }]) {
      const audit = jest.fn(); const current = row({ provider: AiProvider.OPENROUTER, model: 'deepseek/deepseek-v4-flash-0731', testedConfigHash: 'hash' });
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(current) } };
      const rls = { withTransaction: jest.fn(async (fn: any) => fn({ aiProviderConfig: { updateMany }, activityLog: { create: audit } })) };
      const client = { createCandidateClient: jest.fn(() => ({ chat: { completions: { create: jest.fn().mockRejectedValue(error) } } })) };
      const result = await new TestAiProviderConfigHandler(prisma as any, client as any, { fingerprint: jest.fn().mockReturnValue('hash') } as any, rls as any).execute(dto({ saveCredential: false }));
      expect(result.errorCode).toBe(error.status === 401 ? 'RETEST_REQUIRED' : 'PROVIDER_' + (error.name === 'AbortError' ? 'TIMEOUT' : 'UNAVAILABLE'));
      expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ connectionStatus: error.status === 401 ? AiConnectionStatus.RETEST_REQUIRED : AiConnectionStatus.FAILED }) }));
    }
  });

  it('saves an existing config with CAS count one and audits the mutation', async () => {
    const audit = jest.fn(); const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const current = row({ configVersion: 3 }); const tx = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue({ configVersion: 3 }), updateMany, findUniqueOrThrow: jest.fn().mockResolvedValue(row({ configVersion: 4 })) }, activityLog: { create: audit } };
    const rls = { withTransaction: jest.fn(async (fn: any) => fn(tx)) }; const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(current) } };
    const result = await new TestAiProviderConfigHandler(prisma as any, { createCandidateClient: jest.fn(() => ({ chat: { completions: { create: jest.fn().mockResolvedValue({}) } } })) } as any, { encrypt: jest.fn().mockReturnValue('cipher'), fingerprint: jest.fn().mockReturnValue('new-hash') } as any, rls as any).execute(dto());
    expect(result).toMatchObject({ ok: true, persisted: true }); expect(updateMany).toHaveBeenCalled(); expect(audit).toHaveBeenCalled(); noSecretAudit(audit);
  });

  it('rejects an existing save CAS loss as a conflict', async () => {
    const current = row({ configVersion: 3 }); const tx = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue({ configVersion: 3 }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) }, activityLog: { create: jest.fn() } };
    await expect(new TestAiProviderConfigHandler({ aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(current) } } as any, { createCandidateClient: jest.fn(() => ({ chat: { completions: { create: jest.fn().mockResolvedValue({}) } } })) } as any, { encrypt: jest.fn().mockReturnValue('cipher'), fingerprint: jest.fn().mockReturnValue('hash') } as any, { withTransaction: jest.fn(async (fn: any) => fn(tx)) } as any).execute(dto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('invalidates and disables when provider or model changes', async () => {
    const current = row({ provider: AiProvider.OPENROUTER, model: 'deepseek/deepseek-v4-flash-0731', testedConfigHash: 'hash' }); const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(current), updateMany, findUniqueOrThrow: jest.fn().mockResolvedValue(row({ provider: AiProvider.OPENROUTER, model: 'openai/gpt-4o-mini', isEnabled: false, testedConfigHash: null })) }, activityLog: { create: jest.fn() } };
    const result = await new UpsertAiProviderConfigHandler({} as any, { withTransaction: jest.fn(async (fn: any) => fn(tx)) } as any, { decrypt: jest.fn(), fingerprint: jest.fn() } as any).execute({ provider: AiProvider.OPENROUTER, model: 'openai/gpt-4o-mini', isEnabled: false } as any);
    expect(result.isEnabled).toBe(false); expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isEnabled: false, testedConfigHash: null, connectionStatus: AiConnectionStatus.RETEST_REQUIRED }) }));
  });

  it('enables only after valid decrypt and matching fingerprint, and rejects invalid decrypt/fingerprint', async () => {
    const current = row({ isEnabled: false, connectionStatus: AiConnectionStatus.CONNECTED, lastTestOk: true, testedConfigHash: 'hash' });
    const run = async (decrypt: jest.Mock, fingerprint: jest.Mock) => {
      const tx = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(current), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue(row({ isEnabled: true })) }, activityLog: { create: jest.fn() } };
      return new UpsertAiProviderConfigHandler({} as any, { withTransaction: jest.fn(async (fn: any) => fn(tx)) } as any, { decrypt, fingerprint } as any).execute({ provider: AiProvider.OPENROUTER, model: 'deepseek/deepseek-v4-flash-0731', isEnabled: true } as any);
    };
    await expect(run(jest.fn().mockReturnValue('key'), jest.fn().mockReturnValue('hash'))).resolves.toMatchObject({ isEnabled: true });
    await expect(run(jest.fn().mockImplementation(() => { throw new Error('bad decrypt'); }), jest.fn())).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(jest.fn().mockReturnValue('key'), jest.fn().mockReturnValue('wrong'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps upsert CAS count zero to ConflictException', async () => {
    const current = row(); const tx = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(current), updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    await expect(new UpsertAiProviderConfigHandler({} as any, { withTransaction: jest.fn(async (fn: any) => fn(tx)) } as any, { decrypt: jest.fn().mockReturnValue('key'), fingerprint: jest.fn().mockReturnValue('hash') } as any).execute({ provider: AiProvider.OPENROUTER, model: 'deepseek/deepseek-v4-flash-0731', isEnabled: false } as any)).rejects.toBeInstanceOf(ConflictException);
  });
  it('returns a safe unconfigured projection', async () => {
    const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    const result = await new GetAiProviderConfigHandler(prisma).execute();
    expect(result).toMatchObject({ hasCredential: false, connectionStatus: AiConnectionStatus.NOT_CONFIGURED, model: 'deepseek/deepseek-v4-flash-0731' });
    expect(JSON.stringify(result)).not.toContain('credential');
  });

  it('fails closed for leftover OpenAI or MiniMax rows without throwing', async () => {
    for (const leftover of [
      { provider: 'OPENAI', model: 'gpt-4o-mini' },
      { provider: 'MINIMAX', model: 'MiniMax-M3' },
    ]) {
      const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(row(leftover)) } } as any;
      const result = await new GetAiProviderConfigHandler(prisma).execute();
      expect(result).toMatchObject({
        provider: AiProvider.OPENROUTER,
        model: 'deepseek/deepseek-v4-flash-0731',
        isEnabled: false,
        connectionStatus: AiConnectionStatus.RETEST_REQUIRED,
        hasCredential: false,
      });
    }
  });

  it('fails closed when Prisma cannot decode a legacy stored provider enum', async () => {
    const prisma = { aiProviderConfig: { findUnique: jest.fn().mockRejectedValue(new Error('Inconsistent column data: Could not convert value from string "MINIMAX" to enum `AiProvider`')) } } as any;
    await expect(new GetAiProviderConfigHandler(prisma).execute()).resolves.toMatchObject({
      provider: AiProvider.OPENROUTER,
      model: 'deepseek/deepseek-v4-flash-0731',
      isEnabled: false,
      connectionStatus: AiConnectionStatus.RETEST_REQUIRED,
    });
  });

  it('rethrows unrelated Prisma read failures from get config', async () => {
    const prisma = { aiProviderConfig: { findUnique: jest.fn().mockRejectedValue(new Error('database connection refused')) } } as any;
    await expect(new GetAiProviderConfigHandler(prisma).execute()).rejects.toThrow('database connection refused');
  });

  it('does not mutate a different candidate failure and emits safe audit', async () => {
    const current = row({ testedConfigHash: 'other' });
    const audit = jest.fn();
    const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(current), updateMany: jest.fn() }, activityLog: { create: audit } };
    const rls = { withTransaction: jest.fn(async (fn: any) => fn({ aiProviderConfig: { updateMany: jest.fn() }, activityLog: { create: audit } })) };
    const client = { createCandidateClient: jest.fn(() => ({ chat: { completions: { create: jest.fn().mockRejectedValue({ status: 401, body: 'secret' }) } } })) };
    const creds = { fingerprint: jest.fn().mockReturnValue('different') };
    const result = await new TestAiProviderConfigHandler(prisma as any, client as any, creds as any, rls as any).execute(dto({ saveCredential: false }));
    expect(result).toMatchObject({ ok: false, errorCode: 'RETEST_REQUIRED' });
    expect(audit).toHaveBeenCalled();
    expect(JSON.stringify(audit.mock.calls)).not.toContain('secret');
    noSecretAudit(audit);
  });

  it('refuses enablement when the stored fingerprint is not valid', async () => {
    const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(row()), updateMany: jest.fn() } };
    const rls = { withTransaction: jest.fn(async (fn: any) => fn(prisma)) };
    const creds = { decrypt: jest.fn().mockReturnValue('key'), fingerprint: jest.fn().mockReturnValue('wrong') };
    await expect(new UpsertAiProviderConfigHandler(prisma as any, rls as any, creds as any).execute({ provider: AiProvider.OPENROUTER, model: 'deepseek/deepseek-v4-flash-0731', isEnabled: true } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not mutate live config for a successful non-save test and audits no secret', async () => {
    const current = row({ testedConfigHash: 'old' }); const audit = jest.fn();
    const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(current) } };
    const rls = { withTransaction: jest.fn(async (fn: any) => fn({ activityLog: { create: audit } })) };
    const client = { createCandidateClient: jest.fn(() => ({ chat: { completions: { create: jest.fn().mockResolvedValue({}) } } })) };
    const result = await new TestAiProviderConfigHandler(prisma as any, client as any, { fingerprint: jest.fn() } as any, rls as any).execute(dto({ saveCredential: false }));
    expect(result).toMatchObject({ ok: true, persisted: false }); expect(audit).toHaveBeenCalled(); noSecretAudit(audit);
  });

  it.each([
    [{ status: 500 }, 2, 'PROVIDER_UNAVAILABLE'],
    [{ name: 'AbortError' }, 2, 'PROVIDER_TIMEOUT'],
    [{ status: 401 }, 1, 'RETEST_REQUIRED'],
    [{ status: 400, body: 'provider secret' }, 1, 'PROVIDER_REQUEST_FAILED'],
  ])('bounds candidate retries and emits safe code', async (error, attempts, code) => {
    const audit = jest.fn(); const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(null) } };
    const rls = { withTransaction: jest.fn(async (fn: any) => fn({ activityLog: { create: audit } })) };
    const create = jest.fn().mockRejectedValue(error); const client = { createCandidateClient: jest.fn(() => ({ chat: { completions: { create } } })) };
    const result = await new TestAiProviderConfigHandler(prisma as any, client as any, { fingerprint: jest.fn() } as any, rls as any).execute(dto({ saveCredential: false }));
      expect(create).toHaveBeenCalledTimes(attempts); expect(result.errorCode).toBe(code); expect(audit).toHaveBeenCalled(); noSecretAudit(audit);
  });

  it('does not send thinking on OpenRouter candidate tests', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(null) } };
    const rls = { withTransaction: jest.fn(async (fn: any) => fn({ activityLog: { create: jest.fn() } })) };
    const client = { createCandidateClient: jest.fn(() => ({ chat: { completions: { create } } })) };
    await new TestAiProviderConfigHandler(prisma as any, client as any, { fingerprint: jest.fn() } as any, rls as any)
      .execute(dto({ saveCredential: false }));
    expect(create.mock.calls[0][0]).not.toHaveProperty('thinking');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'deepseek/deepseek-v4-flash-0731',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      temperature: 0,
    }));
  });

  it('reports CAS loss instead of clobbering an existing row', async () => {
    const current = row({ testedConfigHash: 'hash' }); const txUpdate = jest.fn().mockResolvedValue({ count: 0 });
    const tx = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue({ configVersion: 3 }), updateMany: txUpdate }, activityLog: { create: jest.fn() } };
    const prisma = { aiProviderConfig: { findUnique: jest.fn().mockResolvedValue(current) } }; const rls = { withTransaction: jest.fn(async (fn: any) => fn(tx)) };
    const client = { createCandidateClient: jest.fn(() => ({ chat: { completions: { create: jest.fn().mockResolvedValue({}) } } })) }; const creds = { fingerprint: jest.fn().mockReturnValue('new'), encrypt: jest.fn().mockReturnValue('cipher') };
    await expect(new TestAiProviderConfigHandler(prisma as any, client as any, creds as any, rls as any).execute(dto())).rejects.toThrow(); expect(txUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ configVersion: 3 }) }));
  });
});
