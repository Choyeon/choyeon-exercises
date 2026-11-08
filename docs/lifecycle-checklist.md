# 全生命周期检查清单（Choyeon Exercises）

面向本项目的一份「从需求到线上再到维护」的落地清单。
不是通用模板，每一条都对应本项目里真实存在的文件 / 约定 / 踩过的坑。
提交前、发版前按阶段过一遍。

---

## 0. 需求与边界

- [x] 定位：纯离线工具 App —— **无商业化、无账号、无联网、无社区 / 社交**
- [x] 对标对象：训记 / 开练 / Keep / 薄荷健康 —— 只借鉴训练记录与数据反馈的形态，
      不借鉴其商业化模块（课程售卖、商城、社区动态、广告位）
- [ ] 新增功能先问一句：它是否需要网络 / 账号 / 第三方 SDK？是 → 不做

## 1. 领域建模

- [x] 领域模型集中在 `src/types/index.ts`：`WorkoutSet`（含 `type` / `rpe` / `durationSec` / `completedAt`）、
      `WorkoutSession`、`CustomExercise`、`PersonalRecord`、`PlateConfig`、`PlanSession`
- [x] 新字段**全部可选**。已落库的老数据没有这些字段，必填会让 rehydrate 产生残缺对象
- [x] 单位约定：内部 kg，展示层按 `settings.units` 换算（`toKg` / `displayWeight` / `convertWeight`）
- [x] 常量默认值唯一来源 `src/constants/settings.ts`（`DEFAULT_SETTINGS` / `withDefaultSettings()`）

## 2. 状态与持久化

- [x] `PERSIST_VERSION` 现为 5；vault key **固定** `@choyeon/vault/v4`（改名 = 老用户数据全丢）
- [x] `partialize` 明确列出持久化字段，runtime-only 状态（如 `restTimer`）不入盘
- [x] `merge` / `migrate` 覆盖跨版本升级路径
- [x] rehydrate 后强制走 `src/store/sanitize.ts` 的 `sanitizeState()`：
      数组字段归一化、脏值归零、组类型白名单化
- [x] `updateSet` 只在「未完成 → 完成」跃迁时打 `completedAt`，取消打钩清空
- [ ] 新增持久化字段时同步改三处：`PersistedShape` / `partialize` / `migrate`

## 3. 纯逻辑与算法层（可单测）

- [x] `src/utils/strength.ts` — 1RM 五公式、`%1RM` 二分反推、杠铃片贪心配重、
      可配重量吸附、容量/时长格式化。**绝不返回 NaN / Infinity**
- [x] `src/utils/analytics.ts` — 日期键（本地时区，不用 `toISOString()`）、
      计数口径、日聚合、连续天数（昨天宽限）、肌群分布、动作历史、总览、周目标、热力图分档
- [x] `src/utils/backup.ts` — 备份载荷构建 / 序列化 / 解析（错误码齐全、坏记录宽容丢弃）
- [x] 这些模块**零 RN 依赖**，可被测试直接加载

## 4. 页面与交互

| 页面 | 关键能力 | 状态 |
|---|---|---|
| 首页 | 本周目标进度条、快捷入口、推荐动作、置顶模板 | ✅ |
| 动作库 | 两级筛选、收藏、搜索、自定义动作 | ✅ |
| 训练执行 | 组类型、上次参考一键填充、实时 1RM、杠铃片配重、休息计时、PR 提示 | ✅ |
| 数据面板 | 总览 / 周目标 / 容量趋势 / 训练日历 / 肌群分布 / PR 墙 | ✅ |
| 我的 | 目标与计算口径、杠铃配置、备份恢复、单位语言主题、危险区重置 | ✅ |
| 动作详情 | 动画预览、图文要领、加入训练 | ✅ |
| 模板 / 身体数据 / 热身拉伸 | 二级页 | ✅ |

- [x] 所有可点元素带 `accessibilityRole` / `accessibilityLabel`
- [x] 列表项用 `numberOfLines` + `minWidth: 0` 防文字撑破布局
- [x] 危险操作（删除、重置、覆盖导入）二次确认

## 5. 国际化

- [x] zh / en 全量；ja / es / ko / fr / ru 基础覆盖
- [x] 新增文案**必须带 `defaultValue`** —— 小语种缺键时不会露出原始 key
- [x] 禁止用 `string.slice()` 拼文案（历史上切出过半截句子）
- [ ] 新增 UI 文案后同步补 zh + en 两个文件
- [x] **i18next 缺键不抛错，会把键名原样渲染到界面上**（出现过
      `PR.BADGELABELNONE` / `pr.startHint` / `templates.templateEmptyHint` 直接显示在屏幕上）。
      因此新增文案后必须跑 `npm run check:i18n` 与 `npm run check:dynamic-keys`
- [x] 命名空间写错 = 整段文案变键名。`templates.templateEmptyHint` 就是这么来的，
      正确命名空间是 `workout.templateEmptyHint`。改文案前先用 grep 确认命名空间存在
- [x] 不要用 `t('x') || '兜底文案'` 做兜底 —— 缺键时 `t()` 返回的是**键名字符串**（truthy），
      `||` 永远不生效。要兜底就用 `t('x', { defaultValue: '...' })`

## 5b. 图标（@expo/vector-icons）

- [x] **传错图标名不报错，静默渲染成一个 `?` 方块**。踩过的坑：
      `flame`（Ionicons 叫法，MCI 里叫 `fire`）、`spine`、`leg`、`human-male-chest`、
      `text-remove-outline`、`muscle`
- [x] 权威清单 = `@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json`
- [x] 护栏：`npm run check:icons`（扫 273 处 `<Icon name>` / `icon="..."` / `icon: '...'` 引用，全部比对 glyphmap）

## 6. 测试

- [x] `npm test` — 60 条用例（sanitize / strength / analytics / backup）
- [x] runner 零新增依赖：用项目自带 `typescript` 做内存转译 + `@/` 别名解析
- [x] `npm run verify` = typecheck + test + check:i18n + check:dynamic-keys + check:icons
- [ ] 新增纯逻辑函数 → 补一条用例，尤其是边界（0 / 负数 / NaN / 空数组）
- [ ] 新增「模板串拼键」的 `t()` 调用 → 到 `scripts/check-dynamic-keys.js` 的 `DOMAINS`
      补一条取值域声明（静态扫描看不到这类调用）

## 7. 性能

- [x] 派生数据一律 `useMemo`，依赖只放最小必要字段
- [x] store 订阅用粒度化 selector，不整包订阅
- [x] 长列表 FlashList
- [x] 休息计时用 1Hz tick + 每 10 tick 墙钟校正，**不依赖 tick 精度**
- [x] AppState 回到前台立即校正计时（后台会几乎停掉 `setInterval`）

## 8. 健壮性 / 崩溃防御

- [x] 所有来自持久化的数组先 `Array.isArray` 再访问（历史数据缺字段是常态）
- [x] 索引越界返回 `null` 而不是抛异常
- [x] Modal 结构统一为「overlay → absoluteFill 遮罩 → 面板」，避免点面板穿透误关
- [x] `while` 补组逻辑带 `guard` 上限，防 store 未更新时死循环

## 9. 构建与发布

- [ ] `npm run verify` 全绿
- [ ] `npx expo prebuild --platform android`（依赖变更后必跑）
- [ ] `cd android && ./gradlew assembleRelease`
- [ ] `apksigner verify --verbose --min-sdk-version 21 app-release.apk`
- [ ] `shasum -a 256 app-release.apk`
- [ ] 真机冒烟：冷启动 → 开始训练 → 加动作 → 打钩 → 休息计时 → 结束 → 数据面板有数

## 10. 维护与演进

- [ ] 每次改数据模型先想清楚：老用户升级后会怎样？（`migrate` 覆盖了没？）
- [ ] 统计口径只允许在 `analytics.ts` 改，改完同步更新 `tests/analytics.test.ts`
- [ ] 不引入新的原生依赖 —— 备份方案刻意用纯文本，就是为了这条能一直成立
