import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BookingConfirmLayout, { metadata } from './layout';

describe('BookingConfirmLayout', () => {
  it('defines noindex and nofollow robots metadata', () => {
    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it('renders children transparently', () => {
    render(
      <BookingConfirmLayout>
        <div data-testid="child-content">Confirm Page Content</div>
      </BookingConfirmLayout>,
    );
    expect(screen.getByTestId('child-content')).toBeTruthy();
    expect(screen.getByText('Confirm Page Content')).toBeTruthy();
  });
});
