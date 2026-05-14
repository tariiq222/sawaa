'use client';

import type { EmployeeWithUser } from '@deqah/shared';

interface TherapistPickerProps {
  therapists: EmployeeWithUser[];
  selected: EmployeeWithUser | null;
  onSelect: (employee: EmployeeWithUser) => void;
}

export function TherapistPicker({ therapists, selected, onSelect }: TherapistPickerProps) {
  return (
    <div className="grid gap-4">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Select Therapist</h2>
      {therapists.map((emp) => (
        <button
          key={emp.id}
          onClick={() => onSelect(emp)}
          style={{
            padding: '1rem',
            border: selected?.id === emp.id
              ? '2px solid var(--primary)'
              : '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
            borderRadius: 'var(--radius)',
            background: selected?.id === emp.id
              ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
              : 'transparent',
            textAlign: 'start',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 500 }}>
            {emp.user.firstName} {emp.user.lastName}
          </div>
          {emp.specialty && (
            <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>{emp.specialtyAr ?? emp.specialty}</div>
          )}
          {emp.rating > 0 && (
            <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {'★'.repeat(Math.round(emp.rating))} {emp.rating.toFixed(1)} ({emp.reviewCount})
            </div>
          )}
        </button>
      ))}
    </div>
  );
}