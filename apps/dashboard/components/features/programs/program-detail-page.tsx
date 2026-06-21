'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@sawaa/ui';
import { useLocale } from '@/components/locale-provider';
import { useProgram, usePublishProgram, useScheduleProgram, useCancelProgram } from '@/hooks/use-programs';
import { ProgramStatusBadge } from './program-status-badge';
import { ScheduleProgramDialog } from './schedule-program-dialog';
import { CancelProgramDialog } from './cancel-program-dialog';
import { EnrollClientDialog } from './enroll-client-dialog';
import { ProgramEnrollmentsTable } from './program-enrollments-table';
import { halalasStringToSar } from '@/lib/schemas/program.schema';

export function ProgramDetailPage({ id }: { id: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const { data: program, isLoading, isError } = useProgram(id);
  const publish = usePublishProgram();
  const schedule = useScheduleProgram();
  const cancel = useCancelProgram();

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  if (isLoading) return <p className="text-sm text-(--text-muted)">{t('common.loading')}</p>;
  if (isError || !program) return <p className="text-sm text-(--text-error)">{t('common.errorLoading')}</p>;

  const canPublish = program.status === 'DRAFT';
  const canSchedule = program.status === 'OPEN' || program.status === 'MIN_REACHED';
  const canCancel = program.status !== 'COMPLETED' && program.status !== 'CANCELLED';
  const canEnroll = (program.status === 'OPEN' || program.status === 'MIN_REACHED') && !program.isFull;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-(--text-muted)">#{program.ref}</p>
          <h1 className="text-2xl font-semibold text-(--text-primary)">{program.nameAr}</h1>
          {program.nameEn && <p className="text-sm text-(--text-muted)">{program.nameEn}</p>}
        </div>
        <ProgramStatusBadge
          status={program.status}
          enrolledCount={program.enrolledCount}
          maxParticipants={program.maxParticipants}
        />
      </header>

      <div className="flex flex-wrap gap-2">
        {canPublish && (
          <Button variant="default" disabled={publish.isPending} onClick={() => publish.mutate(program.id)}>
            {t('programs.publish')}
          </Button>
        )}
        {canSchedule && (
          <Button variant="secondary" onClick={() => setScheduleOpen(true)}>
            {t('programs.schedule')}
          </Button>
        )}
        {canEnroll && (
          <Button variant="secondary" onClick={() => setEnrollOpen(true)}>
            {t('programs.enroll')}
          </Button>
        )}
        {canCancel && (
          <Button variant="destructive" onClick={() => setCancelOpen(true)}>
            {t('programs.cancel')}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-lg border border-(--border) bg-(--surface) p-4">
          <h3 className="mb-2 text-sm font-medium text-(--text-muted)">Schedule</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-(--text-muted)">{t('programs.detail.daysCount')}</dt>
              <dd className="tabular-nums">{program.daysCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-(--text-muted)">{t('programs.detail.hoursPerDay')}</dt>
              <dd className="tabular-nums">{program.hoursPerDay}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-(--text-muted)">{t('programs.detail.startDate')}</dt>
              <dd>{program.startDate ? new Date(program.startDate).toLocaleDateString() : '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-(--border) bg-(--surface) p-4">
          <h3 className="mb-2 text-sm font-medium text-(--text-muted)">{t('programs.column.capacity')}</h3>
          <p className="text-2xl font-semibold tabular-nums">
            {program.enrolledCount}
            <span className="text-base text-(--text-muted)"> / {program.maxParticipants}</span>
          </p>
          <p className="mt-1 text-xs text-(--text-muted)">
            {t('programs.detail.enrollmentCount')} · min {program.minParticipants}
          </p>
        </section>

        <section className="rounded-lg border border-(--border) bg-(--surface) p-4">
          <h3 className="mb-2 text-sm font-medium text-(--text-muted)">{t('programs.column.price')}</h3>
          <p className="text-2xl font-semibold tabular-nums">
            {halalasStringToSar(program.price).toFixed(2)} {program.currency}
          </p>
          <p className="mt-1 text-xs text-(--text-muted)">
            {program.depositEnabled
              ? `${t('programs.detail.depositEnabled')} · ${halalasStringToSar(program.depositAmount ?? '0').toFixed(2)} ${program.currency}`
              : t('programs.detail.depositDisabled')}
          </p>
          <p className="mt-1 text-xs text-(--text-muted)">
            {program.isPublic
              ? t('programs.detail.publicListing.yes')
              : t('programs.detail.publicListing.no')}
          </p>
        </section>
      </div>

      <section className="rounded-lg border border-(--border) bg-(--surface) p-4">
        <h3 className="mb-3 text-base font-semibold">{t('programs.detail.enrollments')}</h3>
        <ProgramEnrollmentsTable enrollments={program.enrollments ?? []} />
      </section>

      <ScheduleProgramDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        programId={program.id}
        onConfirm={async (startDate) => {
          await schedule.mutateAsync({ id: program.id, payload: { startDate } });
          setScheduleOpen(false);
        }}
      />
      <CancelProgramDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={async (reason) => {
          await cancel.mutateAsync({ id: program.id, payload: { reason } });
          setCancelOpen(false);
          router.push('/programs');
        }}
      />
      <EnrollClientDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        programId={program.id}
      />
    </div>
  );
}
