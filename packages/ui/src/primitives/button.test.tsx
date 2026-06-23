import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button (render)', () => {
  it('renders a <button> by default and applies the default variant+size data-attrs', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('data-slot')).toBe('button');
    expect(btn.getAttribute('data-variant')).toBe('default');
    expect(btn.getAttribute('data-size')).toBe('default');
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('h-8');
  });

  it('reflects a custom variant and size on data-variant and data-size', () => {
    render(
      <Button variant="destructive" size="lg">
        Delete
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.getAttribute('data-variant')).toBe('destructive');
    expect(btn.getAttribute('data-size')).toBe('lg');
    expect(btn.className).toContain('text-destructive');
    expect(btn.className).toContain('h-9');
  });

  it('forwards onClick to the rendered element', () => {
    let clicks = 0;
    render(<Button onClick={() => clicks++}>Go</Button>);
    screen.getByRole('button', { name: 'Go' }).click();
    expect(clicks).toBe(1);
  });

  it('renders a disabled <button> when disabled is true', () => {
    render(<Button disabled>Off</Button>);
    const btn = screen.getByRole('button', { name: 'Off' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('merges a custom className onto the element', () => {
    render(<Button className="my-extra">Click</Button>);
    const btn = screen.getByRole('button', { name: 'Click' });
    expect(btn.className).toContain('my-extra');
    // base classes still applied
    expect(btn.className).toContain('bg-primary');
  });
});

describe('Button asChild (Slot)', () => {
  it('does NOT render a <button> when asChild is true — it renders the child element directly', () => {
    render(
      <Button asChild>
        <a href="/somewhere">Link styled as button</a>
      </Button>,
    );
    // The anchor is the rendered element. There is no <button> wrapping it.
    const link = screen.getByRole('link', { name: 'Link styled as button' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/somewhere');
    // data-slot / data-variant / data-size are forwarded onto the child.
    expect(link.getAttribute('data-slot')).toBe('button');
    expect(link.getAttribute('data-variant')).toBe('default');
    // The link should carry the variant classes — it IS the button visually.
    expect(link.className).toContain('bg-primary');
    expect(link.className).toContain('group/button');
    // No naked <button> with that label.
    expect(screen.queryByRole('button', { name: 'Link styled as button' })).toBeNull();
  });

  it('forwards onClick onto the child element when asChild is true', () => {
    let clicks = 0;
    render(
      <Button asChild onClick={() => clicks++}>
        <a href="#">Click link</a>
      </Button>,
    );
    // Slot merges onClick into the child element.
    screen.getByRole('link', { name: 'Click link' }).click();
    expect(clicks).toBe(1);
  });
});