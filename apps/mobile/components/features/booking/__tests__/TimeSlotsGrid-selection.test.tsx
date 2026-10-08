import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { buildDirState } from '@/hooks/useDir';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, args?: {time:string}) => args?.time ? `${key} ${args.time}` : key }) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('react-native-reanimated', () => ({__esModule:true,default:{View:require('react-native').View},FadeInDown:{delay:()=>({duration:()=>({easing:()=>undefined})})},Easing:{out:()=>undefined,cubic:undefined}}));
jest.mock('@/components/ui/Skeleton', () => ({Skeleton:()=>null}));
jest.mock('@/components/ui/AppIcon', () => ({AppIcon:()=>null}));
import { TimeSlotsGrid, formatTime } from '../TimeSlotsGrid';
const slots = [1,2].map((hour) => ({startTime:new Date(2026,9,7,hour).toISOString(),endTime:new Date(2026,9,7,hour+1).toISOString()}));
const props = {loading:false,error:null,slots,selectedIdx:null,dir:buildDirState('en'),f500:'System',f600:'System',reduceMotion:true};
it('selects the original slot index once and announces the selected slot', () => {
  const select = jest.fn(); const screen = render(<TimeSlotsGrid {...props} onSelect={select} />);
  fireEvent.press(screen.getByRole('radio',{name:`booking.slotTime ${formatTime(slots[1].startTime,false)}`}));
  expect(select).toHaveBeenCalledTimes(1);expect(select).toHaveBeenCalledWith(1);
  screen.rerender(<TimeSlotsGrid {...props} selectedIdx={1} onSelect={select} />);
  expect(screen.getByRole('radio',{name:`booking.slotTime ${formatTime(slots[1].startTime,false)}`}).props.accessibilityState.selected).toBe(true);
});
it('retries a failed read without selecting a slot', () => {
  const retry=jest.fn();const select=jest.fn();const screen=render(<TimeSlotsGrid {...props} error="failed" onRetry={retry} onSelect={select} />);
  fireEvent.press(screen.getByRole('button',{name:'common.retry'}));expect(retry).toHaveBeenCalledTimes(1);expect(select).not.toHaveBeenCalled();
});
