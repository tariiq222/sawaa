import { describe, it, expect } from 'vitest';
import { QUESTIONS, OPTIONS, scoreLevel, optionLabel } from './questions';

describe('scoreLevel', () => {
  const MAX = QUESTIONS.length * 4;

  it('returns low when score is under 33% of max', () => {
    expect(scoreLevel(0)).toBe('low');
    expect(scoreLevel(Math.floor(MAX * 0.2))).toBe('low');
  });

  it('returns medium in the 33%–65% band', () => {
    expect(scoreLevel(Math.ceil(MAX * 0.33))).toBe('medium');
    expect(scoreLevel(Math.floor(MAX * 0.5))).toBe('medium');
  });

  it('returns high at 66% and above', () => {
    expect(scoreLevel(Math.ceil(MAX * 0.66))).toBe('high');
    expect(scoreLevel(MAX)).toBe('high');
  });
});

describe('optionLabel', () => {
  it('returns the Arabic label for a valid value', () => {
    expect(optionLabel('ar', 0)).toBe('أبداً');
    expect(optionLabel('ar', 4)).toBe('دائماً');
  });

  it('returns the English label for a valid value', () => {
    expect(optionLabel('en', 0)).toBe('Never');
    expect(optionLabel('en', 4)).toBe('Always');
  });

  it('returns an empty string for an unknown value', () => {
    expect(optionLabel('ar', 99)).toBe('');
  });
});

describe('QUESTIONS + OPTIONS', () => {
  it('exposes exactly 6 questions — changing this needs a design review', () => {
    expect(QUESTIONS).toHaveLength(6);
  });

  it('exposes 5 response options', () => {
    expect(OPTIONS).toHaveLength(5);
  });

  it('every question has both Arabic and English text', () => {
    for (const q of QUESTIONS) {
      expect(q.textAr.trim().length).toBeGreaterThan(0);
      expect(q.textEn.trim().length).toBeGreaterThan(0);
    }
  });
});
