'use client';

import { Badge } from '@sawaa/ui';
import { isFullBadge } from './program-status';

interface ProgramStatusBadgeProps {
  status: string;
  enrolledCount: number;
  maxParticipants: number;
  t: (key: string) => string;
}

export function ProgramStatusBadge({ status, enrolledCount, maxParticipants, t }: ProgramStatusBadgeProps) {
  const full = isFullBadge(enrolledCount, maxParticipants);
  if (full) return <Badge variant="warning">{t('programs.fullBadge')}</Badge>;
  return <Badge variant={statusVariant(status)}>{t(`programs.status.${status}`)}</Badge>;
}

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'OPEN':
    case 'MIN_REACHED':
      return 'success';
    case 'SCHEDULED':
      return 'default';
    case 'COMPLETED':
      return 'secondary';
    case 'CANCELLED':
      return 'destructive';
    default:
      return 'default';
  }
}
