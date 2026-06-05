import { BadRequestException } from '@nestjs/common';
import { assertValidTransition } from './payment-state-machine';

describe('payment-state-machine (R-08 partial refunds)', () => {
  it('allows COMPLETED → PARTIALLY_REFUNDED and COMPLETED → REFUNDED', () => {
    expect(() => assertValidTransition('COMPLETED', 'PARTIALLY_REFUNDED')).not.toThrow();
    expect(() => assertValidTransition('COMPLETED', 'REFUNDED')).not.toThrow();
  });

  it('allows further partials and full close from PARTIALLY_REFUNDED', () => {
    expect(() => assertValidTransition('PARTIALLY_REFUNDED', 'PARTIALLY_REFUNDED')).not.toThrow();
    expect(() => assertValidTransition('PARTIALLY_REFUNDED', 'REFUNDED')).not.toThrow();
  });

  it('treats REFUNDED as terminal', () => {
    expect(() => assertValidTransition('REFUNDED', 'REFUNDED')).toThrow(BadRequestException);
    expect(() => assertValidTransition('REFUNDED', 'PARTIALLY_REFUNDED')).toThrow(BadRequestException);
  });

  it('does not allow refunding a partially-refunded payment back to COMPLETED', () => {
    expect(() => assertValidTransition('PARTIALLY_REFUNDED', 'COMPLETED')).toThrow(BadRequestException);
  });

  it('still rejects nonsensical transitions', () => {
    expect(() => assertValidTransition('PENDING', 'REFUNDED')).toThrow(BadRequestException);
    expect(() => assertValidTransition('FAILED', 'REFUNDED')).toThrow(BadRequestException);
  });
});
