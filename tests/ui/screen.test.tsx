import React from 'react';
import { Text } from 'react-native';
import { render } from './render-helper';
import { Screen } from '@/components/apple';

describe('Screen — universal page frame (HIG: safe area + readable width)', () => {
  it('renders children inside a safe-area frame', () => {
    const { getByText } = render(
      <Screen>
        <Text>Hello</Text>
      </Screen>,
    );
    expect(getByText('Hello')).toBeTruthy();
  });

  it('non-scroll mode still renders children', () => {
    const { getByText } = render(
      <Screen scroll={false}>
        <Text>Static</Text>
      </Screen>,
    );
    expect(getByText('Static')).toBeTruthy();
  });

  it('bottomBar variant renders without throwing', () => {
    const { getByText } = render(
      <Screen bottomBar={56}>
        <Text>Tabbed</Text>
      </Screen>,
    );
    expect(getByText('Tabbed')).toBeTruthy();
  });
});
