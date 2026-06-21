'use client';

import { Badge } from '@sawaa/ui';
import { isFullBadge } from './program-status';

interface ProgramStatusBadgeProps {
  status: string;
  enrolledCount: number;
  maxParticipants: number;
}

export function ProgramStatusBadge({ status, enrolledCount, maxParticipants }: ProgramStatusBadgeProps) {
  const full = isFullBadge(enrolledCount, maxParticipants);
  if (full) return <Badge variant="warning">مكتمل العدد</Badge>;
  return <Badge variant={statusVariant(status)}>{status}</Badge>;
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
