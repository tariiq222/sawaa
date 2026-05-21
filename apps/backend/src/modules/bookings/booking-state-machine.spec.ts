import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import {
  assertTransition,
  BookingTransition,
  isTerminalStatus,
  TERMINAL_STATUSES,
  VALID_TRANSITIONS,
} from './booking-state-machine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALL_STATUSES = Object.values(BookingStatus);

function allTerminalCombinations(): Array<{ from: BookingStatus; transition: BookingTransition }> {
  const pairs: Array<{ from: BookingStatus; transition: BookingTransition }> = [];
  for (const from of TERMINAL_STATUSES) {
    for (const transition of Object.keys(VALID_TRANSITIONS) as BookingTransition[]) {
      if (VALID_TRANSITIONS[transition].from.length > 0) {
        // Only non-CREATE transitions are guard-checked; CREATE has empty `from`
        pairs.push({ from, transition });
      }
    }
  }
  return pairs;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BookingStateMachine — assertTransition', () => {
  describe('valid transitions succeed and return correct next status', () => {
    it('CONFIRM: PENDING → CONFIRMED', () => {
      expect(assertTransition(BookingStatus.PENDING, 'CONFIRM')).toBe(BookingStatus.CONFIRMED);
    });

    it('PAYMENT_CONFIRMED: PENDING → CONFIRMED', () => {
      expect(assertTransition(BookingStatus.PENDING, 'PAYMENT_CONFIRMED')).toBe(BookingStatus.CONFIRMED);
    });

    it('PAYMENT_CONFIRMED: AWAITING_PAYMENT → CONFIRMED', () => {
      expect(assertTransition(BookingStatus.AWAITING_PAYMENT, 'PAYMENT_CONFIRMED')).toBe(BookingStatus.CONFIRMED);
    });

    it('CLIENT_REQUEST_CANCEL: PENDING → CANCEL_REQUESTED', () => {
      expect(assertTransition(BookingStatus.PENDING, 'CLIENT_REQUEST_CANCEL')).toBe(BookingStatus.CANCEL_REQUESTED);
    });

    it('CLIENT_REQUEST_CANCEL: CONFIRMED → CANCEL_REQUESTED', () => {
      expect(assertTransition(BookingStatus.CONFIRMED, 'CLIENT_REQUEST_CANCEL')).toBe(BookingStatus.CANCEL_REQUESTED);
    });

    it('CLIENT_REQUEST_CANCEL: AWAITING_PAYMENT → CANCEL_REQUESTED', () => {
      expect(assertTransition(BookingStatus.AWAITING_PAYMENT, 'CLIENT_REQUEST_CANCEL')).toBe(BookingStatus.CANCEL_REQUESTED);
    });

    it('DIRECT_CANCEL: PENDING → CANCELLED', () => {
      expect(assertTransition(BookingStatus.PENDING, 'DIRECT_CANCEL')).toBe(BookingStatus.CANCELLED);
    });

    it('DIRECT_CANCEL: CONFIRMED → CANCELLED', () => {
      expect(assertTransition(BookingStatus.CONFIRMED, 'DIRECT_CANCEL')).toBe(BookingStatus.CANCELLED);
    });

    it('DIRECT_CANCEL: CANCEL_REQUESTED → CANCELLED', () => {
      expect(assertTransition(BookingStatus.CANCEL_REQUESTED, 'DIRECT_CANCEL')).toBe(BookingStatus.CANCELLED);
    });

    it('CLIENT_DIRECT_CANCEL: PENDING → CANCELLED', () => {
      expect(assertTransition(BookingStatus.PENDING, 'CLIENT_DIRECT_CANCEL')).toBe(BookingStatus.CANCELLED);
    });

    it('CLIENT_DIRECT_CANCEL: CONFIRMED → CANCELLED', () => {
      expect(assertTransition(BookingStatus.CONFIRMED, 'CLIENT_DIRECT_CANCEL')).toBe(BookingStatus.CANCELLED);
    });

    it('CLIENT_DIRECT_CANCEL: AWAITING_PAYMENT → CANCELLED', () => {
      expect(assertTransition(BookingStatus.AWAITING_PAYMENT, 'CLIENT_DIRECT_CANCEL')).toBe(BookingStatus.CANCELLED);
    });

    it('APPROVE_CANCEL: CANCEL_REQUESTED → CANCELLED', () => {
      expect(assertTransition(BookingStatus.CANCEL_REQUESTED, 'APPROVE_CANCEL')).toBe(BookingStatus.CANCELLED);
    });

    it('REJECT_CANCEL: CANCEL_REQUESTED → CONFIRMED', () => {
      expect(assertTransition(BookingStatus.CANCEL_REQUESTED, 'REJECT_CANCEL')).toBe(BookingStatus.CONFIRMED);
    });

    it('COMPLETE: CONFIRMED → COMPLETED', () => {
      expect(assertTransition(BookingStatus.CONFIRMED, 'COMPLETE')).toBe(BookingStatus.COMPLETED);
    });

    it('NO_SHOW: CONFIRMED → NO_SHOW', () => {
      expect(assertTransition(BookingStatus.CONFIRMED, 'NO_SHOW')).toBe(BookingStatus.NO_SHOW);
    });

    it('EXPIRE: PENDING → EXPIRED', () => {
      expect(assertTransition(BookingStatus.PENDING, 'EXPIRE')).toBe(BookingStatus.EXPIRED);
    });

    it('EXPIRE: PENDING_GROUP_FILL → EXPIRED', () => {
      expect(assertTransition(BookingStatus.PENDING_GROUP_FILL, 'EXPIRE')).toBe(BookingStatus.EXPIRED);
    });

    it('EXPIRE: AWAITING_PAYMENT → EXPIRED', () => {
      expect(assertTransition(BookingStatus.AWAITING_PAYMENT, 'EXPIRE')).toBe(BookingStatus.EXPIRED);
    });

    it('RESCHEDULE self-loop: CONFIRMED → CONFIRMED', () => {
      expect(assertTransition(BookingStatus.CONFIRMED, 'RESCHEDULE')).toBe(BookingStatus.CONFIRMED);
    });

    it('RESCHEDULE self-loop: PENDING → PENDING (preserves status)', () => {
      expect(assertTransition(BookingStatus.PENDING, 'RESCHEDULE')).toBe(BookingStatus.PENDING);
    });

    it('CHECK_IN self-loop: CONFIRMED → CONFIRMED', () => {
      expect(assertTransition(BookingStatus.CONFIRMED, 'CHECK_IN')).toBe(BookingStatus.CONFIRMED);
    });

    it('GROUP_FILL_REACHED_MIN: PENDING_GROUP_FILL → AWAITING_PAYMENT', () => {
      expect(assertTransition(BookingStatus.PENDING_GROUP_FILL, 'GROUP_FILL_REACHED_MIN')).toBe(BookingStatus.AWAITING_PAYMENT);
    });
  });

  describe('CREATE_* transitions bypass the from-guard (empty from list)', () => {
    it('CREATE_PENDING returns PENDING without requiring a from status', () => {
      // CREATE transitions are not called with assertTransition in practice —
      // but the function must handle them gracefully (from list is empty)
      expect(VALID_TRANSITIONS.CREATE_PENDING.to).toBe(BookingStatus.PENDING);
      expect(VALID_TRANSITIONS.CREATE_GROUP_FILL.to).toBe(BookingStatus.PENDING_GROUP_FILL);
      expect(VALID_TRANSITIONS.CREATE_AWAITING_PAYMENT.to).toBe(BookingStatus.AWAITING_PAYMENT);
      expect(VALID_TRANSITIONS.CREATE_CONFIRMED.to).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('terminal status → any non-CREATE transition throws', () => {
    it.each(allTerminalCombinations())(
      '$from + $transition → BadRequestException',
      ({ from, transition }) => {
        expect(() => assertTransition(from, transition)).toThrow(BadRequestException);
      },
    );
  });

  describe('invalid source status → throws with informative message', () => {
    it('CONFIRM from CONFIRMED throws and names the allowed statuses', () => {
      expect(() => assertTransition(BookingStatus.CONFIRMED, 'CONFIRM')).toThrow(
        /Allowed source statuses/,
      );
    });

    it('APPROVE_CANCEL from PENDING throws and names CANCEL_REQUESTED as allowed', () => {
      const err = (() => {
        try {
          assertTransition(BookingStatus.PENDING, 'APPROVE_CANCEL');
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toContain('CANCEL_REQUESTED');
    });

    it('COMPLETE from PENDING throws', () => {
      expect(() => assertTransition(BookingStatus.PENDING, 'COMPLETE')).toThrow(BadRequestException);
    });

    it('NO_SHOW from PENDING_GROUP_FILL throws', () => {
      expect(() =>
        assertTransition(BookingStatus.PENDING_GROUP_FILL, 'NO_SHOW'),
      ).toThrow(BadRequestException);
    });

    it('GROUP_FILL_REACHED_MIN from CONFIRMED throws (only valid from PENDING_GROUP_FILL)', () => {
      expect(() =>
        assertTransition(BookingStatus.CONFIRMED, 'GROUP_FILL_REACHED_MIN'),
      ).toThrow(BadRequestException);
    });

    it('error message includes transition name and from status', () => {
      const err = (() => {
        try {
          assertTransition(BookingStatus.EXPIRED, 'COMPLETE');
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(BadRequestException);
      const msg = (err as BadRequestException).message;
      expect(msg).toContain('COMPLETE');
      expect(msg).toContain('EXPIRED');
    });
  });

  describe('integration — impossible state sequences', () => {
    it('a CANCELLED booking cannot become CONFIRMED', () => {
      expect(() => assertTransition(BookingStatus.CANCELLED, 'CONFIRM')).toThrow(BadRequestException);
    });

    it('a CANCELLED booking cannot be cancelled again (DIRECT_CANCEL)', () => {
      expect(() =>
        assertTransition(BookingStatus.CANCELLED, 'DIRECT_CANCEL'),
      ).toThrow(BadRequestException);
    });

    it('a COMPLETED booking cannot be cancelled', () => {
      expect(() =>
        assertTransition(BookingStatus.COMPLETED, 'CLIENT_DIRECT_CANCEL'),
      ).toThrow(BadRequestException);
    });

    it('a COMPLETED booking cannot be cancelled (DIRECT_CANCEL)', () => {
      expect(() =>
        assertTransition(BookingStatus.COMPLETED, 'DIRECT_CANCEL'),
      ).toThrow(BadRequestException);
    });

    it('reschedule on CONFIRMED preserves CONFIRMED status', () => {
      expect(assertTransition(BookingStatus.CONFIRMED, 'RESCHEDULE')).toBe(BookingStatus.CONFIRMED);
    });
  });
});

describe('BookingStateMachine — isTerminalStatus', () => {
  it.each([
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
    BookingStatus.NO_SHOW,
    BookingStatus.EXPIRED,
  ])('%s is terminal', (status) => {
    expect(isTerminalStatus(status)).toBe(true);
  });

  it.each([
    BookingStatus.PENDING,
    BookingStatus.PENDING_GROUP_FILL,
    BookingStatus.AWAITING_PAYMENT,
    BookingStatus.CONFIRMED,
    BookingStatus.CANCEL_REQUESTED,
  ])('%s is NOT terminal', (status) => {
    expect(isTerminalStatus(status)).toBe(false);
  });
});

describe('BookingStateMachine — VALID_TRANSITIONS integrity', () => {
  it('no terminal status appears as a "from" state in any transition', () => {
    for (const [name, rule] of Object.entries(VALID_TRANSITIONS) as Array<[BookingTransition, { from: BookingStatus[]; to: BookingStatus }]>) {
      for (const fromStatus of rule.from) {
        expect(TERMINAL_STATUSES.has(fromStatus)).toBe(false);
        if (TERMINAL_STATUSES.has(fromStatus)) {
          // eslint-disable-next-line no-console
          console.error(`Violation: transition '${name}' lists terminal status '${fromStatus}' in its from[] list`);
        }
      }
    }
  });

  it('every "to" status is a valid BookingStatus value', () => {
    for (const rule of Object.values(VALID_TRANSITIONS)) {
      expect(ALL_STATUSES).toContain(rule.to);
    }
  });

  it('every "from" status is a valid BookingStatus value', () => {
    for (const rule of Object.values(VALID_TRANSITIONS)) {
      for (const from of rule.from) {
        expect(ALL_STATUSES).toContain(from);
      }
    }
  });
});
