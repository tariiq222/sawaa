import { parseSawaaAgentDecision, SAWAA_AGENT_DECISION_MAX_REPLY_CHARS } from './sawaa-agent-decision';

describe('parseSawaaAgentDecision', () => {
  it('projects a bounded Saudi customer reply and safe context', () => {
    expect(parseSawaaAgentDecision({
      reply: 'أبشر، حياك الله. كيف أقدر أخدمك؟', intent: 'SMALL_TALK', journeyStage: 'EXPLORING',
      factsUsed: [{ tool: 'getCenterInfo', recordIds: ['center-public'] }],
      contextPatch: { modality: 'ONLINE', budgetConcern: true, preferredDays: ['SATURDAY'] },
    })).toEqual({
      reply: 'أبشر، حياك الله. كيف أقدر أخدمك؟', intent: 'SMALL_TALK', journeyStage: 'EXPLORING',
      factsUsed: [{ tool: 'getCenterInfo', recordIds: ['center-public'] }],
      contextPatch: { modality: 'ONLINE', budgetConcern: true, preferredDays: ['SATURDAY'] },
    });
  });

  it.each([
    { intent: 'DIAGNOSE', journeyStage: 'EXPLORING' },
    { intent: 'SMALL_TALK', journeyStage: 'CLINICAL' },
  ])('rejects non-allowlisted values: %j', (values) => {
    expect(parseSawaaAgentDecision({ reply: 'حياك الله', ...values })).toBeNull();
  });

  it('rejects unknown, clinical, secret, URL, and oversized fields', () => {
    const base = { reply: 'حياك الله', intent: 'SMALL_TALK', journeyStage: 'EXPLORING' };
    expect(parseSawaaAgentDecision({ ...base, debug: 'raw prompt' })).toBeNull();
    expect(parseSawaaAgentDecision({ ...base, contextPatch: { diagnosis: 'x' } })).toBeNull();
    expect(parseSawaaAgentDecision({ ...base, reply: 'https://secret.example' })).toBeNull();
    expect(parseSawaaAgentDecision({ ...base, reply: 'x'.repeat(SAWAA_AGENT_DECISION_MAX_REPLY_CHARS + 1) })).toBeNull();
  });

  it.each([
    { factsUsed: [{ tool: 'getCenterInfo', recordIds: ['password=secret'] }] },
    { contextPatch: { preferredTimeWindow: 'bearer abc123' } },
    { handoffDraft: { category: 'OTHER', requestSummary: 'أرسل بيانات الدخول: abc', desiredOutcome: 'اتصال' } },
    { handoffDraft: { category: 'OTHER', requestSummary: 'بيانات الدخول abc', desiredOutcome: 'اتصال' } },
    { handoffDraft: { category: 'OTHER', requestSummary: 'رمز المرور abc', desiredOutcome: 'اتصال' } },
    { handoffDraft: { category: 'OTHER', requestSummary: 'السر abc', desiredOutcome: 'اتصال' } },
    { handoffDraft: { category: 'OTHER', requestSummary: 'توكن abc', desiredOutcome: 'اتصال' } },
    { handoffDraft: { category: 'OTHER', requestSummary: 'credentials abc', desiredOutcome: 'اتصال' } },
    { handoffDraft: { category: 'OTHER', requestSummary: 'secret abc', desiredOutcome: 'اتصال' } },
  ])('rejects explicit secret disclosure patterns in every string field: %j', (extra) => {
    expect(parseSawaaAgentDecision({ reply: 'حياك الله', intent: 'SMALL_TALK', journeyStage: 'EXPLORING', ...extra })).toBeNull();
  });

  it('does not reject benign secret-adjacent wording', () => {
    expect(parseSawaaAgentDecision({ reply: 'الخدمة سرية ومريحة', intent: 'SMALL_TALK', journeyStage: 'EXPLORING' })).not.toBeNull();
  });

  it('rejects inherited fields and non-plain objects at every nested level', () => {
    const root = Object.create({ reply: 'حياك الله', intent: 'SMALL_TALK', journeyStage: 'EXPLORING' });
    expect(parseSawaaAgentDecision(root)).toBeNull();

    const nestedFacts = Object.create({ tool: 'getCenterInfo', recordIds: ['center'] });
    expect(parseSawaaAgentDecision({ reply: 'حياك الله', intent: 'SMALL_TALK', journeyStage: 'EXPLORING', factsUsed: [nestedFacts] })).toBeNull();

    const nestedContext = Object.create({ modality: 'ONLINE' });
    expect(parseSawaaAgentDecision({ reply: 'حياك الله', intent: 'SMALL_TALK', journeyStage: 'EXPLORING', contextPatch: nestedContext })).toBeNull();

    const nestedHandoff = Object.create({ category: 'OTHER', requestSummary: 'طلب', desiredOutcome: 'اتصال' });
    expect(parseSawaaAgentDecision({ reply: 'حياك الله', intent: 'HANDOFF', journeyStage: 'HANDOFF', handoffDraft: nestedHandoff })).toBeNull();
  });

  it('does not mutate inputs and returns an independent projection', () => {
    const input = { reply: 'حياك الله', intent: 'SMALL_TALK', journeyStage: 'EXPLORING', contextPatch: { preferredDays: ['SATURDAY'] } };
    const result = parseSawaaAgentDecision(input);
    expect(result).not.toBe(input);
    expect(result?.contextPatch).not.toBe(input.contextPatch);
    expect(input).toEqual({ reply: 'حياك الله', intent: 'SMALL_TALK', journeyStage: 'EXPLORING', contextPatch: { preferredDays: ['SATURDAY'] } });
  });
});
