import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { previewQuery } = vi.hoisted(() => ({ previewQuery: vi.fn() }));
vi.mock('@/hooks/use-programs', () => ({ useProgramCancellationPreview: previewQuery }));
vi.mock('@/components/locale-provider', () => ({ useLocale: () => ({ t: (k: string) => k }) }));
vi.mock('@sawaa/ui', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box, DialogFooter: Box, DialogBody: Box, Button: ({ variant: _, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?: string}) => <button {...p} />, Input: (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} />, Textarea: (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} /> };
});
import { CancelProgramDialog } from '@/components/features/programs/cancel-program-dialog';
const participant = { bookingId: 'b1', clientId: 'c1', clientName: 'Sara', bookingNumber: 1, status: 'CONFIRMED', currency: 'SAR', paidAmount: 10000, alreadyRefundedAmount: 0, pendingRefundAmount: 0, maxRefundAmount: 10000, refundAmount: null };
describe('CancelProgramDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); previewQuery.mockReturnValue({ data: { programId: 'g1', hasStarted: true, quoteToken: 'q1', participants: [participant] }, isFetching: false, isError: false, refetch: vi.fn() }); });
  it('requires explicit amounts after start and converts SAR to integer halalas including zero', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ cancelledEnrollments: 1, skippedEnrollments: 0 });
    render(<CancelProgramDialog open programId="g1" onOpenChange={() => {}} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText('programs.dialog.cancel.reasonLabel'), { target: { value: 'Closed' } });
    fireEvent.click(screen.getByRole('button', { name: 'programs.dialog.cancel.confirm' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12.34' } });
    fireEvent.click(screen.getByRole('button', { name: 'programs.dialog.cancel.confirm' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ reason: 'Closed', quoteToken: 'q1', refunds: [{ bookingId: 'b1', amount: 1234 }] }));
  });
  it('refreshes a 409 quote and requires another deliberate submit without auto-resubmission', async () => {
    const refetch = vi.fn().mockResolvedValue({ data: { programId: 'g1', hasStarted: true, quoteToken: 'q2', participants: [participant] } });
    previewQuery.mockReturnValue({ data: { programId: 'g1', hasStarted: false, quoteToken: 'q1', participants: [{ ...participant, refundAmount: 10000 }] }, isFetching: false, isError: false, refetch });
    const onConfirm = vi.fn().mockRejectedValue({ status: 409 });
    render(<CancelProgramDialog open programId="g1" onOpenChange={() => {}} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText('programs.dialog.cancel.reasonLabel'), { target: { value: 'Closed' } });
    fireEvent.click(screen.getByRole('button', { name: 'programs.dialog.cancel.confirm' }));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('programs.dialog.cancel.quoteChanged');
  });
  it('opens a fresh draft after closing and hides old amounts when the quote changes', () => {
    const onConfirm = vi.fn();
    const props = { programId: 'g1', onOpenChange: () => {}, onConfirm };
    const { rerender } = render(<CancelProgramDialog open {...props} />);
    fireEvent.change(screen.getByLabelText('programs.dialog.cancel.reasonLabel'), { target: { value: 'Old reason' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12.34' } });
    previewQuery.mockReturnValue({ data: { programId: 'g1', hasStarted: true, quoteToken: 'q2', participants: [participant] }, isFetching: false, isError: false, refetch: vi.fn() });
    rerender(<CancelProgramDialog open {...props} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(null);
    rerender(<CancelProgramDialog open={false} {...props} />);
    rerender(<CancelProgramDialog open {...props} />);
    expect(screen.getByLabelText('programs.dialog.cancel.reasonLabel')).toHaveValue('');
    expect(screen.getByRole('spinbutton')).toHaveValue(null);
  });

});
