import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupportGroupCard } from './support-group-card';
import type { SupportGroup } from './support-groups.api';

const base: SupportGroup = {
  id: 'g1',
  title: 'Anxiety Support',
  descriptionAr: 'وصف قصير',
  descriptionEn: null,
  scheduledAt: '2026-05-01T18:00:00Z',
  durationMins: 60,
  maxCapacity: 10,
  enrolledCount: 3,
  price: 50,
  currency: 'SAR',
  status: 'SCHEDULED',
  waitlistEnabled: true,
  waitlistCount: 0,
  employeeId: 'e1',
  serviceId: 's1',
  spotsLeft: 7,
  isFull: false,
  isWaitlistOnly: false,
};

describe('SupportGroupCard', () => {
  it('renders title, Arabic description, duration and spots-left pill', () => {
    render(<SupportGroupCard group={base} />);
    expect(screen.getByRole('heading', { name: 'Anxiety Support' })).toBeTruthy();
    expect(screen.getByText('وصف قصير')).toBeTruthy();
    expect(screen.getByText(/60 minutes/)).toBeTruthy();
    expect(screen.getByText(/7 spots left/)).toBeTruthy();
  });

  it('shows "Free" when price is zero', () => {
    render(<SupportGroupCard group={{ ...base, price: 0 }} />);
    expect(screen.getByText('Free')).toBeTruthy();
  });

  it('shows "Full" pill when the session is full and waitlist is not allowed', () => {
    render(<SupportGroupCard group={{ ...base, isFull: true, isWaitlistOnly: false }} />);
    expect(screen.getByText('Full')).toBeTruthy();
    expect(screen.queryByText(/spots left/)).toBeNull();
  });

  it('shows "Waitlist Only" pill when waitlistOnly is true', () => {
    render(<SupportGroupCard group={{ ...base, isFull: true, isWaitlistOnly: true }} />);
    expect(screen.getByText(/Waitlist Only/i)).toBeTruthy();
  });

  it('calls onSelect when the card is clicked and when Enter is pressed', () => {
    const onSelect = vi.fn();
    render(<SupportGroupCard group={base} onSelect={onSelect} />);
    const card = screen.getByRole('button');
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledWith(base);
  });

  it('does not throw when onSelect is omitted and the card is clicked', () => {
    render(<SupportGroupCard group={base} />);
    const card = screen.getByRole('button');
    expect(() => fireEvent.click(card)).not.toThrow();
  });
});
