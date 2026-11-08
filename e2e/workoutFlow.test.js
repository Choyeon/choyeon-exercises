const { device, element, by, expect, waitFor } = require('detox');

/**
 * 完整训练流程 E2E 测试 — 验证训练结束不闪退
 */
describe('完整训练流程', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  it('完整流程：启动 → 开始训练 → 添加动作 → 完成组 → 结束训练 → 不闪退', async () => {
    // ===== Step 1: 等待首页加载 =====
    await waitFor(element(by.id('cta-start-workout')))
      .toBeVisible()
      .withTimeout(20000);
    await expect(element(by.id('cta-start-workout'))).toBeVisible();
    console.log('✓ 首页加载成功，CTA 按钮可见');

    // ===== Step 2: 点击开始训练 =====
    await element(by.id('cta-start-workout')).tap();
    await waitFor(element(by.id('workout-summary-bar')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.id('workout-summary-bar'))).toBeVisible();
    console.log('✓ 进入训练页成功，摘要栏可见');

    // ===== Step 3: 添加训练动作 =====
    // 尝试用 testID 或文本点击 Add exercise 按钮
    let picked = false;
    for (let attempt = 0; attempt < 3 && !picked; attempt++) {
      try {
        await element(by.id('btn-add-exercise')).tap();
      } catch (e) {
        try {
          await element(by.text('Add exercise')).tap();
        } catch (e2) {}
      }
      // 等待 picker 打开
      try {
        await waitFor(element(by.id('picker-exercise-0001')))
          .toBeVisible()
          .withTimeout(5000);
        picked = true;
      } catch (e) {
        console.log(`  尝试 ${attempt + 1}: picker 未打开，重试`);
      }
    }
    if (!picked) {
      throw new Error('❌ 无法打开训练动作选择器');
    }
    await element(by.id('picker-exercise-0001')).tap();
    console.log('✓ 已添加训练动作');

    // 等待动作添加到训练页
    await waitFor(element(by.id('set-check-0')))
      .toBeVisible()
      .withTimeout(10000);
    console.log('✓ 训练动作已添加，第一组可见');

    // ===== Step 4: 完成第一组 =====
    await element(by.id('set-check-0')).tap();
    console.log('✓ 已完成第一组');

    // ===== Step 5: 点击完成训练 ★ 核心验证点 =====
    const finishBtn = element(by.id('btn-finish-workout'));
    await waitFor(finishBtn).toBeVisible().withTimeout(5000);
    await finishBtn.tap();
    console.log('✓ 已点击"完成训练"按钮');

    // 等待完成对话框出现
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 尝试关闭"Session completed"对话框（点击 HISTORY 或外部区域）
    try {
      await element(by.text('HISTORY')).tap();
      console.log('  → 已点击 HISTORY');
    } catch (e) {
      // 可能对话框已自动关闭
    }

    // 等待导航完成
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // ===== Step 6: 验证应用仍在运行（未闪退）=====
    let appAlive = false;
    const checkElements = [
      { id: 'cta-start-workout', label: '首页元素' },
      { id: 'workout-summary-bar', label: '训练页元素' },
    ];
    for (const el of checkElements) {
      try {
        await waitFor(element(by.id(el.id))).toExist().withTimeout(2000);
        appAlive = true;
        console.log(`  → 检测到${el.label}`);
        break;
      } catch (e) {}
    }
    if (!appAlive) {
      const checkTexts = ['TRAINING LOG', 'Start workout', 'Workout', 'Home'];
      for (const text of checkTexts) {
        try {
          await waitFor(element(by.text(text))).toExist().withTimeout(2000);
          appAlive = true;
          console.log(`  → 检测到文本 "${text}"`);
          break;
        } catch (e) {}
      }
    }

    if (!appAlive) {
      throw new Error('❌ 训练结束后应用闪退！');
    }
    console.log('✓ 训练结束后应用未闪退，验证通过');
  });
});
