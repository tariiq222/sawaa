'use client';

import { useMemo } from 'react';
import { DataTable } from '@/components/features/data-table';
import { EmptyState } from '@/components/features/empty-state';
import { useLocale } from '@/components/locale-provider';
import { usePrograms } from '@/hooks/use-programs';
import { programColumns } from './program-columns';
import type { ProgramStatus } from '@/lib/types/program';

interface ProgramsPageContentProps {
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onSelect?: (id: string) => void;
}

export function ProgramsPageContent({
  statusFilter,
  onSelect,
}: ProgramsPageContentProps) {
  const { t } = useLocale();
  const queryArg = useMemo(
    () => (statusFilter && statusFilter !== 'ALL' ? { status: statusFilter as ProgramStatus } : {}),
    [statusFilter],
  );
  const { data, isLoading, isError } = usePrograms(queryArg);
  const columns = useMemo(
    () => programColumns({ onSelect: onSelect ?? (() => undefined), t }),
    [onSelect, t],
  );

  if (isError) {
    return <p className="text-sm text-(--text-error)">{t('common.errorLoading')}</p>;
  }
  if (!isLoading && (!data || data.length === 0)) {
    return <EmptyState title={t('programs.empty')} />;
  }

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
    />
  );
}
