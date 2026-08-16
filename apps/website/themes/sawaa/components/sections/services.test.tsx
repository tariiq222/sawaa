import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/features/locale/locale-provider';
import type { BookableService } from '@/features/public-catalog/public';
import type { SectionIntro } from '@/features/site-content/public';
import { Services } from './services';

vi.stubGlobal(
  'IntersectionObserver',
  class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const intro: SectionIntro = {
  tag: 'Our Services',
  titlePrefix: 'Services',
  titleHighlight: 'available to book',
  titleSuffix: '',
  subtitle: 'Choose the service that fits your needs.',
};

function service(overrides: Partial<BookableService['service']> = {}): BookableService {
  return {
    service: {
      id: 'service-mental-status',
      categoryId: 'category-assessment',
      nameAr: 'فحص الحالة العقلية',
      nameEn: 'Mental Status Examination',
      descriptionAr: 'تقييم سريري للحالة العقلية الراهنة.',
      descriptionEn: 'A clinical assessment of current mental status.',
      durationMins: 45,
      price: '5000',
      currency: 'SAR',
      imageUrl: null,
      iconName: null,
      iconBgColor: null,
      showPrice: true,
      showDuration: true,
      durationOptions: [],
      bookingConfigs: [
        { id: 'config-1', deliveryType: 'IN_PERSON', price: '5000', durationMins: 45 },
      ],
      ...overrides,
    },
    categoryId: 'category-assessment',
    categoryNameAr: 'القياس والتقويم',
    categoryNameEn: 'Assessment & Evaluation',
    categoryImageUrl: null,
    categoryIconName: 'Analytics01Icon',
    categoryIconBgColor: '#2D7AB0',
    practitionerCount: 4,
    deliveryTypes: ['IN_PERSON'],
  };
}

function renderServices(items: BookableService[]) {
  return render(
    <LocaleProvider locale="en">
      <Services services={items} intro={intro} vatRate={0} />
    </LocaleProvider>,
  );
}

describe('Services home section', () => {
  it('shows useful service facts and links to booking with the service preselected', () => {
    renderServices([service()]);

    expect(screen.getByText('Mental Status Examination')).toBeInTheDocument();
    expect(screen.getByText('Assessment & Evaluation')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('In-person')).toBeInTheDocument();
    expect(screen.getByText('4 specialists')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Start booking Mental Status Examination' }),
    ).toHaveAttribute('href', '/booking?serviceId=service-mental-status');
    expect(screen.getByRole('link', { name: 'View all services' })).toHaveAttribute(
      'href',
      '/services',
    );
    expect(screen.getByRole('region', { name: 'Bookable services' })).toHaveAttribute(
      'dir',
      'ltr',
    );
    expect(screen.getByRole('button', { name: 'Next service' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous service' })).toBeInTheDocument();
  });

  it('respects the public flags that hide price and duration', () => {
    renderServices([service({ showPrice: false, showDuration: false })]);

    expect(screen.queryByText('45 min')).not.toBeInTheDocument();
    expect(screen.queryByText('50')).not.toBeInTheDocument();
    expect(screen.getByText('In-person')).toBeInTheDocument();
  });

  it('renders a services-specific empty state without a dead booking link', () => {
    renderServices([]);

    expect(screen.getByText('No services available right now')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Start booking/ })).not.toBeInTheDocument();
  });
});
