import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicFetch } from '@/lib/public-fetch';
import { useBookingWizard } from './use-booking-wizard';

const navigation = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  useSearchParams: () => navigation.params,
}));
vi.mock('@/lib/public-fetch', () => ({ publicFetch: vi.fn() }));

const categories = [
  { id: 'clinic', nameAr: 'عيادة الأسرة', nameEn: 'Family clinic', bookingMode: 'DIRECT' },
  { id: 'sessions', nameAr: 'الجلسات', nameEn: 'Sessions', bookingMode: 'SERVICES' },
];
const direct = { id: 'internal', categoryId: 'clinic', nameAr: 'اسم داخلي', nameEn: 'Internal service', isHidden: true, price: 0, durationMins: 30 };
const visible = { ...direct, id: 'session', categoryId: 'sessions', nameEn: 'Counseling session', isHidden: false };
const unrelatedHidden = { ...direct, id: 'private', categoryId: 'sessions' };

function mountWizard(services: typeof direct[]) {
  const employees = ['one', 'two'].map((id) => ({
    id, nameAr: id, nameEn: id, isBookable: true,
    serviceIds: services.map((service) => service.id), branchIds: ['main'],
  }));
  vi.mocked(publicFetch).mockImplementation(async (path) => {
    if (path === '/public/services?includeDirectClinics=true') return { services, categories };
    if (path === '/public/employees?includeDirectClinics=true') return employees;
    if (path === '/public/branches') return [{ id: 'main', nameAr: 'الفرع', nameEn: 'Main', isMain: true }];
    throw new Error(`Unexpected request: ${path}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useBookingWizard(), {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.params = new URLSearchParams();
});
afterEach(cleanup);

describe('generic booking with direct clinics', () => {
  it.each([
    { name: 'DIRECT-only catalog', services: [direct], ids: ['internal'] },
    { name: 'mixed catalog', services: [direct, visible, unrelatedHidden], ids: ['internal', 'session'] },
  ])('offers the clinic by its public name in a $name', async ({ services, ids }) => {
    const { result } = mountWizard(services);
    await waitFor(() => expect(result.current.loadingData).toBe(false));
    expect(result.current.filteredServices.map((service) => service.id)).toEqual(ids);
    const clinic = result.current.filteredServices.find((service) => service.id === 'internal')!;
    expect(clinic.nameEn).toBe('Family clinic');
    expect(result.current.nothingBookable).toBe(false);
    await act(async () => { await result.current.handleServiceSelect(clinic); });
    expect(result.current.currentScreen).toBe('therapist');
    expect(result.current.service?.id).toBe('internal');
    act(() => result.current.handleStepBack());
    expect(result.current.currentScreen).toBe('service');
    expect(navigation.push).not.toHaveBeenCalled();
    act(() => result.current.handleBookAnother());
    expect(result.current.filteredServices.map((service) => service.id)).toEqual(ids);
  });

  it('preserves the clinic deep-link entry and exit', async () => {
    navigation.params = new URLSearchParams('serviceId=internal');
    const { result } = mountWizard([direct]);
    await waitFor(() => expect(result.current.currentScreen).toBe('therapist'));
    expect(result.current.service?.id).toBe('internal');
    expect(result.current.service?.nameEn).toBe('Family clinic');
    act(() => result.current.handleStepBack());
    expect(navigation.push).toHaveBeenCalledWith('/');
  });
});
