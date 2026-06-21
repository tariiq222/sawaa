'use client';

import { type UseFormReturn } from 'react-hook-form';
import { Input, Textarea } from '@sawaa/ui';
import { useDepartmentOptions } from '@/hooks/use-departments';
import { useBranches } from '@/hooks/use-branches';
import type { CreateProgramFormValues } from '@/lib/schemas/program.schema';

export function ProgramFormBasics({ form }: { form: UseFormReturn<CreateProgramFormValues> }) {
  const departments = useDepartmentOptions();
  const branches = useBranches();
  const deptList = (departments.options ?? []) as Array<{ id: string; nameAr?: string }>;
  const branchList = (branches.branches ?? []) as Array<{ id: string; nameAr?: string }>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Name (Arabic)" error={form.formState.errors.nameAr?.message}>
        <Input {...form.register('nameAr')} />
      </Field>
      <Field label="Name (English)">
        <Input {...form.register('nameEn')} />
      </Field>

      <Field label="Department" error={form.formState.errors.departmentId?.message}>
        <select
          {...form.register('departmentId')}
          className="w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {deptList.map((d) => (
            <option key={d.id} value={d.id}>{d.nameAr}</option>
          ))}
        </select>
      </Field>

      <Field label="Branch" error={form.formState.errors.branchId?.message}>
        <select
          {...form.register('branchId')}
          className="w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {branchList.map((b) => (
            <option key={b.id} value={b.id}>{b.nameAr}</option>
          ))}
        </select>
      </Field>

      <div className="md:col-span-2">
        <Field label="Description (Arabic)">
          <Textarea rows={3} {...form.register('descriptionAr')} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Description (English)">
          <Textarea rows={3} {...form.register('descriptionEn')} />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-(--text-error)">{error}</p>}
    </label>
  );
}
