import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhoneInput } from './phone-input';

const COUNTRY_CODE = '+966';

function getInput(): HTMLInputElement {
  return screen.getByPlaceholderText('5XXXXXXXX') as HTMLInputElement;
}

describe('PhoneInput', () => {
  it('renders the +966 country prefix badge and an empty input by default', () => {
    render(<PhoneInput />);
    expect(screen.getByText('+966')).toBeTruthy();
    expect(getInput().value).toBe('');
  });

  it('renders with the supplied id', () => {
    render(<PhoneInput id="phone" />);
    const input = document.getElementById('phone');
    expect(input).not.toBeNull();
    expect(input?.tagName).toBe('INPUT');
  });

  it('unwraps a full E.164 value (+966XXXXXXXXX) to local digits in the display', () => {
    render(<PhoneInput value={`${COUNTRY_CODE}501234567`} />);
    expect(getInput().value).toBe('501234567');
  });

  it('leaves a non-E.164 value untouched in the display (raw passthrough)', () => {
    render(<PhoneInput value="501234567" />);
    expect(getInput().value).toBe('501234567');
  });

  it('emits the full E.164 form (+966 + 9 digits) on change for valid local input', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    fireEvent.change(getInput(), { target: { value: '501234567' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(`${COUNTRY_CODE}501234567`);
  });

  it('strips non-digit characters and emits only digits prefixed with +966', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    fireEvent.change(getInput(), { target: { value: '(050) 123-4567' } });
    expect(onChange).toHaveBeenCalledWith(`${COUNTRY_CODE}501234567`);
  });

  it('strips a single leading zero the user types (Saudi local numbers start with 5)', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    fireEvent.change(getInput(), { target: { value: '0501234567' } });
    expect(onChange).toHaveBeenCalledWith(`${COUNTRY_CODE}501234567`);
  });

  it('strips multiple leading zeros (while-loop path)', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    fireEvent.change(getInput(), { target: { value: '000501234567' } });
    expect(onChange).toHaveBeenCalledWith(`${COUNTRY_CODE}501234567`);
  });

  it('caps the local number at exactly 9 digits (10+ digit input is truncated)', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    fireEvent.change(getInput(), { target: { value: '5012345678999' } });
    expect(onChange).toHaveBeenCalledWith(`${COUNTRY_CODE}501234567`);
  });

  it('emits an empty string when the user clears the input', () => {
    const onChange = vi.fn();
    render(<PhoneInput value={`${COUNTRY_CODE}501234567`} onChange={onChange} />);
    fireEvent.change(getInput(), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('emits an empty string when the user types only non-digit characters', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    fireEvent.change(getInput(), { target: { value: 'abc-!@#' } });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('caps an 11-digit-with-leading-zero input at 9 digits (after zero-strip)', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    // "0" + 10 more digits → strip the 0, get 10 digits → cap to 9.
    fireEvent.change(getInput(), { target: { value: '05012345678' } });
    expect(onChange).toHaveBeenCalledWith(`${COUNTRY_CODE}501234567`);
  });

  it('applies a custom className and renders disabled state when disabled', () => {
    const { container } = render(<PhoneInput className="custom-class" disabled />);
    const wrapper = container.querySelector('.custom-class');
    expect(wrapper).not.toBeNull();
    expect(getInput().disabled).toBe(true);
  });

  it('forwards onBlur to the user handler', () => {
    const onBlur = vi.fn();
    render(<PhoneInput onBlur={onBlur} />);
    fireEvent.blur(getInput());
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('uses type="tel" with inputMode="numeric" for the proper mobile keyboard', () => {
    render(<PhoneInput />);
    const input = getInput();
    expect(input.getAttribute('type')).toBe('tel');
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });
});
