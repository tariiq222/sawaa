'use client';

import type { PublicBranch } from './booking.api';
import { useT } from '@/features/locale/locale-provider';

interface BranchStepProps {
  branches: PublicBranch[];
  onSelect: (branch: PublicBranch) => void;
  onBack: () => void;
}

export function BranchStep({ branches, onSelect, onBack }: BranchStepProps) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="self-start cursor-pointer bg-transparent border border-[color-mix(in_srgb,var(--primary)_30%,transparent)] rounded-[var(--radius)] px-4 py-2"
      >
        {t('booking.back')}
      </button>
      <h2 className="text-lg font-semibold">{t('booking.selectBranch')}</h2>
      <div className="flex flex-col gap-3">
        {branches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => onSelect(branch)}
            className="text-start p-4 cursor-pointer flex flex-col gap-1 border border-[color-mix(in_srgb,var(--primary)_30%,transparent)] rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]"
          >
            <span className="font-semibold">{branch.nameAr}</span>
            {branch.nameEn && (
              <span className="text-sm opacity-70">{branch.nameEn}</span>
            )}
            {branch.addressAr && (
              <span className="text-xs opacity-60">{branch.addressAr}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
