'use client';

import { DataTable } from '@/components/features/data-table';
import { EmptyState } from '@/components/features/empty-state';
import { useLocale } from '@/components/locale-provider';
import type { ProgramEnrollmentSummary } from '@/lib/types/program';

export function ProgramEnrollmentsTable({
  enrollments,
}: {
  enrollments: ProgramEnrollmentSummary[];
}) {
  const { t } = useLocale();
  if (!enrollments.length) {
    return <EmptyState title={t('programs.detail.noEnrollments')} />;
  }

  return (
    <DataTable
      data={enrollments}
      columns={[
        {
          id: 'bookingNumber',
          header: 'Ref',
          accessorFn: (e) => e.booking.bookingNumber as unknown as string,
          cell: ({ row }) => (
            <span className="font-mono">#{row.original.booking.bookingNumber}</span>
          ),
        },
        {
          id: 'clientId',
          header: 'Client',
          accessorFn: (e) => e.clientId,
          cell: ({ row }) => (
            <span className="text-sm">{row.original.clientId.slice(0, 8)}…</span>
          ),
        },
        {
          id: 'status',
          header: 'Status',
          accessorFn: (e) => e.booking.status as unknown as string,
          cell: ({ row }) => <span className="text-sm">{row.original.booking.status}</span>,
        },
        {
          id: 'price',
          header: 'Price',
          accessorFn: (e) => e.booking.price,
          cell: ({ row }) => (
            <span className="tabular-nums text-sm">
              {(Number(row.original.booking.price) / 100).toFixed(2)} {row.original.booking.currency}
            </span>
          ),
        },
        {
          id: 'enrolledAt',
          header: 'Enrolled',
          accessorFn: (e) => e.enrolledAt,
          cell: ({ row }) => (
            <span className="text-sm text-(--text-muted)">
              {new Date(row.original.enrolledAt).toLocaleDateString()}
            </span>
          ),
        },
      ]}
    />
  );
}
