import { mergeSawaaCustomerContext } from './sawaa-customer-context';

const serviceId = '11111111-1111-4111-8111-111111111111';
const practitionerId = '22222222-2222-4222-8222-222222222222';

describe('mergeSawaaCustomerContext', () => {
  it('projects and merges the allowed non-clinical journey fields', () => {
    expect(mergeSawaaCustomerContext(null, {
      journeyStage: 'READY_TO_BOOK', serviceInterestIds: [serviceId], practitionerPreferenceIds: [practitionerId],
      modality: 'ONLINE', preferredDays: ['SATURDAY'], preferredTimeWindow: 'EVENING', budgetConcern: true,
      selectedServiceId: serviceId, selectedPractitionerId: practitionerId,
    })).toEqual({ journeyStage: 'READY_TO_BOOK', serviceInterestIds: [serviceId], practitionerPreferenceIds: [practitionerId], modality: 'ONLINE', preferredDays: ['SATURDAY'], preferredTimeWindow: 'EVENING', budgetConcern: true, selectedServiceId: serviceId, selectedPractitionerId: practitionerId });
  });

  it('preserves prior fields and explicitly replaces supplied fields', () => {
    const current = { journeyStage: 'EXPLORING', serviceInterestIds: [serviceId], budgetConcern: false };
    expect(mergeSawaaCustomerContext(current, { modality: 'IN_PERSON', budgetConcern: true })).toEqual({ journeyStage: 'EXPLORING', serviceInterestIds: [serviceId], budgetConcern: true, modality: 'IN_PERSON' });
  });

  it.each([
    { symptoms: 'pain' }, { diagnosis: 'anxiety' }, { risk: 'high' }, { clinicalNotes: 'private note' },
    { unknown: true }, { serviceInterestIds: Array.from({ length: 11 }, () => serviceId) },
    { selectedServiceId: 'not-an-id' }, { practitionerPreferenceIds: ['not-an-id'] },
  ])('rejects unsafe or unbounded patches: %j', (patch) => {
    expect(mergeSawaaCustomerContext(null, patch)).toBeNull();
  });

  it('does not read inherited fields from non-plain objects', () => {
    const inherited = Object.create({
      journeyStage: 'HANDOFF', serviceInterestIds: [serviceId], practitionerPreferenceIds: [practitionerId],
      preferredDays: ['SATURDAY'], selectedServiceId: serviceId, selectedPractitionerId: practitionerId,
      budgetConcern: true,
    });
    expect(mergeSawaaCustomerContext(null, inherited)).toBeNull();
  });

  it('ignores temporary Object.prototype pollution and does not pollute the result', () => {
    const prototype = Object.prototype as Record<string, unknown>;
    const original = prototype.budgetConcern;
    try {
      prototype.budgetConcern = true;
      const input = {};
      const result = mergeSawaaCustomerContext(null, input);
      expect(result).toEqual({});
      expect(Object.prototype.hasOwnProperty.call(result, 'budgetConcern')).toBe(false);
      expect(input).toEqual({});
    } finally {
      if (original === undefined) delete prototype.budgetConcern;
      else prototype.budgetConcern = original;
    }
  });

  it('does not mutate plain inputs while projecting own fields', () => {
    const patch = { serviceInterestIds: [serviceId], preferredDays: ['SATURDAY'], budgetConcern: true };
    const before = JSON.parse(JSON.stringify(patch));
    const result = mergeSawaaCustomerContext(null, patch);
    expect(result).toEqual(before);
    expect(patch).toEqual(before);
    expect(result).not.toBe(patch);
    expect(result?.serviceInterestIds).not.toBe(patch.serviceInterestIds);
  });
});
