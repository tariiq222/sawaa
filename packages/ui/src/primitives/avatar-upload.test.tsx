import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AvatarUpload } from './avatar-upload';

function makeFile(name: string, type = 'image/png'): File {
  return new File(['dummy-bytes'], name, { type });
}

describe('AvatarUpload', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  const objectUrls: string[] = [];

  beforeEach(() => {
    objectUrls.length = 0;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((file: File | Blob | MediaSource) => {
      const url = `blob:mock-${(file as File).name ?? 'blob'}`;
      objectUrls.push(url);
      return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => {
      const i = objectUrls.indexOf(url);
      if (i >= 0) objectUrls.splice(i, 1);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('renders the empty-state placeholder (no preview image) when no value is given', () => {
    render(<AvatarUpload onChange={() => {}} onClear={() => {}} />);
    // No <img> rendered in the empty state.
    expect(screen.queryByAltText('avatar')).toBeNull();
    // The circle (cursor-pointer group) is present as a clickable <div>.
    // Plus an add (+) badge <button> to trigger the file input.
    expect(screen.getAllByRole('button').length).toBe(1);
  });

  it('renders the supplied value as an <img alt="avatar"> when a value is given', () => {
    render(
      <AvatarUpload
        value="https://example.com/me.png"
        onChange={() => {}}
        onClear={() => {}}
      />,
    );
    const img = screen.getByAltText('avatar') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://example.com/me.png');
  });

  it('forwards a custom className to the outer wrapper', () => {
    const { container } = render(
      <AvatarUpload
        onChange={() => {}}
        onClear={() => {}}
        className="my-avatar-wrap"
      />,
    );
    const wrapper = container.querySelector('.my-avatar-wrap');
    expect(wrapper).not.toBeNull();
  });

  it('renders the children slot for extra controls', () => {
    render(
      <AvatarUpload onChange={() => {}} onClear={() => {}}>
        <label data-testid="child-slot">enabled</label>
      </AvatarUpload>,
    );
    expect(screen.getByTestId('child-slot').textContent).toBe('enabled');
  });

  it('renders a hidden <input type="file"> with the expected accept list', () => {
    const { container } = render(
      <AvatarUpload onChange={() => {}} onClear={() => {}} />,
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.className).toContain('hidden');
    expect(input.getAttribute('accept')).toBe(
      'image/png,image/jpeg,image/webp,image/gif',
    );
  });

  describe('file selection (handleFile)', () => {
    it('calls onChange(file, url) and creates a preview when a file is picked', () => {
      const onChange = vi.fn();
      const { container } = render(
        <AvatarUpload onChange={onChange} onClear={() => {}} />,
      );
      const file = makeFile('avatar.png');
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      expect(onChange).toHaveBeenCalledTimes(1);
      const [argFile, argUrl] = onChange.mock.calls[0];
      expect(argFile).toBe(file);
      expect(typeof argUrl).toBe('string');
      expect(argUrl).toMatch(/^blob:/);
      expect(URL.createObjectURL).toHaveBeenCalledWith(file);

      // After upload, the avatar <img alt="avatar"> is rendered with the URL.
      const img = screen.getByAltText('avatar') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe(argUrl);
    });

    it('clears the file input value after a successful pick so re-selecting the same file fires change again', () => {
      const onChange = vi.fn();
      const { container } = render(
        <AvatarUpload onChange={onChange} onClear={() => {}} />,
      );
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      fireEvent.change(input, { target: { files: [makeFile('a.png')] } });
      // After the change, the component resets the input so the user can
      // re-pick the same file later and the change handler fires again.
      expect(input.value).toBe('');
      expect(onChange).toHaveBeenCalledTimes(1);

      fireEvent.change(input, { target: { files: [makeFile('a.png')] } });
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('does nothing when no file is selected (files is empty)', () => {
      const onChange = vi.fn();
      const { container } = render(
        <AvatarUpload onChange={onChange} onClear={() => {}} />,
      );
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { files: [] } });
      expect(onChange).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('clear button (handleClear)', () => {
    it('calls onClear and removes the preview when the × button is clicked', () => {
      const onClear = vi.fn();
      render(
        <AvatarUpload
          value="https://example.com/me.png"
          onChange={() => {}}
          onClear={onClear}
        />,
      );
      expect(screen.getByAltText('avatar')).not.toBeNull();
      // The destructive badge button has the Cancel icon; find by closest role.
      // The first <button> inside the badge is the only button in this state.
      const buttons = screen.getAllByRole('button');
      // Click the clear badge (the smaller one, not the circle).
      // We have two buttons: the avatar-circle click target, and the clear badge.
      // The clear badge has bg-destructive; the circle is a div, not a button.
      // So the only button here is the clear badge.
      fireEvent.click(buttons[0]);
      expect(onClear).toHaveBeenCalledTimes(1);
      // After clear, the preview image should be gone.
      expect(screen.queryByAltText('avatar')).toBeNull();
    });

    it('stops click propagation so clicking the clear badge does not also open the file picker', () => {
      const onClear = vi.fn();
      const { container } = render(
        <AvatarUpload
          value="https://example.com/me.png"
          onChange={() => {}}
          onClear={onClear}
        />,
      );
      // Spy on the file input click to confirm the clear button does NOT
      // bubble up to the circle's onClick that triggers inputRef.click().
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const inputClickSpy = vi.spyOn(input, 'click');
      const badge = screen.getAllByRole('button')[0];
      fireEvent.click(badge);
      expect(onClear).toHaveBeenCalledTimes(1);
      expect(inputClickSpy).not.toHaveBeenCalled();
    });
  });

  describe('circle click opens file picker', () => {
    it('calls inputRef.click() when the avatar circle is clicked', () => {
      const { container } = render(
        <AvatarUpload onChange={() => {}} onClear={() => {}} />,
      );
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const inputClickSpy = vi.spyOn(input, 'click');

      // The circle is the only element with "cursor-pointer" + "rounded-full".
      const circle = container.querySelector('div.cursor-pointer') as HTMLElement;
      fireEvent.click(circle);

      expect(inputClickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('add badge click opens file picker', () => {
    it('calls inputRef.click() when the + badge button is clicked', () => {
      const { container } = render(
        <AvatarUpload onChange={() => {}} onClear={() => {}} />,
      );
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const inputClickSpy = vi.spyOn(input, 'click');

      // The badge is a <button> in the empty state.
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);

      expect(inputClickSpy).toHaveBeenCalledTimes(1);
    });
  });
});