import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/features/locale/locale-provider';
import type { ChatOperation } from './chat.types';
import { ChatActionCard } from './chat-action-card';

function operation(overrides: Partial<ChatOperation> = {}): ChatOperation {
  return {
    id: 'operation-1',
    type: 'CREATE_BOOKING',
    status: 'AWAITING_CONFIRMATION',
    version: 3,
    requiredConfirmations: 2,
    confirmationCount: 1,
    expiresAt: '2026-08-14T12:00:00.000Z',
    bookingId: null,
    errorCode: null,
    summary: {
      serviceName: 'جلسة إرشاد أسري',
      employeeName: 'أ. سارة',
      scheduledAt: '2026-08-15T09:30:00.000Z',
      price: 300,
      currency: 'SAR',
    },
    ...overrides,
  };
}

function renderCard(
  value: ChatOperation,
  callbacks: Partial<React.ComponentProps<typeof ChatActionCard>> = {},
) {
  const props = {
    operation: value,
    onLoginRequired: vi.fn(),
    onAcknowledge: vi.fn(async () => operation({ status: 'AWAITING_CONFIRMATION', version: 4 })),
    onConfirm: vi.fn(async () => operation({ status: 'SUCCEEDED', version: 4 })),
    onDecline: vi.fn(async () => operation({ status: 'DECLINED', version: 4 })),
    ...callbacks,
  };
  render(
    <LocaleProvider locale="ar">
      <ChatActionCard {...props} />
    </LocaleProvider>,
  );
  return props;
}

describe('ChatActionCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes an authentication-required operation through the safe login callback', () => {
    const props = renderCard(operation({ status: 'AWAITING_AUTH' }));

    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول والمتابعة' }));

    expect(props.onLoginRequired).toHaveBeenCalledWith('operation-1');
    expect(screen.queryByRole('button', { name: 'تأكيد الطلب' })).toBeNull();
  });

  it('requires acknowledgement before preparing an additional booking', async () => {
    const props = renderCard(operation({
      status: 'AWAITING_EXISTING_BOOKING_ACK',
      confirmationCount: 0,
      summary: {
        existingBooking: { serviceName: 'جلسة قائمة', scheduledAt: '2026-08-16T09:00:00.000Z' },
        proposedBooking: { serviceName: 'جلسة جديدة', scheduledAt: '2026-08-17T09:00:00.000Z' },
      },
    }));

    fireEvent.click(screen.getByRole('button', { name: 'أفهم، متابعة الطلب' }));

    await waitFor(() => expect(props.onAcknowledge).toHaveBeenCalledWith('operation-1', 3));
  });

  it('shows the final confirmation and supports declining before execution', async () => {
    const props = renderCard(operation());

    expect(screen.getByText('التأكيد النهائي')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الطلب' }));
    await waitFor(() => expect(props.onConfirm).toHaveBeenCalledWith('operation-1', 3));

    const declined = renderCard(operation({ id: 'operation-2' }));
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء الطلب' }));
    await waitFor(() => expect(declined.onDecline).toHaveBeenCalledWith('operation-2', 3));
  });

  it.each([
    ['EXPIRED', 'انتهت صلاحية هذا الطلب'],
    ['SUCCEEDED', 'تم تنفيذ الطلب'],
    ['FAILED', 'تعذر تنفيذ الطلب'],
  ] as const)('renders %s as a terminal read-only state', (status, label) => {
    renderCard(operation({ status }));

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'تأكيد الطلب' })).toBeNull();
  });

  it('guards a pending confirmation from double submission', async () => {
    let resolve!: (value: ChatOperation) => void;
    const pending = new Promise<ChatOperation>((done) => { resolve = done; });
    const onConfirm = vi.fn(() => pending);
    renderCard(operation(), { onConfirm });

    const button = screen.getByRole('button', { name: 'تأكيد الطلب' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    resolve(operation({ status: 'SUCCEEDED', version: 4 }));
    await waitFor(() => expect(screen.getByText('تم تنفيذ الطلب')).toBeTruthy());
  });
});
