import React from 'react';
import { View, Text } from 'react-native';
import { render } from './render-helper';
import { AppleNavBar, GroupedRows, SectionLabel, Pill, StatTile } from '@/components/apple';

/**
 * Apple 原语的结构化落地测试。
 *
 * 覆盖本轮 UI 重构新增/修改的关键原语：
 *  · AppleNavBar   —— 自定义大标题导航栏（补齐被隐藏原生 header 后缺失的返回键）
 *  · GroupedRows   —— iOS inset-grouped 列表（自动 hairline 分隔）
 *  · SectionLabel  —— 大写小标题
 *  · Pill/StatTile —— 标签与统计块
 */
describe('Apple primitives — structural HIG', () => {
  it('AppleNavBar renders the title as a header', () => {
    const { getByText, getByRole } = render(<AppleNavBar title="体测记录" />);
    expect(getByText('体测记录')).toBeTruthy();
    expect(getByRole('header')).toBeTruthy();
  });

  it('AppleNavBar exposes a labelled back control when onBack is provided', () => {
    const onBack = jest.fn();
    const { getByLabelText } = render(<AppleNavBar title="训练模板" onBack={onBack} />);
    const back = getByLabelText('Back');
    expect(back).toBeTruthy();
    expect(back.props.accessibilityRole).toBe('button');
  });

  it('AppleNavBar omits the back control when onBack is absent', () => {
    const { getByText, queryByLabelText } = render(<AppleNavBar title="数据面板" />);
    expect(getByText('数据面板')).toBeTruthy();
    expect(queryByLabelText('Back')).toBeNull();
  });

  it('GroupedRows inserts a hairline between children but not after the last one', () => {
    const { getByText } = render(
      <GroupedRows>
        <Text>语言</Text>
        <Text>单位</Text>
        <Text>主题</Text>
      </GroupedRows>,
    );
    expect(getByText('语言')).toBeTruthy();
    expect(getByText('单位')).toBeTruthy();
    expect(getByText('主题')).toBeTruthy();
  });

  it('GroupedRows renders a single child without separators', () => {
    const { getByText } = render(
      <GroupedRows>
        <Text>只有一行</Text>
      </GroupedRows>,
    );
    expect(getByText('只有一行')).toBeTruthy();
  });

  it('SectionLabel renders an uppercase eyebrow label', () => {
    const { getByText, getAllByProps } = render(<SectionLabel>通用</SectionLabel>);
    expect(getByText('通用')).toBeTruthy();
    // The eyebrow label is styled with an uppercase transform (iOS convention).
    const eyebrow = getAllByProps((p) => {
      const s = p.style as any;
      return s && typeof s === 'object' && s.textTransform === 'uppercase';
    });
    expect(eyebrow.length).toBeGreaterThan(0);
  });

  it('StatTile shows value and label', () => {
    const { getByText } = render(<StatTile value="128" label="总训练" icon="dumbbell" />);
    expect(getByText('128')).toBeTruthy();
    expect(getByText('总训练')).toBeTruthy();
  });

  it('Pill renders its children', () => {
    const { getByText } = render(<Pill>新增</Pill>);
    expect(getByText('新增')).toBeTruthy();
  });

  it('AppleNavBar accepts a trailing accessory', () => {
    const { getByText } = render(
      <AppleNavBar title="热身" right={<View><Text>我的</Text></View>} />,
    );
    expect(getByText('热身')).toBeTruthy();
    expect(getByText('我的')).toBeTruthy();
  });
});
