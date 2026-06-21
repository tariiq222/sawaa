import type { ProgramStatus } from '@/lib/types/program';

export const PROGRAM_STATUS_VALUES: ProgramStatus[] = [
  'DRAFT',
  'OPEN',
  'MIN_REACHED',
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
];

export function isFullBadge(enrolled: number, max: number): boolean {
  return enrolled >= max;
}
