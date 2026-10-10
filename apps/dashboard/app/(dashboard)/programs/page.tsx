'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { useAuth } from '@/components/providers/auth-provider';
import { useLocale } from '@/components/locale-provider';
import { ListPageShell } from '@/components/features/list-page-shell';
import { PageHeader } from '@/components/features/page-header';
import { Breadcrumbs } from '@/components/features/breadcrumbs';
import { PermissionGuard } from '@/components/features/permission-guard';
import { ProgramsPageContent } from '@/components/features/programs/programs-page-content';

export default function ProgramsPage() {
  return (
    <PermissionGuard module="booking" action="read">
      <ProgramsPageInner />
    </PermissionGuard>
  );
}

function ProgramsPageInner() {
  const { t } = useLocale();
  const { canDo } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t('programs.title')} description={t('programs.subtitle')}>
        {canDo('booking', 'manage') && <Link
          href="/programs/create"
          className="inline-flex items-center gap-2 rounded-md bg-(--primary) px-3 py-2 text-sm font-medium text-(--primary-fg) hover:opacity-90"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          {t('programs.create')}
        </Link>}
      </PageHeader>
      <ProgramsPageContent statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />
    </ListPageShell>
  );
}
