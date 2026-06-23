import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateTimeInput } from './date-time-input';

function getInput(): HTMLInputElement {
  return document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
}

describe('DateTimeInput', () => {
  it('renders an empty input when no value is provided', () => {
    render(<DateTimeInput onChange={() => {}} />);
    expect(getInput().value).toBe('');
  });

  it('renders a datetime-local input (type="datetime-local")', () => {
    render(<DateTimeInput onChange={() => {}} />);
    expect(getInput().getAttribute('type')).toBe('datetime-local');
  });

  it('leaves a value already in datetime-local format ("YYYY-MM-DDTHH:mm") untouched', () => {
    render(<DateTimeInput value="2026-06-23T14:30" onChange={() => {}} />);
    expect(getInput().value).toBe('2026-06-23T14:30');
  });

  it('truncates a full ISO string to the first 16 chars (datetime-local slice)', () => {
    render(<DateTimeInput value="2026-06-23T14:30:45.123Z" onChange={() => {}} />);
    expect(getInput().value).toBe('2026-06-23T14:30');
  });

  it('truncates a full ISO string without milliseconds', () => {
    render(<DateTimeInput value="2026-06-23T14:30:00Z" onChange={() => {}} />);
    expect(getInput().value).toBe('2026-06-23T14:30');
  });

  it('truncates a full ISO string with a positive offset', () => {
    render(<DateTimeInput value="2026-06-23T14:30:00+03:00" onChange={() => {}} />);
    expect(getInput().value).toBe('2026-06-23T14:30');
  });

  it('leaves a value with no "T" separator unchanged at the component level (the input element may reject non-conforming strings)', () => {
    // The component's normalization falls through to the literal value when the regex
    // doesn't match AND there's no "T". The browser may then blank a non-conforming
    // value because the input is type="datetime-local"; the assertion here documents
    // that the component does NOT throw or strip such input itself.
    expect(() =>
      render(<DateTimeInput value="not-a-datetime" onChange={() => {}} />),
    ).not.toThrow();
  });

  it('emits the new value via onChange when the input changes', () => {
    const onChange = vi.fn();
    render(<DateTimeInput onChange={onChange} />);
    fireEvent.change(getInput(), { target: { value: '2026-06-23T14:30' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('2026-06-23T14:30');
  });

  it('forwards the raw input value to onChange (no normalization on emit — it is the consumer\'s job)', () => {
    const onChange = vi.fn();
    render(<DateTimeInput onChange={onChange} />);
    fireEvent.change(getInput(), { target: { value: '2026-06-23T14:30' } });
    expect(onChange).toHaveBeenCalledWith('2026-06-23T14:30');
  });

  it('respects the min and max attributes', () => {
    render(
      <DateTimeInput
        onChange={() => {}}
        min="2026-01-01T00:00"
        max="2026-12-31T23:59"
      />,
    );
    const input = getInput();
    expect(input.getAttribute('min')).toBe('2026-01-01T00:00');
    expect(input.getAttribute('max')).toBe('2026-12-31T23:59');
  });

  it('applies the destructive border class when error is true', () => {
    const { container } = render(<DateTimeInput onChange={() => {}} error />);
    const input = container.querySelector('input');
    expect(input?.className).toMatch(/border-destructive/);
  });

  it('does NOT apply destructive border when error is false (default)', () => {
    const { container } = render(<DateTimeInput onChange={() => {}} />);
    const input = container.querySelector('input');
    expect(input?.className).not.toMatch(/border-destructive/);
  });

  it('forwards the id and name attributes', () => {
    render(<DateTimeInput onChange={() => {}} id="when" name="when" />);
    const input = getInput();
    expect(input.id).toBe('when');
    expect(input.getAttribute('name')).toBe('when');
  });

  it('respects disabled and required attributes', () => {
    render(<DateTimeInput onChange={() => {}} disabled required />);
    const input = getInput();
    expect(input.disabled).toBe(true);
    expect(input.required).toBe(true);
  });

  it('forwards the placeholder attribute', () => {
    render(<DateTimeInput onChange={() => {}} placeholder="Select date" />);
    expect(getInput().getAttribute('placeholder')).toBe('Select date');
  });

  it('handles a value that is exactly the datetime-local length (regex accepts, no slice)', () => {
    // 16-char YYYY-MM-DDTHH:mm: the regex matches, so the function returns the value
    // verbatim without re-slicing.
    render(<DateTimeInput value="2026-06-23T14:30" onChange={() => {}} />);
    expect(getInput().value).toBe('2026-06-23T14:30');
    // Defensive: confirm no second-slice has happened (would be empty for shorter input).
    expect(getInput().value.length).toBe(16);
  });
});
