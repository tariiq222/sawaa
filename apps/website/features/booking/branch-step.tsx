'use client';

import type { PublicBranch } from './booking.api';

interface BranchStepProps {
  branches: PublicBranch[];
  onSelect: (branch: PublicBranch) => void;
  onBack: () => void;
}

export function BranchStep({ branches, onSelect, onBack }: BranchStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button
        onClick={onBack}
        style={{
          background: 'transparent',
          border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
          borderRadius: 'var(--radius)',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          alignSelf: 'start',
        }}
      >
        Back
      </button>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>اختر الفرع</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {branches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => onSelect(branch)}
            style={{
              textAlign: 'start',
              padding: '1rem',
              border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
              borderRadius: 'var(--radius)',
              background: 'color-mix(in srgb, var(--primary) 5%, transparent)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            <span style={{ fontWeight: 600 }}>{branch.nameAr}</span>
            {branch.nameEn && (
              <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>{branch.nameEn}</span>
            )}
            {branch.addressAr && (
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{branch.addressAr}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
