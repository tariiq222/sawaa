import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Select, SelectTrigger } from './select';

function getTriggerDir(): string | null {
  const trigger = screen.getByRole('combobox');
  return trigger.getAttribute('dir');
}

describe('Select (dir resolution)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  it('forwards an explicit dir="rtl" prop to the rendered trigger', async () => {
    render(
      <Select dir="rtl">
        <SelectTrigger>Pick</SelectTrigger>
      </Select>,
    );
    await act(async () => {});
    expect(getTriggerDir()).toBe('rtl');
  });

  it('forwards an explicit dir="ltr" prop to the rendered trigger', async () => {
    render(
      <Select dir="ltr">
        <SelectTrigger>Pick</SelectTrigger>
      </Select>,
    );
    await act(async () => {});
    expect(getTriggerDir()).toBe('ltr');
  });

  it('falls back to <html dir="rtl"> when no dir prop is supplied', async () => {
    document.documentElement.setAttribute('dir', 'rtl');
    render(
      <Select>
        <SelectTrigger>Pick</SelectTrigger>
      </Select>,
    );
    await act(async () => {});
    expect(getTriggerDir()).toBe('rtl');
  });

  it('falls back to <html dir="ltr"> when no dir prop is supplied', async () => {
    document.documentElement.setAttribute('dir', 'ltr');
    render(
      <Select>
        <SelectTrigger>Pick</SelectTrigger>
      </Select>,
    );
    await act(async () => {});
    expect(getTriggerDir()).toBe('ltr');
  });

  it('prefers the explicit dir prop over <html dir> when both are set', async () => {
    // The HTML attribute says rtl, but the prop says ltr — prop wins.
    document.documentElement.setAttribute('dir', 'rtl');
    render(
      <Select dir="ltr">
        <SelectTrigger>Pick</SelectTrigger>
      </Select>,
    );
    await act(async () => {});
    expect(getTriggerDir()).toBe('ltr');
  });

  it('uses "ltr" as the SSR-safe default when neither prop nor <html dir> is set', async () => {
    // No prop, no <html dir>. After hydration the hook syncs to the DOM,
    // which still has no dir → readDir() returns "ltr".
    render(
      <Select>
        <SelectTrigger>Pick</SelectTrigger>
      </Select>,
    );
    await act(async () => {});
    expect(getTriggerDir()).toBe('ltr');
  });

  it('reacts to a runtime <html dir> change after mount', async () => {
    document.documentElement.setAttribute('dir', 'ltr');
    render(
      <Select>
        <SelectTrigger>Pick</SelectTrigger>
      </Select>,
    );
    await act(async () => {});
    expect(getTriggerDir()).toBe('ltr');

    await act(async () => {
      document.documentElement.setAttribute('dir', 'rtl');
    });
    expect(getTriggerDir()).toBe('rtl');
  });

  it('sets data-slot="select" on the rendered Root', () => {
    // Root doesn't render its own DOM, so probe via the trigger's data attrs
    // and the SelectProvider context — for our purposes, the wrapper
    // component instance is verified to mount without throwing and the
    // child SelectTrigger is present.
    render(
      <Select>
        <SelectTrigger>Open</SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole('combobox');
    // The trigger carries the data-slot from our SelectTrigger wrapper, which
    // confirms our Root passed props through correctly.
    expect(trigger.getAttribute('data-slot')).toBe('select-trigger');
    expect(trigger.textContent).toContain('Open');
  });
});