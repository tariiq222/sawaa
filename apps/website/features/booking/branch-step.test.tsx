import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BranchStep } from './branch-step';
import type { PublicBranch } from './booking.api';
import { LocaleProvider } from '@/features/locale/locale-provider';

const branches: PublicBranch[] = [
  { id: 'b1', nameAr: 'الفرع الرئيسي', nameEn: 'Main Branch', city: 'Riyadh', addressAr: 'الرياض', isMain: true },
  { id: 'b2', nameAr: 'فرع الشمال', nameEn: 'North Branch', city: 'Riyadh', addressAr: 'شمال الرياض', isMain: false },
];

function withLocale(children: ReactNode) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

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

describe('BranchStep keyboard behavior (radio group)', () => {
  it('renders the branch list as a radiogroup with a localized name', () => {
    render(withLocale(<BranchStep branches={branches} onSelect={vi.fn()} />));
    expect(screen.getByRole('radiogroup', { name: /Select Branch/i })).toBeTruthy();
  });

  it('marks every branch option as an unchecked radio with roving tabindex on the first', () => {
    render(withLocale(<BranchStep branches={branches} onSelect={vi.fn()} />));
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0].getAttribute('aria-checked')).toBe('false');
    expect(radios[0].tabIndex).toBe(0);
    expect(radios[1].tabIndex).toBe(-1);
  });

  it('ArrowDown moves to and selects the next branch, wrapping at the end', () => {
    const onSelect = vi.fn();
    render(withLocale(<BranchStep branches={branches} onSelect={onSelect} />));
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith(branches[1]);
    expect(radios[1]).toHaveFocus();
    fireEvent.keyDown(radios[1], { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith(branches[0]);
    expect(radios[0]).toHaveFocus();
  });

  it('Home/End jump to the first/last branch', () => {
    const onSelect = vi.fn();
    render(withLocale(<BranchStep branches={branches} onSelect={onSelect} />));
    const radios = screen.getAllByRole('radio');
    radios[1].focus();
    fireEvent.keyDown(radios[1], { key: 'Home' });
    expect(onSelect).toHaveBeenCalledWith(branches[0]);
    fireEvent.keyDown(radios[0], { key: 'End' });
    expect(onSelect).toHaveBeenCalledWith(branches[1]);
  });
});
