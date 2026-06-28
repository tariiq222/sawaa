import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupportGroupCard } from './support-group-card';
import type { SupportGroup } from './support-groups.api';

const base: SupportGroup = {
  id: 'prog-1',
  ref: 1,
  title: 'Anxiety Support',
  nameAr: 'دعم القلق',
  nameEn: 'Anxiety Support',
  descriptionAr: 'وصف قصير',
  descriptionEn: null,
  publicDescriptionAr: null,
  publicDescriptionEn: null,
  departmentId: 'd-1',
  branchId: 'b-1',
  startDate: '2026-05-01T18:00:00Z',
  daysCount: 4,
  hoursPerDay: 2,
  minParticipants: 4,
  maxParticipants: 10,
  enrolledCount: 3,
  price: '5000',
  currency: 'SAR',
  depositEnabled: false,
  depositAmount: null,
  status: 'OPEN',
  isPublic: true,
  isFull: false,
  spotsLeft: 7,
  scheduledAt: '2026-05-01T18:00:00Z',
  durationMins: 480,
  maxCapacity: 10,
  serviceId: '',
  employeeId: '',
};

describe('SupportGroupCard (programs)', () => {
  it('renders title, Arabic description, schedule and spots-left pill', () => {
    render(<SupportGroupCard group={base} />);
    expect(screen.getByRole('heading', { name: 'Anxiety Support' })).toBeTruthy();
    expect(screen.getByText('وصف قصير')).toBeTruthy();
    expect(screen.getByText(/4 days · 2h \/ day/)).toBeTruthy();
    expect(screen.getByText(/7 spots left/)).toBeTruthy();
  });

  it('shows "مجاني" when price is zero', () => {
    render(<SupportGroupCard group={{ ...base, price: '0' }} />);
    expect(screen.getByText('مجاني')).toBeTruthy();
  });

  it('shows "Full" pill when the program is full', () => {
    render(<SupportGroupCard group={{ ...base, isFull: true }} />);
    expect(screen.getByText('Full')).toBeTruthy();
    expect(screen.queryByText(/spots left/)).toBeNull();
  });

  it('calls onSelect when the card is clicked and when Enter is pressed', () => {
    const onSelect = vi.fn();
    render(<SupportGroupCard group={base} onSelect={onSelect} />);
    const card = screen.getByRole('button');
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
