import React from 'react';
import { View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => { const { View } = require('react-native'); return <View testID="loading" />; } }));
jest.mock('@/components/ui/EmptyState', () => ({ EmptyState: ({ title, actionLabel, onAction }: {title:string;actionLabel:string;onAction:()=>void}) => {
  const { Text, Pressable, View } = require('react-native');
  return <View><Text>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction}><Text>{actionLabel}</Text></Pressable></View>;
} }));
import { HomeSectionState } from '../HomeSectionState';
it('retries failed reading without reporting a successful empty section', () => {
  const retry = jest.fn();
  const screen = render(<HomeSectionState loading={false} error hasData={false} onRetry={retry}><View testID="loaded" /></HomeSectionState>);
  expect(screen.getByText('home.sectionLoadError')).toBeTruthy();
  expect(screen.queryByTestId('loaded')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'common.retry' }));
  expect(retry).toHaveBeenCalledTimes(1);
  screen.rerender(<HomeSectionState loading={false} error={false} hasData={false} onRetry={retry}><View testID="loaded" /></HomeSectionState>);
  expect(screen.toJSON()).toBeNull();
});
it('shows loading only when data is absent and preserves cached content on failed refresh', () => {
  const retry = jest.fn();
  const screen = render(<HomeSectionState loading error={false} hasData={false} onRetry={retry}><View testID="loaded" /></HomeSectionState>);
  expect(screen.getByTestId('loading')).toBeTruthy();
  screen.rerender(<HomeSectionState loading={false} error hasData onRetry={retry}><View testID="loaded" /></HomeSectionState>);
  expect(screen.getByTestId('loaded')).toBeTruthy();
  expect(screen.getByText('home.sectionLoadError')).toBeTruthy();
});
it.each(['upcoming', 'therapists', 'clinics', 'cms', 'purchases', 'assessment'])('retries the supplied %s read once', () => {
  const retry = jest.fn();
  const screen = render(<HomeSectionState loading={false} error hasData={false} onRetry={retry}>{null}</HomeSectionState>);
  fireEvent.press(screen.getByRole('button', { name: 'common.retry' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
