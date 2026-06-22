'use client';

import { type UseFormReturn } from 'react-hook-form';
import { Input } from '@sawaa/ui';
import { useLocale } from '@/components/locale-provider';
import type { CreateProgramFormValues } from '@/lib/schemas/program.schema';

export function ProgramFormCapacity({ form }: { form: UseFormReturn<CreateProgramFormValues> }) {
  const { t } = useLocale();
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t('programs.form.field.daysCount')}</span>
        <Input type="number" min={1} {...form.register('daysCount', { valueAsNumber: true })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t('programs.form.field.hoursPerDay')}</span>
        <Input type="number" min={1} {...form.register('hoursPerDay', { valueAsNumber: true })} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t('programs.form.field.minParticipants')}</span>
        <Input type="number" min={1} {...form.register('minParticipants', { valueAsNumber: true })} />
        {form.formState.errors.minParticipants && (
          <p className="mt-1 text-xs text-(--text-error)">{form.formState.errors.minParticipants.message}</p>
        )}
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t('programs.form.field.maxParticipants')}</span>
        <Input type="number" min={1} {...form.register('maxParticipants', { valueAsNumber: true })} />
      </label>
    </div>
  );
}
