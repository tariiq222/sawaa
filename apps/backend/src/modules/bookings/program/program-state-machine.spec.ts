import { BadRequestException } from '@nestjs/common';
import {
  assertProgramTransition,
  isProgramOpenForEnrollment,
  isProgramTerminalStatus,
  ProgramStatus,
  PROGRAM_TERMINAL_STATUSES,
  type ProgramTransition,
  VALID_PROGRAM_TRANSITIONS,
} from './program-state-machine';

const ALL_STATUSES: ProgramStatus[] = Object.values(ProgramStatus);

function allTerminalCombinations(): Array<{ from: ProgramStatus; transition: ProgramTransition }> {
  const pairs: Array<{ from: ProgramStatus; transition: ProgramTransition }> = [];
  for (const from of PROGRAM_TERMINAL_STATUSES) {
    for (const transition of Object.keys(VALID_PROGRAM_TRANSITIONS) as ProgramTransition[]) {
      pairs.push({ from, transition });
    }
  }
  return pairs;
}

describe('ProgramStateMachine — assertProgramTransition', () => {
  describe('valid transitions succeed and return correct next status', () => {
    it('OPEN_REGISTRATION: DRAFT → OPEN', () => {
      expect(assertProgramTransition(ProgramStatus.DRAFT, 'OPEN_REGISTRATION')).toBe(
        ProgramStatus.OPEN,
      );
    });

    it('MIN_REACHED: OPEN → MIN_REACHED', () => {
      expect(assertProgramTransition(ProgramStatus.OPEN, 'MIN_REACHED')).toBe(
        ProgramStatus.MIN_REACHED,
      );
    });

    it('SCHEDULE: OPEN → SCHEDULED', () => {
      expect(assertProgramTransition(ProgramStatus.OPEN, 'SCHEDULE')).toBe(
        ProgramStatus.SCHEDULED,
      );
    });

    it('SCHEDULE: MIN_REACHED → SCHEDULED', () => {
      expect(assertProgramTransition(ProgramStatus.MIN_REACHED, 'SCHEDULE')).toBe(
        ProgramStatus.SCHEDULED,
      );
    });

    it('COMPLETE: SCHEDULED → COMPLETED', () => {
      expect(assertProgramTransition(ProgramStatus.SCHEDULED, 'COMPLETE')).toBe(
        ProgramStatus.COMPLETED,
      );
    });

    it('CANCEL: DRAFT → CANCELLED', () => {
      expect(assertProgramTransition(ProgramStatus.DRAFT, 'CANCEL')).toBe(
        ProgramStatus.CANCELLED,
      );
    });

    it('CANCEL: OPEN → CANCELLED', () => {
      expect(assertProgramTransition(ProgramStatus.OPEN, 'CANCEL')).toBe(
        ProgramStatus.CANCELLED,
      );
    });

    it('CANCEL: MIN_REACHED → CANCELLED', () => {
      expect(assertProgramTransition(ProgramStatus.MIN_REACHED, 'CANCEL')).toBe(
        ProgramStatus.CANCELLED,
      );
    });

    it('CANCEL: SCHEDULED → CANCELLED', () => {
      expect(assertProgramTransition(ProgramStatus.SCHEDULED, 'CANCEL')).toBe(
        ProgramStatus.CANCELLED,
      );
    });
  });

  describe('invalid source status → throws BadRequestException', () => {
    it('OPEN_REGISTRATION from OPEN throws', () => {
      expect(() =>
        assertProgramTransition(ProgramStatus.OPEN, 'OPEN_REGISTRATION'),
      ).toThrow(BadRequestException);
    });

    it('MIN_REACHED from MIN_REACHED throws (no self-loop)', () => {
      expect(() =>
        assertProgramTransition(ProgramStatus.MIN_REACHED, 'MIN_REACHED'),
      ).toThrow(BadRequestException);
    });

    it('SCHEDULE from SCHEDULED throws (idempotency not allowed)', () => {
      expect(() =>
        assertProgramTransition(ProgramStatus.SCHEDULED, 'SCHEDULE'),
      ).toThrow(BadRequestException);
    });

    it('COMPLETE from OPEN throws (must be SCHEDULED first)', () => {
      expect(() => assertProgramTransition(ProgramStatus.OPEN, 'COMPLETE')).toThrow(
        BadRequestException,
      );
    });

    it('OPEN_REGISTRATION from SCHEDULED throws', () => {
      expect(() =>
        assertProgramTransition(ProgramStatus.SCHEDULED, 'OPEN_REGISTRATION'),
      ).toThrow(BadRequestException);
    });

    it('error message includes transition name and from status', () => {
      const err = (() => {
        try {
          assertProgramTransition(ProgramStatus.COMPLETED, 'CANCEL');
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(BadRequestException);
      const msg = (err as BadRequestException).message;
      expect(msg).toContain('CANCEL');
      expect(msg).toContain('COMPLETED');
    });
  });

  describe('terminal status → any transition throws', () => {
    it.each(allTerminalCombinations())(
      '$from + $transition → BadRequestException',
      ({ from, transition }) => {
        expect(() => assertProgramTransition(from, transition)).toThrow(BadRequestException);
      },
    );
  });
});

describe('ProgramStateMachine — isProgramTerminalStatus', () => {
  it.each([ProgramStatus.COMPLETED, ProgramStatus.CANCELLED])('%s is terminal', (status) => {
    expect(isProgramTerminalStatus(status)).toBe(true);
  });

  it.each([
    ProgramStatus.DRAFT,
    ProgramStatus.OPEN,
    ProgramStatus.MIN_REACHED,
    ProgramStatus.SCHEDULED,
  ])('%s is NOT terminal', (status) => {
    expect(isProgramTerminalStatus(status)).toBe(false);
  });
});

describe('ProgramStateMachine — isProgramOpenForEnrollment', () => {
  it.each([ProgramStatus.OPEN, ProgramStatus.MIN_REACHED])(
    '%s allows enrollment',
    (status) => {
      expect(isProgramOpenForEnrollment(status)).toBe(true);
    },
  );

  it.each([
    ProgramStatus.DRAFT,
    ProgramStatus.SCHEDULED,
    ProgramStatus.COMPLETED,
    ProgramStatus.CANCELLED,
  ])('%s blocks enrollment', (status) => {
    expect(isProgramOpenForEnrollment(status)).toBe(false);
  });
});

describe('ProgramStateMachine — VALID_PROGRAM_TRANSITIONS integrity', () => {
  it('no terminal status appears as a "from" state', () => {
    for (const [name, rule] of Object.entries(VALID_PROGRAM_TRANSITIONS) as Array<
      [ProgramTransition, { from: ProgramStatus[]; to: ProgramStatus }]
    >) {
      for (const fromStatus of rule.from) {
        expect(PROGRAM_TERMINAL_STATUSES.has(fromStatus)).toBe(false);
        if (PROGRAM_TERMINAL_STATUSES.has(fromStatus)) {
          console.error(
            `Violation: transition '${name}' lists terminal status '${fromStatus}' in its from[] list`,
          );
        }
      }
    }
  });

  it('every "to" status is a valid ProgramStatus value', () => {
    for (const rule of Object.values(VALID_PROGRAM_TRANSITIONS)) {
      expect(ALL_STATUSES).toContain(rule.to);
    }
  });

  it('every "from" status is a valid ProgramStatus value', () => {
    for (const rule of Object.values(VALID_PROGRAM_TRANSITIONS)) {
      for (const from of rule.from) {
        expect(ALL_STATUSES).toContain(from);
      }
    }
  });
});
