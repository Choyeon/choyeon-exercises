import React from 'react';
import { render } from './render-helper';
import { AppleButton, GroupRow } from '@/components/apple';
import { ThemeProvider, useThemeColors } from '@/theme';

function findMinHeight(node: any): number | null {
  const out: number[] = [];
  const collect = (style: any) => {
    if (style == null) return;
    if (Array.isArray(style)) style.forEach(collect);
    else if (typeof style === 'object') {
      if (typeof style.minHeight === 'number') out.push(style.minHeight);
    }
  };
  collect(node.props?.style);
  return out.length ? Math.min(...out) : null;
}

describe('AppleButton — HIG accessibility & touch target', () => {
  it('exposes role=button and an accessibility label', () => {
    const { getByProps } = render(<AppleButton title="Start workout" />);
    const btn = getByProps(
      (p) => p.accessibilityRole === 'button' && p.accessibilityLabel === 'Start workout',
    );
    expect(btn).toBeTruthy();
  });

  it('disabled state is exposed to assistive tech', () => {
    const { getByProps } = render(<AppleButton title="Go" disabled />);
    const btn = getByProps((p) => p.accessibilityRole === 'button');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('meets the 44pt minimum touch-target height', () => {
    const { getByProps } = render(<AppleButton title="Start" />);
    const btn = getByProps((p) => p.accessibilityRole === 'button');
    const minH = findMinHeight(btn);
    expect(minH).not.toBeNull();
    expect(minH!).toBeGreaterThanOrEqual(44);
  });
});

describe('GroupRow — disclosure row accessibility', () => {
  it('interactive row is a button with a combined label', () => {
    const { getByProps } = render(
      <GroupRow title="Units" subtitle="Weight unit" value="kg" onPress={() => {}} />,
    );
    const row = getByProps((p) => p.accessibilityRole === 'button');
    expect(row).toBeTruthy();
    expect(row.props.accessibilityLabel).toContain('Units');
    expect(row.props.accessibilityLabel).toContain('Weight unit');
  });

  it('non-interactive row is not a button', () => {
    const { getAllByProps } = render(<GroupRow title="ReadOnly" value="x" />);
    const buttons = getAllByProps((p) => p.accessibilityRole === 'button');
    expect(buttons.length).toBe(0);
  });
});

describe('ThemeProvider — renders in light & dark without throwing', () => {
  it('default (dark) context renders', () => {
    const { getByText } = render(<AppleButton title="Dark" />);
    expect(getByText('Dark')).toBeTruthy();
  });

  it('light theme provider renders', () => {
    const { getByText } = render(
      <ThemeProvider>
        <AppleButton title="Light" />
      </ThemeProvider>,
    );
    expect(getByText('Light')).toBeTruthy();
  });

  it('useThemeColors is callable inside provider', () => {
    function Probe() {
      useThemeColors();
      return <AppleButton title="Themed" />;
    }
    const { getByText } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(getByText('Themed')).toBeTruthy();
  });
});
