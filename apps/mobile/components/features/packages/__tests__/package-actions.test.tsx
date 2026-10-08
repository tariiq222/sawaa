import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
import { PackageBookingAction } from '../PackageBookingAction';
import { PackageBranchPicker } from '../PackageBranchPicker';
import type { DirState } from '@/hooks/useDir';
const dir: DirState = {locale:'en', isRTL:false, row:'row', textAlign:'left', alignStart:'flex-start', alignEnd:'flex-end', writingDirection:'ltr', rowReverse:'row-reverse',iconScaleX:1};
it('keeps the action label and blocks repeat booking while pending', () => {
  const book = jest.fn(); const screen = render(<PackageBookingAction enabled pending onPress={book} fontFamily="System" />);
  const button = screen.getByRole('button', { name: 'packages.confirmBooking' });
  expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  fireEvent.press(button); expect(book).not.toHaveBeenCalled();
});
it('announces chosen branches and retries without changing selection', () => {
  const select = jest.fn(); const retry = jest.fn();
  const props = { branches: [{id:'a',nameAr:'أ',nameEn:'A',city:null,addressAr:null,isMain:true},{id:'b',nameAr:'ب',nameEn:'B',city:null,addressAr:null,isMain:false}], branchId:'a',loading:false,error:false,onSelect:select,onRetry:retry,dir,f400:'System',f600:'System',f700:'System'};
  const screen = render(<PackageBranchPicker {...props} />);
  fireEvent.press(screen.getByRole('radio', {name:'B'})); expect(select).toHaveBeenCalledWith('b');
  screen.rerender(<PackageBranchPicker {...props} branchId="b" error />);
  expect(screen.getByRole('radio', {name:'B'}).props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByRole('button', {name:'packages.retry'})); expect(retry).toHaveBeenCalledTimes(1); expect(select).toHaveBeenCalledTimes(1);
});

import { PackageCreditCard } from '../PackageCreditCard';
import type { ClientPackageCredit } from '@sawaa/shared/types';
const credit: ClientPackageCredit = {id:'credit',serviceId:'service',employeeId:'employee',durationOptionId:'duration',serviceNameAr:'جلسة',serviceNameEn:'Session',employeeNameAr:'مختصة',employeeNameEn:'Therapist',durationLabelAr:'ساعة',durationLabelEn:'Hour',durationMins:60,serviceIsBookable:true,remaining:1,constraints:[],totalQuantity:2,usedQuantity:1,reservedQuantity:0,unitPriceSnapshot:10000,availability:{bookable:true,reason:null}};
it('keeps locked credits unbookable and passes the concrete available credit unchanged', () => {
  const book=jest.fn();const props={dir,f400:'System',f600:'System',f700:'System',onBook:book};
  const screen=render(<PackageCreditCard {...props} credit={{...credit,remaining:0}} />);
  expect(screen.queryByRole('button')).toBeNull();expect(screen.getByText('packages.locked.depleted')).toBeTruthy();
  screen.rerender(<PackageCreditCard {...props} credit={credit} />);
  fireEvent.press(screen.getByRole('button',{name:'packages.book'}));expect(book).toHaveBeenCalledWith(credit);
});
