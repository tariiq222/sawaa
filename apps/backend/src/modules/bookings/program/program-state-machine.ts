/**
 * Program State Machine
 * =====================
 * Single source of truth for Program lifecycle transitions.
 *
 * State diagram:
 *
 *   DRAFT ──OPEN_REGISTRATION──▶ OPEN ──MIN_REACHED──▶ MIN_REACHED
 *     │                          │                       │
 *     │                          ▼                       ▼
 *     │                       SCHEDULE ◀──────────── SCHEDULE
 *     │                          │
 *     │                          ▼
 *     │                      SCHEDULED ──COMPLETE──▶ COMPLETED (terminal)
 *     │                          │
 *     ▼                          ▼
 *   CANCEL ◀────────────────── CANCEL  (from DRAFT|OPEN|MIN_REACHED|SCHEDULED)
 *
 *   Enrollment is allowed in OPEN and MIN_REACHED only.
 *   FULL (no more seats) is a computed badge, not a stored state.
 *
 * The ProgramStatus values are defined locally as a const-typed string union
 * during the pre-migration phase. After the migration that introduces the
 * Prisma enum lands (commit B), the import in this file switches to
 * `import { ProgramStatus } from '@prisma/client'` and the local const is
 * deleted.
 */

import { BadRequestException } from '@nestjs/common';

export const ProgramStatus = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  MIN_REACHED: 'MIN_REACHED',
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type ProgramStatus = (typeof ProgramStatus)[keyof typeof ProgramStatus];

export type ProgramTransition =
  | 'OPEN_REGISTRATION'
  | 'MIN_REACHED'
  | 'SCHEDULE'
  | 'COMPLETE'
  | 'CANCEL';

export const VALID_PROGRAM_TRANSITIONS: Record<
  ProgramTransition,
  { from: ProgramStatus[]; to: ProgramStatus }
> = {
  OPEN_REGISTRATION: {
    from: [ProgramStatus.DRAFT],
    to: ProgramStatus.OPEN,
  },
  MIN_REACHED: {
    from: [ProgramStatus.OPEN],
    to: ProgramStatus.MIN_REACHED,
  },
  SCHEDULE: {
    from: [ProgramStatus.OPEN, ProgramStatus.MIN_REACHED],
    to: ProgramStatus.SCHEDULED,
  },
  COMPLETE: {
    from: [ProgramStatus.SCHEDULED],
    to: ProgramStatus.COMPLETED,
  },
  CANCEL: {
    from: [
      ProgramStatus.DRAFT,
      ProgramStatus.OPEN,
      ProgramStatus.MIN_REACHED,
      ProgramStatus.SCHEDULED,
    ],
    to: ProgramStatus.CANCELLED,
  },
};

export const PROGRAM_TERMINAL_STATUSES: ReadonlySet<ProgramStatus> = new Set([
  ProgramStatus.COMPLETED,
  ProgramStatus.CANCELLED,
]);

export function assertProgramTransition(
  from: ProgramStatus,
  transition: ProgramTransition,
): ProgramStatus {
  const rule = VALID_PROGRAM_TRANSITIONS[transition];
  if (!rule.from.includes(from)) {
    const allowed = rule.from.join(', ');
    throw new BadRequestException(
      `Cannot apply transition '${transition}' to a program in status '${from}'. ` +
        `Allowed source statuses: [${allowed}].`,
    );
  }
  return rule.to;
}

export function isProgramTerminalStatus(status: ProgramStatus): boolean {
  return PROGRAM_TERMINAL_STATUSES.has(status);
}

export function isProgramOpenForEnrollment(status: ProgramStatus): boolean {
  return status === ProgramStatus.OPEN || status === ProgramStatus.MIN_REACHED;
}
