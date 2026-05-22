import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ClientProfile } from '@sawaa/shared';

const pushMock = vi.fn();
const useCurrentClientMock = vi.fn();

vi.mock('./use-current-client', () => ({
  useCurrentClient: () => useCurrentClientMock(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { AuthGuard } from './auth-guard';

const fakeClient: ClientProfile = {
  id: 'c1',
  name: 'Sara',
  email: 'sara@test.com',
  phone: null,
  gender: null,
  avatarUrl: null,
  emailVerified: true,
  phoneVerified: false,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('AuthGuard', () => {
  beforeEach(() => {
    pushMock.mockReset();
    useCurrentClientMock.mockReset();
  });

  it('renders default Loading placeholder when isLoading is true and no fallback', () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: true, error: null, refetch: vi.fn() });
    render(<AuthGuard><div>children-content</div></AuthGuard>);
    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(screen.queryByText('children-content')).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('renders the provided fallback when isLoading is true', () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: true, error: null, refetch: vi.fn() });
    render(
      <AuthGuard fallback={<div>custom-fallback</div>}>
        <div>children-content</div>
      </AuthGuard>,
    );
    expect(screen.getByText('custom-fallback')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('redirects to /login when client is null and not loading', () => {
    useCurrentClientMock.mockReturnValue({ client: null, isLoading: false, error: null, refetch: vi.fn() });
    render(<AuthGuard><div>children-content</div></AuthGuard>);
    expect(pushMock).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('children-content')).toBeNull();
  });

  it('renders children when client is present', () => {
    useCurrentClientMock.mockReturnValue({ client: fakeClient, isLoading: false, error: null, refetch: vi.fn() });
    render(<AuthGuard><div>children-content</div></AuthGuard>);
    expect(screen.getByText('children-content')).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
