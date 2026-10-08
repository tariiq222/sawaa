import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { LocalizedHorizontalScroll } from '../LocalizedHorizontalScroll';
import { buildDirState } from '@/hooks/useDir';
const mockScrollTo = jest.fn();
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const React = require('react');
  const mocked = Object.create(actual);
  Object.defineProperty(mocked, 'ScrollView', { value: React.forwardRef((props: object, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return <actual.View {...props} />;
  }) });
  return mocked;
});
it('starts at the locale edge once and preserves the user position on content updates', () => {
  const onContentSizeChange = jest.fn();
  const view = render(<LocalizedHorizontalScroll testID="carousel" dir={buildDirState('ar')} onContentSizeChange={onContentSizeChange} />);
  fireEvent(view.getByTestId('carousel'), 'contentSizeChange', 500, 70);
  fireEvent(view.getByTestId('carousel'), 'contentSizeChange', 700, 80);
  expect(mockScrollTo.mock.calls).toEqual([[{ x: 500, animated: false }]]);
  expect(onContentSizeChange.mock.calls).toEqual([[500, 70], [700, 80]]);
  view.rerender(<LocalizedHorizontalScroll testID="carousel" dir={buildDirState('en')} />);
  fireEvent(view.getByTestId('carousel'), 'contentSizeChange', 700, 80);
  fireEvent(view.getByTestId('carousel'), 'contentSizeChange', 800, 80);
  expect(mockScrollTo.mock.calls).toEqual([[{ x: 500, animated: false }], [{ x: 0, animated: false }]]);
});
