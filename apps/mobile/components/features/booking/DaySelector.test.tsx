import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { DaySelector } from './DaySelector';
import { getSawaaColors, getSawaaRoles } from '@/theme/sawaa/tokens';
import type { DirState } from '@/hooks/useDir';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: mockScheme }) }));
jest.mock('@/theme/sawaa/GlassSurface', () => ({
  GlassSurface: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
const dir: DirState = { locale: 'en', isRTL: false, row: 'row', rowReverse: 'row-reverse', alignStart: 'flex-start', alignEnd: 'flex-end', textAlign: 'left', writingDirection: 'ltr', iconScaleX: 1 };

it('updates unselected day text and surfaces while preserving selected contrast and selection', () => {
  const onSelect = jest.fn();
  const element = <DaySelector days={[new Date(2026, 9, 4), new Date(2026, 9, 5)]} dayIdx={0} onSelect={onSelect} dir={dir} f500="System" f700="System" />;
  const view = render(element);
  expect(view.getByText('5')).toHaveStyle({ color: getSawaaColors('light').ink[900] });
  mockScheme = 'dark';
  view.rerender(React.cloneElement(element));
  expect(view.getByText('5')).toHaveStyle({ color: getSawaaColors('dark').ink[900] });
  expect(view.getByText('4')).toHaveStyle({ color: getSawaaRoles('dark').action.foreground });
  const buttons = view.getAllByRole('button');
  expect(buttons[1]).toHaveStyle({ backgroundColor: getSawaaColors('dark').glass.bgStrong });
  fireEvent.press(buttons[1]);
  expect(onSelect).toHaveBeenCalledWith(1);
});
