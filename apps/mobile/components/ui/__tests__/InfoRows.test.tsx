import React from 'react';
import { render } from '@testing-library/react-native';
import { Clock } from 'lucide-react-native';
import { InfoRows } from '../InfoRows';
import { DirContext, buildDirState } from '@/hooks/useDir';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
it.each(['inline', 'stacked'] as const)('retains natural value direction alongside Arabic labels in %s', layout => {
  const view = render(<DirContext.Provider value={buildDirState('ar')}><InfoRows layout={layout} rows={[
    { icon: Clock, label: 'الفاتورة', value: '#12345' },
    { icon: Clock, label: 'المرجع', value: 'PAY-2026-ABC' },
    { icon: Clock, label: 'الخدمة', value: 'الإرشاد الأسري' },
  ]} /></DirContext.Provider>);
  for (const value of ['#12345', 'PAY-2026-ABC', 'الإرشاد الأسري']) {
    expect(view.getByText(value)).toHaveStyle({ writingDirection: 'auto', textAlign: 'right' });
  }
  expect(view.getByText('الفاتورة')).toHaveStyle({ writingDirection: 'rtl', textAlign: 'right' });
});
