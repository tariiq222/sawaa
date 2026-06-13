import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BranchStep } from './branch-step';
import type { PublicBranch } from './booking.api';

const branches: PublicBranch[] = [
  { id: 'b1', nameAr: 'الفرع الرئيسي', nameEn: 'Main Branch', city: 'Riyadh', addressAr: 'الرياض', isMain: true },
  { id: 'b2', nameAr: 'فرع الشمال', nameEn: 'North Branch', city: 'Riyadh', addressAr: 'شمال الرياض', isMain: false },
];

describe('BranchStep', () => {
  it('renders all branch options', () => {
    render(<BranchStep branches={branches} onSelect={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('الفرع الرئيسي')).toBeTruthy();
    expect(screen.getByText('فرع الشمال')).toBeTruthy();
  });

  it('calls onSelect with the clicked branch', () => {
    const onSelect = vi.fn();
    render(<BranchStep branches={branches} onSelect={onSelect} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('الفرع الرئيسي'));
    expect(onSelect).toHaveBeenCalledWith(branches[0]);
  });

  it('shows English name when provided', () => {
    render(<BranchStep branches={branches} onSelect={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('Main Branch')).toBeTruthy();
  });
});
