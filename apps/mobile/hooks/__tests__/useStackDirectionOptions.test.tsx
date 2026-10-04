import React from 'react';
import { renderHook } from '@testing-library/react-native';

import { DirContext, buildDirState } from '@/hooks/useDir';
import { useStackDirectionOptions } from '@/hooks/useStackDirectionOptions';

const optionsFor = (language: 'ar' | 'en') =>
  renderHook(() => useStackDirectionOptions(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <DirContext.Provider value={buildDirState(language)}>{children}</DirContext.Provider>
    ),
  }).result.current;

describe('useStackDirectionOptions', () => {
  it('mirrors the stack in Arabic so swipe-back starts beside the back button', () => {
    expect(optionsFor('ar')).toEqual({ animation: 'slide_from_left', animationMatchesGesture: true });
  });

  it('keeps the platform default direction in English', () => {
    expect(optionsFor('en')).toEqual({ animation: 'slide_from_right' });
  });
});
