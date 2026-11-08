/**
 * strength 层单测 —— 1RM / 百分比反推 / 杠铃片 / 单位换算 / 格式化。
 *
 * 重点防守三类历史 bug：
 *   1) NaN / Infinity 泄漏到 UI（出现过「NaN kg」展示）
 *   2) 杠铃片算出配不出来的方案却标称精确（用户练到一半卡住）
 *   3) kg / lb 混用导致 PR 比较得出错误结论
 */

const { assert, eq, close } = require('./helpers');
const {
  lbToKg,
  kgToLb,
  convertWeight,
  toKg,
  displayWeight,
  estimate1RM,
  weightForPercent,
  intensityPercent,
  setVolume,
  computePlates,
  roundToLoadable,
  formatVolumeShort,
  formatDurationParts,
} = require('../src/utils/strength');

module.exports = {
  name: 'strength 力量计算',
  tests: [
    {
      name: '单位换算：往返一致，非法输入归 0',
      fn() {
        close(kgToLb(100), 220.462, 0.01);
        close(lbToKg(220.462), 100, 0.01);
        eq(convertWeight(100, 'kg', 'lb'), kgToLb(100));
        eq(convertWeight(100, 'kg', 'kg'), 100, '同单位往返不应引入误差');
        eq(toKg(100, 'kg'), 100);
        close(toKg(225, 'lb'), 102.06, 0.01);
        eq(toKg(NaN, 'kg'), 0, 'NaN 泄漏');
        eq(convertWeight(Infinity, 'kg', 'lb'), 0, 'Infinity 泄漏');
      },
    },
    {
      name: '1RM：Epley 基准值正确',
      fn() {
        // 100kg × 5 次 → 100 × (1 + 5/30) = 116.67 → 116.7
        close(estimate1RM(100, 5, 'epley'), 116.7, 0.05);
        // 1 次 = 自身
        close(estimate1RM(100, 1, 'epley'), 103.3, 0.05);
      },
    },
    {
      name: '1RM：非法与越界输入一律返回 0（绝不返回 NaN/Infinity）',
      fn() {
        for (const [w, r, f] of [
          [0, 5, 'epley'], [-10, 5, 'epley'], [100, 0, 'epley'], [100, -3, 'epley'],
          [NaN, 5, 'epley'], [100, NaN, 'epley'], [Infinity, 5, 'epley'],
          // Brzycki 在 r>=37 时公式失效，必须退化而不是返回负数/Infinity
          [100, 40, 'brzycki'], [100, 37, 'brzycki'],
          // Wathan 分母可能 <= 0
          [100, 200, 'wathan'],
        ]) {
          const v = estimate1RM(w, r, f);
          assert(Number.isFinite(v), `estimate1RM(${w},${r},${f}) 返回非有限值: ${v}`);
          assert(v >= 0, `estimate1RM(${w},${r},${f}) 返回负数: ${v}`);
        }
      },
    },
    {
      name: '1RM：Brzycki 在高次数下退化为线性外推而不是发散',
      fn() {
        const v = estimate1RM(60, 40, 'brzycki');
        // 退化路径 = Epley
        close(v, estimate1RM(60, 40, 'epley'), 0.05);
        assert(v > 0, '退化为 0');
      },
    },
    {
      name: 'weightForPercent：反推出的重量回代应还原目标强度',
      fn() {
        const oneRm = 100;
        for (const pct of [50, 65, 75, 85, 90]) {
          const w = weightForPercent(oneRm, pct, 5, 'epley');
          const back = estimate1RM(w, 5, 'epley');
          // 允许 0.5kg 步进带来的误差
          close(back, oneRm * (pct / 100), 0.6, `pct=${pct}`);
        }
      },
    },
    {
      name: 'weightForPercent：边界入参不产生 NaN',
      fn() {
        eq(weightForPercent(0, 75, 5), 0, '1RM=0');
        eq(weightForPercent(-5, 75, 5), 0, '1RM<0');
        const v = weightForPercent(100, 0, 5);
        assert(Number.isFinite(v), 'pct=0 产生非有限值');
        const v2 = weightForPercent(100, 500, 5);
        assert(Number.isFinite(v2), 'pct 越界产生非有限值');
      },
    },
    {
      name: 'intensityPercent：0 / 边界安全',
      fn() {
        close(intensityPercent(80, 100), 80, 0.05);
        eq(intensityPercent(80, 0), 0, '1RM=0 应返回 0 而不是 Infinity');
        const v = intensityPercent(1000, 100);
        assert(Number.isFinite(v), '超高强度应被 clamp');
        assert(v <= 300, `未 clamp: ${v}`);
      },
    },
    {
      name: 'setVolume：脏值归 0',
      fn() {
        eq(setVolume(100, 5), 500);
        eq(setVolume(-100, 5), 0);
        eq(setVolume(100, 0), 0);
        eq(setVolume('abc', 5), 0);
        eq(setVolume(NaN, NaN), 0);
      },
    },
    {
      name: 'computePlates：标准配置能精确配出常见重量',
      fn() {
        // 100kg：杆 20 + 单侧 40 → 25 + 15
        const r = computePlates(100);
        eq(r.exact, true, '100kg 应可精确配出');
        eq(r.achievable, 100, '可达重量');
        eq(r.perSide.join(','), '25,15', '单侧组合');
        eq(r.bar, 20, '空杆');
      },
    },
    {
      name: 'computePlates：非整数步进也能配（1.25 片）',
      fn() {
        const r = computePlates(102.5);
        eq(r.exact, true, '102.5kg 应可精确配出');
        close(r.achievable, 102.5, 0.001);
      },
    },
    {
      name: 'computePlates：配不出时返回「不超重的最近解」并置 exact=false',
      fn() {
        // 只有 25/20/10 片时，100.5 配不出
        const r = computePlates(100.5, { barWeight: 20, plates: [25, 20, 10] });
        eq(r.exact, false, '不应谎报精确');
        assert(r.achievable <= 100.5, `达成的重量超重了: ${r.achievable}`);
        assert(Number.isFinite(r.achievable), 'achievable 非有限值');
      },
    },
    {
      name: 'computePlates：低于空杆重量时不产生负片',
      fn() {
        const r = computePlates(10);
        eq(r.perSide.length, 0, '不应给出负片');
        eq(r.achievable, 20, '最低只能是空杆');
        eq(r.exact, false, '10kg 配不出');
      },
    },
    {
      name: 'computePlates：空配置 / 非法入参不崩',
      fn() {
        const r1 = computePlates(100, { barWeight: 20, plates: [] });
        eq(r1.achievable, 20);
        const r2 = computePlates(0);
        assert(Number.isFinite(r2.achievable), 'target=0 崩了');
        const r3 = computePlates(-50);
        assert(Number.isFinite(r3.achievable), '负数崩了');
        const r4 = computePlates(NaN);
        assert(Number.isFinite(r4.achievable), 'NaN 崩了');
      },
    },
    {
      name: 'roundToLoadable：按最小片的 2 倍步进吸附',
      fn() {
        // 默认最小片 1.25 → 步进 2.5
        close(roundToLoadable(100.4), 100, 0.001);
        close(roundToLoadable(101.3), 102.5, 0.001);
        close(roundToLoadable(103.7), 102.5, 0.001);
      },
    },
    {
      name: 'formatVolumeShort：大数字压缩',
      fn() {
        eq(formatVolumeShort(500), '500');
        eq(formatVolumeShort(1500), '1.50k');
        eq(formatVolumeShort(12000), '12.0k');
        eq(formatVolumeShort(2500000), '2.5M');
        eq(formatVolumeShort(NaN), '0');
      },
    },
    {
      name: 'formatDurationParts：时分秒分档',
      fn() {
        eq(formatDurationParts(45), '45s');
        eq(formatDurationParts(750), '12m 30s');
        eq(formatDurationParts(3900), '1h 05m');
        eq(formatDurationParts(-10), '0s', '负数应归 0');
        eq(formatDurationParts(NaN), '0s');
      },
    },
    {
      name: 'displayWeight：按单位换算到 0.5 步进',
      fn() {
        close(displayWeight(100, 'kg'), 100, 0.001);
        close(displayWeight(100, 'lb'), 220.5, 0.001);
        eq(displayWeight(NaN, 'lb'), 0);
      },
    },
  ],
};
