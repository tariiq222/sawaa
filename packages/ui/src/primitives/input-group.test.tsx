import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from './input-group';

describe('InputGroup', () => {
  it('renders a div with data-slot="input-group" and role="group"', () => {
    render(<InputGroup data-testid="grp" />);
    const grp = screen.getByTestId('grp');
    expect(grp.tagName).toBe('DIV');
    expect(grp.getAttribute('data-slot')).toBe('input-group');
    expect(grp.getAttribute('role')).toBe('group');
  });

  it('merges a custom className onto the wrapper', () => {
    render(<InputGroup data-testid="grp" className="my-addons" />);
    expect(screen.getByTestId('grp').className).toContain('my-addons');
  });
});

describe('InputGroupAddon', () => {
  function setupAddonWithInput(addonProps: { 'data-testid'?: string } = {}) {
    const inputRef = React.createRef<HTMLInputElement>();
    const result = render(
      <InputGroup>
        <InputGroupAddon {...addonProps}>
          <span>kg</span>
        </InputGroupAddon>
        <InputGroupInput data-testid="input" ref={inputRef} />
      </InputGroup>,
    );
    return { inputRef, ...result };
  }

  it('renders with role="group", data-slot and a default data-align="inline-start"', () => {
    render(
      <InputGroupAddon data-testid="addon">
        <span>kg</span>
      </InputGroupAddon>,
    );
    const addon = screen.getByTestId('addon');
    expect(addon.getAttribute('role')).toBe('group');
    expect(addon.getAttribute('data-slot')).toBe('input-group-addon');
    expect(addon.getAttribute('data-align')).toBe('inline-start');
  });

  it('reflects a custom align prop on data-align', () => {
    render(
      <InputGroupAddon data-testid="addon" align="block-end">
        <span>kg</span>
      </InputGroupAddon>,
    );
    expect(screen.getByTestId('addon').getAttribute('data-align')).toBe('block-end');
  });

  it('applies the align variant classes (inline-end uses pe-2)', () => {
    render(
      <InputGroupAddon data-testid="addon" align="inline-end">
        <span>kg</span>
      </InputGroupAddon>,
    );
    expect(screen.getByTestId('addon').className).toContain('pe-2');
  });

  it('applies the block-start align classes (px-2.5 pt-2)', () => {
    render(
      <InputGroupAddon data-testid="addon" align="block-start">
        <span>kg</span>
      </InputGroupAddon>,
    );
    const cls = screen.getByTestId('addon').className;
    expect(cls).toContain('px-2.5');
    expect(cls).toContain('pt-2');
  });

  it('applies the block-end align classes (px-2.5 pb-2)', () => {
    render(
      <InputGroupAddon data-testid="addon" align="block-end">
        <span>kg</span>
      </InputGroupAddon>,
    );
    const cls = screen.getByTestId('addon').className;
    expect(cls).toContain('px-2.5');
    expect(cls).toContain('pb-2');
  });

  it('focuses the sibling input when the addon body (non-button area) is clicked', () => {
    const { inputRef } = setupAddonWithInput();
    // Click the span inside the addon — not a button.
    const addon = screen.getByText('kg').parentElement!;
    fireEvent.click(addon);
    expect(document.activeElement).toBe(inputRef.current);
  });

  it('does NOT focus the input when a <button> inside the addon is clicked', () => {
    const inputRef = React.createRef<HTMLInputElement>();
    render(
      <InputGroup>
        <InputGroupAddon data-testid="addon">
          <button data-testid="inner-btn" type="button">
            toggle
          </button>
        </InputGroupAddon>
        <InputGroupInput data-testid="input" ref={inputRef} />
      </InputGroup>,
    );

    // Spy on the input's focus() — the addon's onClick should NOT call it
    // when the click target is inside a <button>.
    const focusSpy = vi.spyOn(inputRef.current as HTMLInputElement, 'focus');
    fireEvent.click(screen.getByTestId('inner-btn'));
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('handles missing parent or sibling input gracefully (no throw)', () => {
    // Render the addon in isolation (no InputGroupInput sibling).
    render(
      <InputGroupAddon data-testid="addon">
        <span>alone</span>
      </InputGroupAddon>,
    );
    // The click should not throw even though there is no sibling input.
    expect(() =>
      fireEvent.click(screen.getByText('alone').parentElement!),
    ).not.toThrow();
  });
});

describe('InputGroupButton', () => {
  it('renders a <button type="button"> by default and forwards data-size', () => {
    render(
      <InputGroup data-testid="grp">
        <InputGroupButton data-testid="btn">Send</InputGroupButton>
        <InputGroupInput />
      </InputGroup>,
    );
    const btn = screen.getByTestId('btn');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.getAttribute('data-size')).toBe('xs'); // default size
  });

  it('reflects a custom size prop on data-size', () => {
    render(
      <InputGroup data-testid="grp">
        <InputGroupButton data-testid="btn" size="sm">
          Send
        </InputGroupButton>
        <InputGroupInput />
      </InputGroup>,
    );
    expect(screen.getByTestId('btn').getAttribute('data-size')).toBe('sm');
  });

  it('uses type="submit" when explicitly requested', () => {
    render(
      <InputGroup>
        <InputGroupButton data-testid="btn" type="submit">
          Save
        </InputGroupButton>
        <InputGroupInput />
      </InputGroup>,
    );
    expect(screen.getByTestId('btn').getAttribute('type')).toBe('submit');
  });

  it('honors a custom variant prop (default is ghost)', () => {
    render(
      <InputGroup>
        <InputGroupButton data-testid="btn" variant="outline">
          Save
        </InputGroupButton>
        <InputGroupInput />
      </InputGroup>,
    );
    expect(screen.getByTestId('btn').className).toContain('border-border');
  });
});

describe('InputGroupText', () => {
  it('renders a span with the muted-foreground text style', () => {
    render(<InputGroupText data-testid="txt">helper</InputGroupText>);
    const span = screen.getByTestId('txt');
    expect(span.tagName).toBe('SPAN');
    expect(span.textContent).toBe('helper');
    expect(span.className).toContain('text-muted-foreground');
  });
});

describe('InputGroupInput', () => {
  it('renders an input with data-slot="input-group-control"', () => {
    render(<InputGroupInput data-testid="ctl" placeholder="Enter value" />);
    const input = screen.getByTestId('ctl');
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('data-slot')).toBe('input-group-control');
    expect(input.getAttribute('placeholder')).toBe('Enter value');
  });
});

describe('InputGroupTextarea', () => {
  it('renders a textarea with data-slot="input-group-control"', () => {
    render(
      <InputGroupTextarea data-testid="ctl" placeholder="Notes" defaultValue="existing" />,
    );
    const ta = screen.getByTestId('ctl');
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.getAttribute('data-slot')).toBe('input-group-control');
    expect(ta.getAttribute('placeholder')).toBe('Notes');
    expect((ta as HTMLTextAreaElement).value).toBe('existing');
  });
});