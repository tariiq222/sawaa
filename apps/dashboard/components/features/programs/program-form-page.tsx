'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale } from '@/components/locale-provider';
import { Button } from '@sawaa/ui';
import { ProgramFormBasics } from './program-form-basics';
import { ProgramFormCapacity } from './program-form-capacity';
import { ProgramFormDeposit } from './program-form-deposit';
import { ProgramFormSupervisors } from './program-form-supervisors';
import {
  createProgramSchema,
  toCreateProgramPayload,
  type CreateProgramFormValues,
} from '@/lib/schemas/program.schema';
import { useCreateProgram, useProgram } from '@/hooks/use-programs';
import type { ProgramDetail } from '@/lib/types/program';

interface ProgramFormPageProps {
  mode: 'create' | 'edit';
  programId?: string;
}

const EMPTY_DEFAULTS: Partial<CreateProgramFormValues> = {
  currency: 'SAR',
  minParticipants: 1,
  maxParticipants: 10,
  daysCount: 4,
  hoursPerDay: 2,
  priceSar: 0,
  depositEnabled: false,
  isPublic: false,
  supervisorIds: [],
};

function fromExisting(existing: ProgramDetail | undefined): CreateProgramFormValues {
  if (!existing) return EMPTY_DEFAULTS as CreateProgramFormValues;
  return {
    departmentId: existing.departmentId,
    branchId: existing.branchId,
    nameAr: existing.nameAr,
    nameEn: existing.nameEn ?? '',
    descriptionAr: existing.descriptionAr ?? '',
    descriptionEn: existing.descriptionEn ?? '',
    daysCount: existing.daysCount,
    hoursPerDay: existing.hoursPerDay,
    minParticipants: existing.minParticipants,
    maxParticipants: existing.maxParticipants,
    priceSar: Number(existing.price) / 100,
    currency: existing.currency,
    depositEnabled: existing.depositEnabled,
    depositSar: existing.depositAmount ? Number(existing.depositAmount) / 100 : 0,
    isPublic: existing.isPublic,
    publicDescriptionAr: existing.publicDescriptionAr ?? '',
    publicDescriptionEn: existing.publicDescriptionEn ?? '',
    supervisorIds: existing.supervisorIds ?? [],
  };
}

export function ProgramFormPage({ mode, programId }: ProgramFormPageProps) {
  const { t } = useLocale();
  const router = useRouter();
  const create = useCreateProgram();
  const { data: existing, isLoading: loadingExisting } = useProgram(mode === 'edit' ? programId ?? '' : '');

  const form = useForm<CreateProgramFormValues>({
    resolver: zodResolver(createProgramSchema) as never,
    defaultValues: EMPTY_DEFAULTS as CreateProgramFormValues,
  });

  useEffect(() => {
    if (existing) form.reset(fromExisting(existing));
  }, [existing, form]);

  async function onSubmit(values: CreateProgramFormValues) {
    const payload = toCreateProgramPayload(values);
    const result = await create.mutateAsync(payload);
    const id = (result as { id: string }).id;
    router.push(`/programs/${id}`);
  }

  if (mode === 'edit' && loadingExisting) {
    return <p className="text-sm text-(--text-muted)">{t('common.loading')}</p>;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-(--text-primary)">
          {mode === 'create' ? t('programs.form.title.create') : t('programs.form.title.edit')}
        </h1>
      </header>

      <Section title={t('programs.form.section.basics')}>
        <ProgramFormBasics form={form as never} />
      </Section>
      <Section title={t('programs.form.section.supervisors')}>
        <ProgramFormSupervisors form={form as never} />
      </Section>
      <Section title={t('programs.form.section.capacity')}>
        <ProgramFormCapacity form={form as never} />
      </Section>
      <Section title={t('programs.form.section.deposit')}>
        <ProgramFormDeposit form={form as never} />
      </Section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push('/programs')}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="default" disabled={create.isPending}>
          {create.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-(--border) bg-(--surface) p-4">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
