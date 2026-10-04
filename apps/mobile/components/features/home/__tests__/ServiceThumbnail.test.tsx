import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => ({ teal: { 700: 'teal' }, glass: { opaqueBg: 'white' } }),
}));

import { ServiceThumbnail } from '../ServiceThumbnail';

describe('ServiceThumbnail', () => {
  it('shows the admin service image when supplied', () => {
    const screen = render(<ServiceThumbnail name="استشارة أسرية" imageUrl="https://example.test/service.png" />);
    expect(screen.getByTestId('service-thumbnail-image').props.source).toEqual({ uri: 'https://example.test/service.png' });
    expect(screen.queryByText('ا')).toBeNull();
  });

  it('shows the service initial when no image is supplied', () => {
    const screen = render(<ServiceThumbnail name="استشارة أسرية" imageUrl={null} />);
    expect(screen.getByText('ا')).toBeTruthy();
    expect(screen.queryByTestId('service-thumbnail-image')).toBeNull();
  });

  it('shows the service initial if its image fails to load', () => {
    const screen = render(<ServiceThumbnail name="استشارة أسرية" imageUrl="https://example.test/broken.png" />);
    fireEvent(screen.getByTestId('service-thumbnail-image'), 'error');
    expect(screen.getByText('ا')).toBeTruthy();
    expect(screen.queryByTestId('service-thumbnail-image')).toBeNull();
  });
});
