'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { useLocale } from '@/components/locale-provider';
import { ProgramsPageContent } from '@/components/features/programs/programs-page-content';

export default function ProgramsPage() {
  const { t } = useLocale();
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-(--text-primary)">
            {t('programs.title')}
          </h1>
          <p className="mt-1 text-sm text-(--text-muted)">
            {t('programs.subtitle')}
          </p>
        </div>
        <Link
          href="/programs/create"
          className="inline-flex items-center gap-2 rounded-md bg-(--primary) px-3 py-2 text-sm font-medium text-(--primary-fg) hover:opacity-90"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          {t('programs.create')}
        </Link>
      </header>
      <ProgramsPageContent statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />
    </div>
  );
}
