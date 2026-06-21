'use client';

import { Button } from '@sawaa/ui';
import type { ProgramSummary } from '@/lib/types/program';
import { halalasStringToSar } from '@/lib/schemas/program.schema';
import { ProgramStatusBadge } from './program-status-badge';

interface ProgramColumnsProps {
  onSelect: (id: string) => void;
}

export function programColumns({ onSelect }: ProgramColumnsProps) {
  return [
    {
      id: 'ref',
      header: 'Ref',
      accessorFn: (p: ProgramSummary) => p.ref,
      cell: ({ row }: { row: { original: ProgramSummary } }) => (
        <span className="font-mono text-(--text-muted)">#{row.original.ref}</span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      accessorFn: (p: ProgramSummary) => p.nameAr,
      cell: ({ row }: { row: { original: ProgramSummary } }) => (
        <Button
          variant="link"
          className="h-auto p-0 font-medium"
          onClick={() => onSelect(row.original.id)}
        >
          {row.original.nameAr}
        </Button>
      ),
    },
    {
      id: 'schedule',
      header: 'Schedule',
      accessorFn: (p: ProgramSummary) => p.daysCount,
      cell: ({ row }: { row: { original: ProgramSummary } }) => (
        <span className="text-sm text-(--text-muted)">
          {row.original.daysCount}d · {row.original.hoursPerDay}h
          {row.original.startDate
            ? ` · ${new Date(row.original.startDate).toLocaleDateString()}`
            : ''}
        </span>
      ),
    },
    {
      id: 'capacity',
      header: 'Capacity',
      accessorFn: (p: ProgramSummary) => p.enrolledCount,
      cell: ({ row }: { row: { original: ProgramSummary } }) => (
        <span className="tabular-nums text-sm">
          {row.original.enrolledCount}/{row.original.maxParticipants}
        </span>
      ),
    },
    {
      id: 'price',
      header: 'Price',
      accessorFn: (p: ProgramSummary) => p.price,
      cell: ({ row }: { row: { original: ProgramSummary } }) => (
        <span className="tabular-nums text-sm">
          {halalasStringToSar(row.original.price).toFixed(2)} {row.original.currency}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }: { row: { original: ProgramSummary } }) => (
        <ProgramStatusBadge
          status={row.original.status}
          enrolledCount={row.original.enrolledCount}
          maxParticipants={row.original.maxParticipants}
        />
      ),
    },
    {
      id: 'isPublic',
      header: 'Public',
      cell: ({ row }: { row: { original: ProgramSummary } }) =>
        row.original.isPublic ? (
          <span className="text-xs text-(--text-success)">●</span>
        ) : (
          <span className="text-xs text-(--text-muted)">—</span>
        ),
    },
    {
      id: 'createdAt',
      header: 'Created',
      accessorFn: (p: ProgramSummary) => p.createdAt,
      cell: ({ row }: { row: { original: ProgramSummary } }) => (
        <span className="text-sm text-(--text-muted)">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];
}
