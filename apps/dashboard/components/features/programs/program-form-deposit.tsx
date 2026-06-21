'use client';

import { type UseFormReturn } from 'react-hook-form';
import { Input } from '@sawaa/ui';
import type { CreateProgramFormValues } from '@/lib/schemas/program.schema';

export function ProgramFormDeposit({ form }: { form: UseFormReturn<CreateProgramFormValues> }) {
  const depositEnabled = form.watch('depositEnabled');

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <label className="block md:col-span-1">
        <span className="mb-1 block text-sm font-medium">Price (SAR)</span>
        <Input
          type="number"
          min={0}
          step="0.01"
          {...form.register('priceSar', { valueAsNumber: true })}
        />
        {form.formState.errors.priceSar && (
          <p className="mt-1 text-xs text-(--text-error)">{form.formState.errors.priceSar.message}</p>
        )}
      </label>
      <label className="md:col-span-1 flex items-center gap-2 pt-6">
        <input
          type="checkbox"
          {...form.register('depositEnabled')}
          className="size-4"
        />
        <span className="text-sm font-medium">Enable deposit</span>
      </label>
      {depositEnabled && (
        <label className="block md:col-span-1">
          <span className="mb-1 block text-sm font-medium">Deposit (SAR)</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            {...form.register('depositSar', { valueAsNumber: true })}
          />
          {form.formState.errors.depositSar && (
            <p className="mt-1 text-xs text-(--text-error)">{form.formState.errors.depositSar.message}</p>
          )}
        </label>
      )}
    </div>
  );
}
