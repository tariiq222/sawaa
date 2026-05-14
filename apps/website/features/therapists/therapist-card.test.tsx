import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TherapistCard } from './therapist-card';
import type { PublicEmployee } from '@deqah/api-client';

const full: PublicEmployee = {
  id: 'e1',
  slug: 'sara-ali',
  nameAr: 'سارة علي',
  nameEn: 'Sara Ali',
  title: 'Clinical Psychologist',
  specialty: 'Anxiety & Depression',
  specialtyAr: 'القلق والاكتئاب',
  publicBioAr: 'سيرة بالعربية',
  publicBioEn: 'English bio',
  publicImageUrl: 'https://cdn.test/sara.jpg',
};

describe('TherapistCard', () => {
  it('renders Arabic fields when locale is ar', () => {
    render(<TherapistCard therapist={full} locale="ar" />);
    expect(screen.getByRole('heading', { name: 'سارة علي' })).toBeTruthy();
    expect(screen.getByText('القلق والاكتئاب')).toBeTruthy();
    expect(screen.getByText('سيرة بالعربية')).toBeTruthy();
    expect(screen.getByRole('link', { name: /عرض الملف/ })).toBeTruthy();
  });

  it('renders English fields when locale is en', () => {
    render(<TherapistCard therapist={full} locale="en" />);
    expect(screen.getByRole('heading', { name: 'Sara Ali' })).toBeTruthy();
    expect(screen.getByText('Anxiety & Depression')).toBeTruthy();
    expect(screen.getByText('English bio')).toBeTruthy();
    expect(screen.getByRole('link', { name: /View profile/ })).toBeTruthy();
  });

  it('falls back to em-dash when name is null for the active locale', () => {
    const noArabicName: PublicEmployee = { ...full, nameAr: null };
    render(<TherapistCard therapist={noArabicName} locale="ar" />);
    expect(screen.getByRole('heading', { name: '—' })).toBeTruthy();
  });

  it('uses slug for the profile link URL', () => {
    render(<TherapistCard therapist={full} locale="en" />);
    const link = screen.getByRole('link', { name: /View profile/ }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/therapists/sara-ali');
  });

  it('omits profile link and optional fields when they are missing', () => {
    const minimal: PublicEmployee = {
      id: 'e2',
      slug: null,
      nameAr: 'محمد',
      nameEn: 'Mohammed',
      title: null,
      specialty: null,
      specialtyAr: null,
      publicBioAr: null,
      publicBioEn: null,
      publicImageUrl: null,
    };
    render(<TherapistCard therapist={minimal} locale="ar" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('heading', { name: 'محمد' })).toBeTruthy();
  });

  it('renders the image with alt text equal to the active-locale name', () => {
    render(<TherapistCard therapist={full} locale="en" />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toBe('https://cdn.test/sara.jpg');
    expect(img.alt).toBe('Sara Ali');
  });
});
