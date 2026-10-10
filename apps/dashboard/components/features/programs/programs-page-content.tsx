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
  onStatusFilterChange,
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

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 text-sm">
        {t('programs.column.status')}
        <select className="rounded border border-border bg-surface-solid p-2" value={statusFilter} onChange={e => onStatusFilterChange(e.target.value)}>
          <option value="ALL">{t('auditOperations.allStatuses')}</option>
          {(['DRAFT', 'OPEN', 'MIN_REACHED', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const).map(status => <option key={status} value={status}>{t(`programs.status.${status}`)}</option>)}
        </select>
      </label>
      {isError ? <p role="alert" className="text-sm text-error">{t('common.errorLoading')}</p>
        : isLoading ? <p role="status" className="text-sm text-muted-foreground">{t('common.loading')}</p>
        : !data?.length ? <EmptyState title={t('programs.empty')} />
        : <DataTable columns={columns} data={data} />}
    </div>
  );
}
