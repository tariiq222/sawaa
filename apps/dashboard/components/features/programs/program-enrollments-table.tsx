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
          header: t('programs.column.ref'),
          accessorFn: (e) => e.booking.bookingNumber as unknown as string,
          cell: ({ row }) => (
            <span className="font-mono">#{row.original.booking.bookingNumber}</span>
          ),
        },
        {
          id: 'clientId',
          header: t('programs.enrollment.client'),
          accessorFn: (e) => e.clientId,
          cell: ({ row }) => (
            <span className="text-sm">{row.original.clientId.slice(0, 8)}…</span>
          ),
        },
        {
          id: 'status',
          header: t('programs.column.status'),
          accessorFn: (e) => e.booking.status as unknown as string,
          cell: ({ row }) => (
            <span className="text-sm">
              {t(`bookings.status.${String(row.original.booking.status).toLowerCase()}`)}
            </span>
          ),
        },
        {
          id: 'price',
          header: t('programs.column.price'),
          accessorFn: (e) => e.booking.price,
          cell: ({ row }) => (
            <span className="tabular-nums text-sm">
              {(Number(row.original.booking.price) / 100).toFixed(2)}{' '}
              {t(`programs.currency.${row.original.booking.currency}`)}
            </span>
          ),
        },
        {
          id: 'enrolledAt',
          header: t('programs.enrollment.enrolledAt'),
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
