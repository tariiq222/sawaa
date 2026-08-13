import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  searchParams: new URLSearchParams('redirect=%2F%3Fchat%3Dresume'),
  login: vi.fn(),
  getMe: vi.fn(),
  setClient: vi.fn(),
  claim: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('./auth.api', () => ({ clientLoginApi: mocks.login, getMeApi: mocks.getMe }));
vi.mock('./auth-store', () => ({ setClient: mocks.setClient }));
vi.mock('@/features/chat/chat.api', () => ({ claimGuestChatConversationApi: mocks.claim }));

import { LocaleProvider } from '@/features/locale/locale-provider';
import { savePendingChatResume } from '@/features/chat/chat-resume';
import { LoginForm } from './login-form';

describe('LoginForm chat resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    mocks.searchParams = new URLSearchParams('redirect=%2F%3Fchat%3Dresume');
    mocks.login.mockResolvedValue({});
    mocks.getMe.mockResolvedValue({ id: 'client-1', name: 'سارة' });
    mocks.claim.mockResolvedValue({ id: 'conversation-1', resumedOperations: [] });
  });

  it('claims the pending conversation after login and returns internally without storing a token', async () => {
    savePendingChatResume('conversation-1');
    render(
      <LocaleProvider locale="ar">
        <LoginForm />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByLabelText('رقم الجوال'), { target: { value: '0501234567' } });
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));

    await waitFor(() => expect(mocks.claim).toHaveBeenCalledWith('conversation-1'));
    expect(mocks.routerPush).toHaveBeenCalledWith('/?chat=resume');
    const stored = Array.from({ length: window.sessionStorage.length }, (_, index) => {
      const key = window.sessionStorage.key(index) ?? '';
      return `${key}:${window.sessionStorage.getItem(key) ?? ''}`;
    }).join(' ');
    expect(stored).not.toContain('conversation-1');
    expect(stored).not.toMatch(/token|bearer|secret/i);
  });

  it('keeps an unsafe external redirect out of the post-login navigation', async () => {
    mocks.searchParams = new URLSearchParams('redirect=https%3A%2F%2Fevil.example%2Fsteal');
    render(
      <LocaleProvider locale="en">
        <LoginForm />
      </LocaleProvider>,
    );
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '0501234567' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(mocks.routerPush).toHaveBeenCalledWith('/account'));
  });
});
