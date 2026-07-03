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
import { useCreateProgram, useProgram, useUpdateProgram } from '@/hooks/use-programs';
import type { CreateProgramPayload, ProgramDetail, UpdateProgramPayload } from '@/lib/types/program';

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

/**
 * Pure submit helper — routes the program form to the correct mutation
 * based on `mode`. Centralised so the wiring can be unit-tested without
 * rendering the form tree.
 *
 * `create` and `update` are objects exposing the `mutateAsync` method of
 * the corresponding TanStack Query mutation — the caller injects them so
 * the helper stays free of React / query-client concerns.
 *
 * Returns the mutation result (the backend's `{ id }` payload, possibly
 * plus `status`/`supervisorIds` on edit). The caller decides where to
 * navigate afterwards.
 */
export async function submitProgram(args: {
  mode: 'create' | 'edit';
  programId?: string;
  create: { mutateAsync: (payload: CreateProgramPayload) => Promise<unknown> };
  update: { mutateAsync: (input: { id: string; payload: UpdateProgramPayload }) => Promise<unknown> };
  values: CreateProgramFormValues;
}): Promise<{ id: string }> {
  const payload = toCreateProgramPayload(args.values);
  if (args.mode === 'edit') {
    if (!args.programId) {
      throw new Error('submitProgram: programId is required for mode="edit"');
    }
    const result = (await args.update.mutateAsync({ id: args.programId, payload })) as { id: string };
    return { id: result.id };
  }
  const result = (await args.create.mutateAsync(payload)) as { id: string };
  return { id: result.id };
}

export function ProgramFormPage({ mode, programId }: ProgramFormPageProps) {
  const { t } = useLocale();
  const router = useRouter();
  const create = useCreateProgram();
  const update = useUpdateProgram();
  const { data: existing, isLoading: loadingExisting } = useProgram(mode === 'edit' ? programId ?? '' : '');

  const form = useForm<CreateProgramFormValues>({
    resolver: zodResolver(createProgramSchema) as never,
    defaultValues: EMPTY_DEFAULTS as CreateProgramFormValues,
  });

  useEffect(() => {
    if (existing) form.reset(fromExisting(existing));
  }, [existing, form]);

  async function onSubmit(values: CreateProgramFormValues) {
    // submitProgram routes the mutation based on mode — create uses
    // useCreateProgram, edit uses useUpdateProgram with the programId.
    const result = await submitProgram({
      mode,
      programId,
      create,
      update,
      values,
    });
    const id = (result as { id: string }).id;
    router.push(`/programs/${id}`);
  }

  if (mode === 'edit' && loadingExisting) {
    return <p className="text-sm text-(--text-muted)">{t('common.loading')}</p>;
  }

  const pending = mode === 'edit' ? update.isPending : create.isPending;

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
        <Button type="submit" variant="default" disabled={pending}>
          {pending ? t('common.saving') : t('common.save')}
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
