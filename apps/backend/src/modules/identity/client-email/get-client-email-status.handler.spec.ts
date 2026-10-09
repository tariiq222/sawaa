import { GetClientEmailStatusHandler } from './get-client-email-status.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetClientEmailStatusHandler', () => {
  const fields = { isActive: true, deletedAt: null };
  function handlerFor(client: Record<string, unknown> | null) {
    const prisma = { client: { findUnique: jest.fn(async () => client) } };
    return new GetClientEmailStatusHandler(prisma as never);
  }

  it('returns the verified email with status verified', async () => {
    const result = await handlerFor({ ...fields, email: 'Person@Example.test', emailVerified: new Date(), pendingEmail: null, emailPromptResolvedAt: null }).execute('client-a');
    expect(result).toEqual({ status: 'verified', email: 'Person@Example.test', pendingEmail: null, prompt: false });
  });

  it('never returns a legacy unverified email and prompts for it', async () => {
    const result = await handlerFor({ ...fields, email: 'legacy@example.test', emailVerified: null, pendingEmail: null, emailPromptResolvedAt: null }).execute('client-a');
    expect(result).toEqual({ status: 'unverified', email: null, pendingEmail: null, prompt: true });
  });

  it('prefers pending over an unverified legacy email', async () => {
    const result = await handlerFor({ ...fields, email: 'legacy@example.test', emailVerified: null, pendingEmail: 'new@example.test', emailPromptResolvedAt: null }).execute('client-a');
    expect(result.status).toBe('pending');
    expect(result.email).toBeNull();
    expect(result.pendingEmail).toBe('new@example.test');
  });

  it('prefers verified over pending while still surfacing the pending value', async () => {
    const result = await handlerFor({ ...fields, email: 'old@example.test', emailVerified: new Date(), pendingEmail: 'new@example.test', emailPromptResolvedAt: null }).execute('client-a');
    expect(result.status).toBe('verified');
    expect(result.email).toBe('old@example.test');
    expect(result.pendingEmail).toBe('new@example.test');
  });

  it('stops prompting once the prompt is resolved', async () => {
    const result = await handlerFor({ ...fields, email: 'legacy@example.test', emailVerified: null, pendingEmail: null, emailPromptResolvedAt: new Date() }).execute('client-a');
    expect(result.prompt).toBe(false);
  });

  it('never prompts without an email', async () => {
    const result = await handlerFor({ ...fields, email: null, emailVerified: null, pendingEmail: null, emailPromptResolvedAt: null }).execute('client-a');
    expect(result).toEqual({ status: 'none', email: null, pendingEmail: null, prompt: false });
  });

  it.each([
    ['missing', null],
    ['inactive', { ...fields, isActive: false, email: 'x@example.test', emailVerified: new Date(), pendingEmail: null, emailPromptResolvedAt: null }],
    ['deleted', { ...fields, deletedAt: new Date(), email: 'x@example.test', emailVerified: new Date(), pendingEmail: null, emailPromptResolvedAt: null }],
  ])('returns none for a %s client', async (_label, client) => {
    const result = await handlerFor(client).execute('client-a');
    expect(result).toEqual({ status: 'none', email: null, pendingEmail: null, prompt: false });
  });
});
