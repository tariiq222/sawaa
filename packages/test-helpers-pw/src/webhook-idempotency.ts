import { type APIRequestContext, expect } from '@playwright/test';

export interface IdempotencyOptions {
  url: string;
  payload: unknown;
  headers?: Record<string, string>;
  /** Function that returns a count of side-effect rows (e.g., notifications sent, invoices created). */
  countSideEffects: () => Promise<number>;
}

/**
 * Posts the same payload twice and asserts the side-effect count is unchanged after
 * the second post. Used for Moyasar payment webhooks, billing webhooks, and SMS DLR
 * callbacks — all of which must be idempotent under replay (PRD §7).
 */
export async function assertWebhookIdempotent(
  ctx: APIRequestContext,
  opts: IdempotencyOptions,
): Promise<void> {
  const before = await opts.countSideEffects();

  const first = await ctx.post(opts.url, {
    headers: opts.headers,
    data: opts.payload,
  });
  expect(first.ok(), `first webhook post should succeed: ${first.status()}`).toBeTruthy();
  const afterFirst = await opts.countSideEffects();
  expect(afterFirst, 'first post should produce side effects').toBeGreaterThan(before);

  const second = await ctx.post(opts.url, {
    headers: opts.headers,
    data: opts.payload,
  });
  expect(second.ok(), `replay should still respond OK: ${second.status()}`).toBeTruthy();
  const afterSecond = await opts.countSideEffects();
  expect(
    afterSecond,
    'replay must NOT produce additional side effects (idempotency violated)',
  ).toBe(afterFirst);
}
