import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BurnoutTest } from './burnout-test';
import { QUESTIONS } from './questions';

function answerAll(valuePicker: (idx: number) => string) {
  QUESTIONS.forEach((q, idx) => {
    const radios = document.getElementsByName(q.id) as NodeListOf<HTMLInputElement>;
    const target = Array.from(radios).find((r) => r.value === valuePicker(idx));
    if (!target) throw new Error(`missing radio for ${q.id}`);
    fireEvent.click(target);
  });
}

describe('BurnoutTest', () => {
  it('disables submit until every question is answered', () => {
    render(<BurnoutTest locale="en" />);
    const submit = screen.getByRole('button', { name: /see result/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    answerAll(() => '0');
    expect(submit.disabled).toBe(false);
  });

  it('renders the low-level result message when all answers are 0', () => {
    render(<BurnoutTest locale="en" />);
    answerAll(() => '0');
    fireEvent.click(screen.getByRole('button', { name: /see result/i }));
    expect(screen.getByText(/Your score:\s*0\/24/)).toBeTruthy();
    expect(screen.getByText(/Low level/i)).toBeTruthy();
  });

  it('renders the high-level result message when every answer is 4', () => {
    render(<BurnoutTest locale="en" />);
    answerAll(() => '4');
    fireEvent.click(screen.getByRole('button', { name: /see result/i }));
    expect(screen.getByText(/Your score:\s*24\/24/)).toBeTruthy();
    expect(screen.getByText(/High level/i)).toBeTruthy();
  });

  it('resets the form when "Take again" is clicked', () => {
    render(<BurnoutTest locale="en" />);
    answerAll(() => '4');
    fireEvent.click(screen.getByRole('button', { name: /see result/i }));
    fireEvent.click(screen.getByRole('button', { name: /take again/i }));
    const submit = screen.getByRole('button', { name: /see result/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('renders Arabic option labels when locale is ar', () => {
    render(<BurnoutTest locale="ar" />);
    expect(screen.getAllByText('أبداً').length).toBe(QUESTIONS.length);
    expect(screen.getAllByText('دائماً').length).toBe(QUESTIONS.length);
  });
});
