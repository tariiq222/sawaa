import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SummaryChips } from './summary-rail';
import { employee, service, withLocale } from './summary-rail.test.helpers';

describe('SummaryChips', () => {
  it('renders nothing when no rows are filled', () => {
    const { container } = render(
      withLocale(
        <SummaryChips
          showBranch={false}
          branch={null}
          service={null}
          choice={null}
          employee={null}
          slot={null}
        />,
      ),
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a chip for each filled selection', () => {
    render(
      withLocale(
        <SummaryChips
          showBranch={false}
          branch={null}
          service={service}
          choice={null}
          employee={employee}
          slot={null}
        />,
      ),
    );
    expect(screen.getByText('Consultation')).toBeTruthy();
    expect(screen.getByText('Dr. Layla')).toBeTruthy();
  });

  it('tappable chips route to onEdit', () => {
    const onEdit = vi.fn();
    render(
      withLocale(
        <SummaryChips
          showBranch={false}
          branch={null}
          service={service}
          choice={null}
          employee={null}
          slot={null}
          activeScreen={null}
          onEdit={onEdit}
        />,
      ),
    );
    // The service chip is a button (activeScreen is null so all filled rows are tappable).
    const chip = screen.getByRole('button', { name: /Consultation/ });
    fireEvent.click(chip);
    expect(onEdit).toHaveBeenCalledWith('service');
  });

  it('renders the active screen chip as a non-interactive span', () => {
    render(
      withLocale(
        <SummaryChips
          showBranch={false}
          branch={null}
          service={service}
          choice={null}
          employee={null}
          slot={null}
          activeScreen="service"
          onEdit={vi.fn()}
        />,
      ),
    );
    // The chip should not be a button when it is the active screen.
    expect(screen.queryByRole('button', { name: /Consultation/ })).toBeNull();
    // The text content is still rendered.
    expect(screen.getByText('Consultation')).toBeTruthy();
  });
});
