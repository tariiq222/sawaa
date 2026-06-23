import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SurfaceRow } from './surface-row';

describe('SurfaceRow', () => {
  it('renders a div with data-slot="surface-row" by default', () => {
    render(<SurfaceRow data-testid="row">content</SurfaceRow>);
    const row = screen.getByTestId('row');
    expect(row.tagName).toBe('DIV');
    expect(row.getAttribute('data-slot')).toBe('surface-row');
    expect(row.textContent).toBe('content');
  });

  it('applies default variant classes (bg-card) when variant is omitted', () => {
    render(<SurfaceRow data-testid="row">x</SurfaceRow>);
    const cls = screen.getByTestId('row').className;
    expect(cls).toContain('bg-card');
    // default does NOT use the muted or dashed backgrounds
    expect(cls).not.toContain('bg-surface-muted');
    expect(cls).not.toContain('border-dashed');
  });

  it('applies muted variant classes (bg-surface-muted, not bg-card)', () => {
    render(
      <SurfaceRow data-testid="row" variant="muted">
        x
      </SurfaceRow>,
    );
    const cls = screen.getByTestId('row').className;
    expect(cls).toContain('bg-surface-muted');
    expect(cls).not.toContain('bg-card');
  });

  it('applies dashed variant classes (border-dashed, no fill background)', () => {
    render(
      <SurfaceRow data-testid="row" variant="dashed">
        x
      </SurfaceRow>,
    );
    const cls = screen.getByTestId('row').className;
    expect(cls).toContain('border-dashed');
    expect(cls).toContain('bg-transparent');
    expect(cls).not.toContain('bg-card');
    expect(cls).not.toContain('bg-surface-muted');
  });

  it('reflects the variant prop on data-variant', () => {
    const { rerender } = render(
      <SurfaceRow data-testid="row" variant="muted">
        x
      </SurfaceRow>,
    );
    expect(screen.getByTestId('row').getAttribute('data-variant')).toBe('muted');
    rerender(
      <SurfaceRow data-testid="row" variant="dashed">
        x
      </SurfaceRow>,
    );
    expect(screen.getByTestId('row').getAttribute('data-variant')).toBe('dashed');
  });

  it('applies sm size classes (px-3 py-2)', () => {
    render(
      <SurfaceRow data-testid="row" size="sm">
        x
      </SurfaceRow>,
    );
    const cls = screen.getByTestId('row').className;
    expect(cls).toContain('px-3');
    expect(cls).toContain('py-2');
    // sm must NOT include md padding
    expect(cls).not.toContain('px-4');
    expect(cls).not.toContain('py-3');
  });

  it('applies md size classes (px-4 py-3) by default', () => {
    render(<SurfaceRow data-testid="row">x</SurfaceRow>);
    const cls = screen.getByTestId('row').className;
    expect(cls).toContain('px-4');
    expect(cls).toContain('py-3');
  });

  it('reflects the size prop on data-size', () => {
    render(
      <SurfaceRow data-testid="row" size="sm">
        x
      </SurfaceRow>,
    );
    expect(screen.getByTestId('row').getAttribute('data-size')).toBe('sm');
  });

  it('merges a custom className onto the element', () => {
    render(
      <SurfaceRow data-testid="row" className="my-extra-class">
        x
      </SurfaceRow>,
    );
    const cls = screen.getByTestId('row').className;
    expect(cls).toContain('my-extra-class');
    // still keeps the default bg-card base class
    expect(cls).toContain('bg-card');
  });

  it('forwards extra HTML attrs (e.g. aria-label, role)', () => {
    render(
      <SurfaceRow data-testid="row" role="region" aria-label="summary">
        x
      </SurfaceRow>,
    );
    const row = screen.getByTestId('row');
    expect(row.getAttribute('role')).toBe('region');
    expect(row.getAttribute('aria-label')).toBe('summary');
  });

  it('combines variant × size classes without losing either set', () => {
    render(
      <SurfaceRow data-testid="row" variant="muted" size="sm">
        x
      </SurfaceRow>,
    );
    const cls = screen.getByTestId('row').className;
    expect(cls).toContain('bg-surface-muted'); // muted
    expect(cls).toContain('px-3'); // sm
    expect(cls).toContain('py-2'); // sm
  });
});