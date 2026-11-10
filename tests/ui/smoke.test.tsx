import React from 'react';
import { render } from './render-helper';
import {
  AppleHeader,
  AppleButton,
  Pill,
  StatTile,
  GroupedCard,
  GroupRow,
  SectionLabel,
} from '@/components/apple';

describe('smoke: Apple primitives render without throwing', () => {
  it('AppleHeader renders title text', () => {
    const { getByText } = render(<AppleHeader title="Workouts" />);
    expect(getByText('Workouts')).toBeTruthy();
  });

  it('AppleButton renders title', () => {
    const { getByText } = render(<AppleButton title="Start" />);
    expect(getByText('Start')).toBeTruthy();
  });

  it('Pill renders children', () => {
    const { getByText } = render(<Pill>Pro</Pill>);
    expect(getByText('Pro')).toBeTruthy();
  });

  it('StatTile renders value and label', () => {
    const { getByText } = render(<StatTile value="12" label="Sessions" />);
    expect(getByText('12')).toBeTruthy();
    expect(getByText('Sessions')).toBeTruthy();
  });

  it('GroupedCard + GroupRow render', () => {
    const { getByText } = render(
      <GroupedCard>
        <GroupRow title="Units" value="kg" />
      </GroupedCard>,
    );
    expect(getByText('Units')).toBeTruthy();
    expect(getByText('kg')).toBeTruthy();
  });

  it('SectionLabel renders uppercase eyebrow', () => {
    const { getByText } = render(<SectionLabel>Today</SectionLabel>);
    expect(getByText('Today')).toBeTruthy();
  });
});
