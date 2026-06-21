'use client';

import { useState } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { Input, Badge } from '@sawaa/ui';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { useEmployees } from '@/hooks/use-employees';
import type { CreateProgramFormValues } from '@/lib/schemas/program.schema';

export function ProgramFormSupervisors({ form }: { form: UseFormReturn<CreateProgramFormValues> }) {
  const [search, setSearch] = useState('');
  const employees = useEmployees();
  const employeesList = (employees.employees ?? []) as Array<{ id: string; name?: string; specialty?: string }>;
  const filtered = employeesList.filter((e) => {
    if (!search) return true;
    return (e.name ?? '').toLowerCase().includes(search.toLowerCase());
  });
  const selectedIds: string[] = form.watch('supervisorIds') ?? [];
  const selected = employeesList.filter((e) => selectedIds.includes(e.id));

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    form.setValue('supervisorIds', next, { shouldValidate: true });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-(--text-muted)">Pick one or more supervisors to lead the sessions.</p>
      <div className="relative">
        <HugeiconsIcon icon={Search01Icon} className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-(--text-muted)" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className="ps-9"
        />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((e) => (
            <Badge key={e.id} variant="secondary">
              <span>{e.name}</span>
              <button
                type="button"
                aria-label="remove"
                onClick={() => toggle(e.id)}
                className="ms-1"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto rounded border border-(--border)">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-(--text-muted)">—</p>
        ) : (
          filtered.map((e) => {
            const isSelected = selectedIds.includes(e.id);
            return (
              <button
                key={e.id}
                type="button"
                className={`block w-full px-3 py-2 text-start text-sm hover:bg-(--surface-muted) ${
                  isSelected ? 'bg-(--surface-muted) font-medium' : ''
                }`}
                onClick={() => toggle(e.id)}
              >
                <span>{e.name}</span>
                <span className="ms-2 text-(--text-muted)">{e.specialty}</span>
              </button>
            );
          })
        )}
      </div>
      {form.formState.errors.supervisorIds && (
        <p className="text-xs text-(--text-error)">
          {form.formState.errors.supervisorIds.message as string}
        </p>
      )}
    </div>
  );
}
