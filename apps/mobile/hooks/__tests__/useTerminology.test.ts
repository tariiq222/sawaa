/**
 * useTerminology — mobile mirror of dashboard hook.
 *
 * Covers:
 *  1. Returns key as fallback when token is absent
 *  2. Returns Arabic value when locale is 'ar'
 *  3. Returns English value when locale is 'en'
 *  4. Query is disabled when verticalSlug is undefined
 *  5. t() returns the explicit fallback before the pack loads
 */

jest.mock('@/services/client/terminology', () => ({
  terminologyService: {
    getPack: jest.fn(),
  },
}));

jest.mock('@/hooks/useDir', () => ({
  useDir: jest.fn(),
}));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { terminologyService } from '@/services/client/terminology';
import { useDir } from '@/hooks/useDir';
import { useTerminology } from '../useTerminology';
import type {
  TerminologyKey,
  TerminologyPack,
} from '@deqah/shared/terminology';

const mockedGetPack = terminologyService.getPack as jest.Mock;
const mockedUseDir = useDir as jest.Mock;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, Wrapper };
}

const samplePack = {
  'employee.singular': { ar: 'مستشار', en: 'Consultant' },
  'employee.plural': { ar: 'المستشارون', en: 'Consultants' },
  'client.plural': { ar: 'العملاء', en: 'Clients' },
} as unknown as TerminologyPack;

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseDir.mockReturnValue({ locale: 'ar' });
});

describe('useTerminology', () => {
  it('returns the fallback when the token is absent from the pack', async () => {
    mockedGetPack.mockResolvedValueOnce(samplePack);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useTerminology('family-consulting'), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Cast — exercising fallback path for an unknown key.
    expect(result.current.t('unknown' as TerminologyKey, 'fb')).toBe('fb');
  });

  it('returns Arabic value when locale is ar', async () => {
    mockedUseDir.mockReturnValue({ locale: 'ar' });
    mockedGetPack.mockResolvedValueOnce(samplePack);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useTerminology('family-consulting'), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.t('employee.plural')).toBe('المستشارون');
  });

  it('returns English value when locale is en', async () => {
    mockedUseDir.mockReturnValue({ locale: 'en' });
    mockedGetPack.mockResolvedValueOnce(samplePack);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useTerminology('family-consulting'), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.t('employee.plural')).toBe('Consultants');
  });

  it('does not fire a query when verticalSlug is undefined', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useTerminology(undefined), {
      wrapper: Wrapper,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.pack).toBeUndefined();
    expect(mockedGetPack).not.toHaveBeenCalled();
  });

  it('returns the explicit fallback before the pack is available', () => {
    mockedGetPack.mockReturnValueOnce(new Promise(() => undefined));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useTerminology('family-consulting'), {
      wrapper: Wrapper,
    });
    expect(result.current.pack).toBeUndefined();
    expect(result.current.t('employee.plural', 'المعالجون')).toBe('المعالجون');
  });
});
