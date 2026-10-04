import React from 'react';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: true, language: 'ar' }) }));
import { fireEvent, render } from '@testing-library/react-native';
import { PractitionerBookingAction } from '../PractitionerBookingAction';
import { getBookableServices, practitionerBookingRoute } from '../practitionerBooking';
import type { PublicService } from '@/services/client/catalog';

const service = (id: string, nameAr: string, nameEn = nameAr): PublicService => ({ id, nameAr, nameEn, categoryId: null, price: 100, currency: 'SAR', imageUrl: null });
const catalog = [service('canonical-service-id', 'جلسة استشارية', 'Counseling session'), service('other-service', 'جلسة أسرية', 'Family session')];
const t = (key: string, options?: Record<string, string>) => ({ 'therapists.noBookableServices': 'لا توجد خدمات متاحة للموعد حالياً.', 'therapists.bookingServiceTitle': 'اختاري خدمة للموعد', 'therapists.bookingService': options?.service ?? key, 'common.cancel': 'إلغاء' }[key] ?? key);

describe('practitioner booking selection', () => {
  it('cross-checks service IDs against active catalog IDs, not slugs', () => {
    const employee = { id: 'employee-canonical-id', serviceIds: ['canonical-service-id'], isBookable: true };
    expect(getBookableServices(employee, catalog).map(({ id }) => id)).toEqual(['canonical-service-id']);
    expect(practitionerBookingRoute(employee.id, getBookableServices(employee, catalog)[0].id)).toEqual({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 'canonical-service-id', employeeId: 'employee-canonical-id' },
    });
  });

  it('lets the user choose between multiple valid services and navigates with chosen canonical ID', () => {
    const onNavigate = jest.fn();
    const { getByText } = render(<PractitionerBookingAction employee={{ id: 'employee-1', serviceIds: ['canonical-service-id', 'other-service', 'stale-id'], isBookable: true }} catalogServices={catalog} t={t} onNavigate={onNavigate} />);
    fireEvent.press(getByText('اختاري خدمة للموعد'));
    fireEvent.press(getByText('جلسة أسرية'));
    expect(onNavigate).toHaveBeenCalledWith({ pathname: '/(client)/booking/[serviceId]', params: { serviceId: 'other-service', employeeId: 'employee-1' } });
  });

  it('shows localized English service labels and selected canonical service ID', () => {
    const onNavigate = jest.fn();
    const englishT = (key: string, options?: Record<string, string>) => ({ 'therapists.bookingServiceTitle': 'Choose a service', 'therapists.bookingService': options?.service ?? key, 'therapists.noBookableServices': 'No services are currently available for booking.' }[key] ?? key);
    const { getByText } = render(<PractitionerBookingAction employee={{ id: 'employee-1', serviceIds: ['canonical-service-id', 'other-service'], isBookable: true }} catalogServices={catalog} t={englishT} onNavigate={onNavigate} />);
    fireEvent.press(getByText('Choose a service'));
    fireEvent.press(getByText('جلسة أسرية'));
    expect(onNavigate).toHaveBeenCalledWith({ pathname: '/(client)/booking/[serviceId]', params: { serviceId: 'other-service', employeeId: 'employee-1' } });
  });

  it('can cancel the service picker without navigating', () => {
    const onNavigate = jest.fn();
    const { getByText, queryByText } = render(<PractitionerBookingAction employee={{ id: 'employee-1', serviceIds: ['canonical-service-id', 'other-service'], isBookable: true }} catalogServices={catalog} t={t} onNavigate={onNavigate} />);
    fireEvent.press(getByText('اختاري خدمة للموعد'));
    fireEvent.press(getByText('إلغاء'));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(queryByText('جلسة أسرية')).toBeNull();
  });

  it('shows localized empty state and does not navigate when none are bookable', () => {
    const onNavigate = jest.fn();
    const { getByText, queryByRole } = render(<PractitionerBookingAction employee={{ id: 'employee-1', serviceIds: ['stale-id'], isBookable: true }} catalogServices={catalog} t={t} onNavigate={onNavigate} />);
    expect(getByText('لا توجد خدمات متاحة للموعد حالياً.')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
