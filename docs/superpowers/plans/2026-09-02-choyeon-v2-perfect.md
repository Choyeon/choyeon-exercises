# Choyeon Exercises v2.0.0 Perfect 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Choyeon Exercises 从「可用的离线动作库 + 训练记录器」一次性升到「超优质 App 等级（Strong 4.5+/5）」。具体 5 个交付物：① UI 全组件化到业界一流 RN 组件库；② 全量 I18N（界面语言 7 语 + 动作要领 10 语补齐）；③ 功能矩阵到商业健身 App 同级（训练计划 / Warmup&CoolDown / 组间计时 / 身体数据 / 周统计 / 营养建议 / 提醒与通知 / 导入导出）；④ 本地健身资源（12 种预置训练模板 + 70 条热身/拉伸 + 200 条营养建议百科 + PR 记录管理）写入本地 assets 与 store；⑤ 构建质量门（tsc strict / a11y / 动画帧 / 离线完整性 / APK 签名可复现）全部绿灯后输出 v2.0.0 APK 到 `C:\ChoyeonExercises\v2.0.0\`。

**Architecture:** 分层= ① `src/components/ui/*` 作为 UI 原子层（基于 gluestack-ui v2 Expo 兼容适配器 → 暴露统一 UIKit tokens）② `src/theme/` 设计 tokens 与 gluestack config 双向绑定 ③ `src/features/*` 按 feature-sliced 拆 13 个模块（home/library/workout-session/workout-timer/workout-history/stats/body-profile/warmup/nutrition/notifications/profile/i18n/import-export）④ `src/data/` 资源资产（exercises+plans+warmups+nutrition 全部离线 JSON）⑤ store=zustand persist single-vault v3 + 迁移脚本；路由=expo-router tabs + stack 扩展（新增 body/ stats/ warmup / nutrition / templates 5 个路由）。

**Tech Stack:** Expo Router v57 · React Native 0.86 · TypeScript 6 strict · **gluestack-ui v2** (业界一流 RN 组件库：100+ prebuilt、Expo 兼容、a11y tokens) · react-native-reanimated 4 · zustand v5 · react-i18next · expo-notifications（提醒）· expo-sharing（分享训练记录）· expo-file-system（导入导出）· expo-haptics · expo-image · Shopify FlashList。

---

## 现状盘点（执行前基线）

| 维度 | 已完成 v1.0.12 | 缺失（v2.0.0 要补齐） |
|---|---|---|
| UI 组件库 | 手写 UIKit：Icon / PressableScale / SectionHeader / SlabDivider / SearchBar / EmptyState / MiniTag / HybridImage / OptionPicker（8 个原子） | **缺 19 个**：Toast / Snackbar / AlertDialog / BottomSheet / Progress / ProgressRing / Skeleton / Switch / Checkbox / RadioGroup / Slider / Stepper / Accordion / SegmentedControl / Tabs (swipeable) / Avatar / Badge / Tooltip / Haptic Button |
| 动画系统 | 仅 Pressable 弹簧（stiffness 420） + stagger | 缺：进入动画（页面 FadeInUp / shared element）、列表交错、骨架屏 shimmer、Lottie-like 进度环、删除/添加的隐式动画 |
| I18N 界面 | zh + en（365 个 key 每语），key 语义化 | **缺 5 语**：ja / es / ko / fr / ru |
| 动作要领 | 1324 条 exercises.json 中 `instructions` 覆盖 `LanguageCode` (zh/en/es/it/tr/ru/hi/pl/ko/fr) 10 语；`instruction_steps` 10 语 | 字段缺失：难度等级 level / 分类 mechanism_type / 一级肌肉 muscle_group 对应中文别名 / 器械 category 图示 |
| 功能 | 动作浏览/搜索/筛选/收藏/训练记录组×次×重量/历史/设置/分享模板 4 个 | **缺 9 块**：组间计时(全功能 振动+通知)/Warmup&CoolDown 流程/身体数据(体重体脂身高胸围臂围…)/训练计划模板(12+可编辑)/PR 记录与进展/营养建议(100% 离线)/ 本地通知提醒 / 数据导入导出(zip/json)/ 社交分享训练卡 |
| 路由 | (tabs):home/library/workout/profile; exercise/[id]; workout/start | 缺：stats/ body-profile/ templates/ warmup/ nutrition/ onboarding(首次打开引导) |
| 存储 | zustand persist v2 vault(settings,favIds,workouts) schema=ok | 缺：v3(bodyProfileEntries,prEntries,templatePlans,nutritionLogs,reminderEntries) + migrate(v2→v3) |
| 无障碍 | 无 audit | Label/Traits/Hint 空白、动效 Reduce Motion 未支持、对比度亮模式未验证 |
| 质量门 | 仅 tsc --noEmit (非 strict) exit 0 | 缺：tsconfig strict=true、eslint、a11y audit、metro bundle size、gradle lintVitalRelease、perf 60fps (FlashList) 验证 |

---

## 执行路线（9 个里程碑）

1. **M1 UI 组件系统落地**（gluestack-ui 集成 + 27 原子组件就位 + 统一 tokens 与 neo 设计桥接）
2. **M2 路由 & 动画框架**（新增 5 个路由页面骨架 + 进入/退出/交错动画骨架）
3. **M3 I18N 7 语全量**（ja/es/ko/fr/ru 365 keys 手译校验 + 界面 RTL 占位）
4. **M4 本地健身资源增强**（12 种训练计划/70 条热身拉伸/200 条营养/PR 定义 → 本地 JSON + assets）
5. **M5 功能矩阵落地**（9 块缺失功能 → feature/ 目录 + store v3 迁移）
6. **M6 动作数据字段补全**（1324 条难度/分类/肌肉中文别名/器械分类 → 离线注入）
7. **M7 UX/无障碍/质量门**（ReduceMotion / 对比度 / haptic on scroll / skeleton / Toast 全接入）
8. **M8 tsc strict + eslint + lintVital + 打包验证**（全部绿灯）
9. **M9 版本升 2.0.0 code 20 → APK 复制 C:\ChoyeonExercises\v2.0.0 → 输出 Release Checklist OK 报告**

---

## File Structure（新建/修改清单）

```
src/
├─ components/
│  ├─ ui/                                ← 新建：gluestack-ui 原子封装（19 组件）
│  │   ├─ Toast.tsx                      Snackbar
│  │   ├─ AlertDialog.tsx                语义对话框
│  │   ├─ BottomSheet.tsx                gorhom→gstack 降级方案
│  │   ├─ Progress.tsx / ProgressRing.tsx
│  │   ├─ Skeleton.tsx
│  │   ├─ Switch.tsx / Checkbox.tsx / RadioGroup.tsx / Slider.tsx / Stepper.tsx
│  │   ├─ Accordion.tsx / SegmentedControl.tsx / SwipeableTabs.tsx
│  │   ├─ Avatar.tsx / Badge.tsx / Tooltip.tsx
│  │   └─ HapticButton.tsx
│  ├─ UIKit.tsx                          ← 修改：重新 export 所有 ui/* 作为 UIKit 命名空间；保留 Icon/PressableScale/SearchBar/EmptyState 的签名不变
│  ├─ ExerciseCard.tsx                   ← 修改：使用 ui/Badge/ui/Skeleton
│  ├─ FilterChips.tsx                    ← 修改：ui/SegmentedControl 替换手写 View
│  └─ GifPlayer.tsx                      ← 修改：ui/ProgressRing 作为缓冲指示
│
├─ theme/
│  ├─ index.tsx                          ← 修改：导出 useThemeColors、gluestack-ui config 桥接 createConfig()
│  └─ gluestack.config.ts                ← 新建：neo-brutalist editorial → gluestack tokens 映射（soft 版 v1.0.12 刚交付）
│
├─ features/                             ← 新建：feature-sliced 目录
│  ├─ workout-timer/                     ← 组间休息倒计时（前台+通知+振动+可跳过）
│  ├─ warmup/                            ← 热身 & 冷身流程（5-10 分钟序列）
│  ├─ stats/                             ← 统计：周柱状图 / PR 墙 / 肌群热力图
│  ├─ body-profile/                      ← 身体数据录入（体重、体脂、臂、腿、胸围…历史曲线）
│  ├─ templates/                         ← 训练计划（12 预置 + 自建 + 编辑 + 克隆）
│  ├─ nutrition/                         ← 营养建议百科 + 日志 + TDEE/BMI 计算
│  ├─ notifications/                     ← 本地通知提醒（每天固定训练时间 / 久坐提醒）
│  ├─ import-export/                     ← 数据导出 zip / 导入 / 重置 / 跨设备迁移
│  ├─ share-card/                        ← 训练完成卡片生成 & 分享图片
│  └─ onboarding/                        ← 首次启动 3 页引导
│
├─ data/
│  ├─ exercises.json                     ← 修改：每条注入 { difficulty, category_enum, muscle_group_aliases, equipment_category, media_license } 字段
│  ├─ plans.json                         ← 新建：12 种训练模板（PPL / 全身 A/B / 初学者 / 减脂 HIIT / 力量 5x5 / 爆发力 / 恢复 / 器械最少 / 家庭徒手 …）
│  ├─ warmups.json                       ← 新建：70 条热身 + 拉伸 + foam roll 序列（按肌群分组、时长、动效链接现有 exercises.json）
│  ├─ nutrition.json                     ← 新建：200 条营养词条 + 10 饮食计划（增肌/减脂/素食/备赛…）+ 每公斤体重宏量营养素表
│  └─ pr-definitions.json                ← 新建：15 条标准 PR 定义（卧推/深蹲/硬拉/推举/引体/负重臂屈伸…）及 1RM Brzycki 公式
│
├─ i18n/
│  ├─ index.ts                           ← 修改：SUPPORTED_LANGUAGES 扩展 [zh,en,ja,es,ko,fr,ru]；resources 引入 7 语
│  └─ translations/
│     ├─ ja.ts                           ← 新建：365 keys（按 en 基准翻译，健身专业术语校对）
│     ├─ es.ts                           ← 新建：365 keys
│     ├─ ko.ts                           ← 新建：365 keys
│     ├─ fr.ts                           ← 新建：365 keys
│     └─ ru.ts                           ← 新建：365 keys
│
├─ store/
│  └─ useAppStore.ts                     ← 修改：persist→v3；新增 bodyProfile/prTemplates/nutritionLogs/reminderEntries；migrate v2→v3；
│
├─ hooks/
│  └─ useAnimatedMount.ts                ← 新建：统一 进入 FadeInUp + stagger 动画
│
└─ types/
   └─ index.ts                           ← 修改：新增 PlanTemplate / WarmupRoutine / NutritionArticle / BodyProfileEntry / PRRecord / ReminderEntry / ImportExportBundle 类型
│
app/
├─ _layout.tsx                           ← 修改：Stack 新增 7 个路由；首次启动 → onboarding
├─ (tabs)/
│  ├─ _layout.tsx                        ← 修改：gluestack UIProvider 包裹；新图标样式
│  ├─ index.tsx                          ← 修改：用 gluestack 组件替换手写 View、骨架屏加载、新推荐卡片、模板横滑、今日提醒、训练完成墙
│  ├─ library.tsx                        ← 修改：swipeable tabs、难度/level chip、accordion 筛选、骨架
│  ├─ workout.tsx                        ← 修改：模板横滑、周进度 bar chart、PR 墙、历史删除分享导出
│  └─ profile.tsx                        ← 修改：身体数据入口、数据导入导出入口、通知设置
├─ stats/index.tsx                       ← 新建：周柱状图/肌群热力图/连续天数、总容量、PR 墙
├─ body/index.tsx                        ← 新建：身体数据记录（体重/体脂/围度）曲线
├─ templates/index.tsx                   ← 新建：12 模板网格 + 自建 + 编辑 + 克隆 + 导入
├─ warmup/[id].tsx                       ← 新建：热身序列播放（动画/GIF/倒计时）
├─ nutrition/index.tsx                   ← 新建：营养词条 + TDEE 计算 + 记录
├─ onboarding/index.tsx                  ← 新建：首次启动 3 步引导（目标/体重/经验/器械可用性）
└─ exercise/[id].tsx                     ← 修改：Warmup 联动按钮、加入模板入口、难度星 badge、PR 个人记录徽章
│
android/app/src/main/assets/
├─ plans/                                ← 复制（和 exercises.json 对齐的 id）
├─ warmups/
└─ nutrition/
```

---

## M1. UI 组件系统落地（gluestack-ui v2 + 27 原子）

### Task 1A: 安装 gluestack-ui v2 Expo 依赖

- [ ] **Step 1: 写测试（安装后模块导入能成功）**

```ts
// tests/m1/gluestack-install.test.ts (使用 node assert，因为 RN 单测需要 jest-expo → 在 M8 再启用)
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
const gluestackPkg = resolve(process.cwd(), 'node_modules/@gluestack-ui/themed/package.json')
console.log('gluestack installed:', existsSync(gluestackPkg))
process.exit(existsSync(gluestackPkg) ? 0 : 1)
```

- [ ] **Step 2: 运行测试 → 预期失败**
Run: `node tests/m1/gluestack-install.test.ts`
Expected: exit 1（gluestack 还没装）

- [ ] **Step 3: 安装 gluestack-ui Expo 版本**
```bash
npx expo install @gluestack-ui/themed@^1.1.0 @gluestack-ui/overlay@latest @gluestack-ui/toast@latest react-native-svg
```

- [ ] **Step 4: 运行测试 → 预期 PASS**
Run: `node tests/m1/gluestack-install.test.ts`
Expected: exit 0

- [ ] **Step 5: 提交**
```bash
git add package.json package-lock.json
git commit -m "chore: add gluestack-ui v2 themed + svg"
```

### Task 1B: 建立 neo-brutalist → gluestack 令牌桥（colors/spacing/radius/typography 对齐当前 src/theme/index.tsx）

- [ ] **Step 1: 测试**
```ts
// tests/m1/tokens-bridge.test.ts
// 确保 gluestack config 导出的 tokens.primary500 与 theme.colors.primary 完全一致
```
（具体文件写全）

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: 新建 src/theme/gluestack.config.ts，内容长度 180 行：**

```ts
import { createConfig, createTokens, createComponents } from '@gluestack-ui/themed'
// tokens 完全来自 src/theme/index.tsx 的 colors + spacing + radius + typography
// 保持 neo editorial 的硬方正、粗字体、primary=#BAFF2E（v1.0.11~v1.0.12 已交付的嫩绿主色）
```

- [ ] **Step 4: Run → pass**

- [ ] **Step 5: 修改 app/(tabs)/_layout.tsx 外层包 `<GluestackUIProvider config={config}>` + `<OverlayProvider>` + `<ToastProvider>` + 测试 id 不冲突**

- [ ] **Step 6: commit**

### Task 1C: 新建 src/components/ui/ 下 19 个组件（每个 30-120 行）

按序：Toast / AlertDialog / BottomSheet（用 @gorhom/bottom-sheet Expo 4.x 版，如果 gluestack bottom-sheet 依赖冲突则用 gorhom 直接） / Progress / ProgressRing / Skeleton / Switch / Checkbox / RadioGroup / Slider / Stepper / Accordion / SegmentedControl / SwipeableTabs / Avatar / Badge / Tooltip / HapticButton / Snackbar。

每个：Step 1 写 props 类型测试 → Step 2 tsc 应 fail → Step 3 写组件体 → Step 4 tsc pass → Step 5 把组件加入 UIKit.tsx exports。

### Task 1D: 修改现有组件使用新原子（ExerciseCard Badge / FilterChips Segmented / GifPlayer ProgressRing / EmptyState 用 ui/Badge）

- [ ] **Step 1: tsc 运行 → fail（因为新增 imports）**

- [ ] **Step 2: 改 src/components/ExerciseCard.tsx 用 `<Badge>` 代替旧 MiniTag；改 FilterChips 用 SegmentedControl；改 GifPlayer 用 ProgressRing + Skeleton**

- [ ] **Step 3: tsc exit 0**

- [ ] **Step 4: commit feat(ui): 19 new ui/* atomic components migrated**

---

## M2. 路由 & 动画框架

### Task 2A: 新建 6 个路由空骨架页面 + Stack 注册

路由清单：`stats/index.tsx` 周统计、`body/index.tsx` 身体数据、`templates/index.tsx` 训练计划模板、`warmup/[id].tsx` 热身播放、`nutrition/index.tsx` 营养、`onboarding/index.tsx` 首次启动。

- [ ] **Step 1: 写 tests/m2/routes-exist.test.ts（fs.existsSync 检查 6 文件存在）**

- [ ] **Step 2: run → fail**

- [ ] **Step 3: 新建 6 文件；每个 render `<EmptyState />` + Stack.Screen 配置 title**

- [ ] **Step 4: 修改 app/_layout.tsx 的 Stack 新增 6 条 Route；(tabs)/_layout.tsx 首页快捷入口新增 stats 跳转 + profile 新增 body/templates/nutrition/导入导出/通知入口**

- [ ] **Step 5: run test → pass；tsc 0；commit**

### Task 2B: useAnimatedMount hook + skeleton shimmer 接入

- [ ] **Step 1: 新建 src/hooks/useAnimatedMount.ts：30 行，导出 animatedStyle 给进入容器（FadeInUp + stagger 支持传入 delay）**

- [ ] **Step 2: 首页每个 section 加 stagger 动画 + 首次打开 300ms skeleton shimmer → 再渲染**

- [ ] **Step 3: 动作库 FlashList 首 20 条 skeleton 占位**

- [ ] **Step 4: tsc 0；commit feat(ux): mount animations + skeleton loaders**

---

## M3. I18N 7 语全量

### Task 3A: ja 日语翻译（365 keys 全覆盖）

- [ ] **Step 1: 测试：tests/m3/i18n-ja-complete.test.ts — 对照 en.ts Object.keys 数 = ja.ts Object.keys 数**

- [ ] **Step 2: run → fail**

- [ ] **Step 3: 新建 src/i18n/translations/ja.ts — 每条严格按 en 语义，**健身专业术语使用日语健身界标准表记**（例：懸垂=Pullup、ベンチプレス=BenchPress、デッドリフト=Deadlift、レッグプレス=LegPress、プランク=Plank、ストレッチ=Stretch、有酸素運動=Cardio）**

- [ ] **Step 4: test pass；tsc 0**

### Task 3B: es 西班牙语

同 Task 3A，术语：Press day = Día de empuje / Deadlift = Peso muerto / Squat = Sentadilla / Bench press = Press banca。

### Task 3C: ko 韩语

同 3A。벤치프레스 / 스쿼트 / 데드리프트 / 풀업 / 플랭크。

### Task 3D: fr 法语

同 3A。Développé couché / Squat / Soulevé de terre / Traction / Planche。

### Task 3E: ru 俄语

同 3A。Жим лёжа / Присед / Становая тяга / Подтягивания / Планка。

### Task 3F: i18n/index.ts 扩语言并引入 OptionPicker 选项

- [ ] **Step 1: SUPPORTED_LANGUAGES = ['zh','en','ja','es','ko','fr','ru']**

- [ ] **Step 2: profile 新增 5 种 option 行（optionLangJa + 副标题 …）→ picker 切换后自动保存、重启保留**

- [ ] **Step 3: 所有 exercises.json 10 语 instructions UI 展示时用当前语言匹配 → fallback en**

- [ ] **Step 4: tsc 0；commit feat(i18n): 7 languages (zh/en/ja/es/ko/fr/ru)**

---

## M4. 本地健身资源增强（assets + JSON）

### Task 4A: plans.json — 12 种预置训练模板

```ts
// tests/m4/plans-schema.test.ts
export interface PlanTemplate {
  id: string;
  name: Record<LanguageCode, string>;
  description: Record<LanguageCode, string>;
  level: 'beginner' | 'intermediate' | 'advanced';
  goal: 'hypertrophy' | 'strength' | 'conditioning' | 'fat-loss' | 'maintenance' | 'mobility';
  daysPerWeek: 3 | 4 | 5 | 6;
  durationMinPerSession: 30 | 45 | 60 | 75 | 90 | 120;
  equipmentRequired: string[];
  warmupId: string;
  cooldownId: string;
  sessions: {
    day: string;
    name: Record<LanguageCode, string>;
    exerciseIds: string[];
    defaults: Record<string, { sets: number; reps: number; restSec: number; tempo?: string }>;
  }[];
}
```

12 套模板（全部 7 语 name/description/会话 name）：
1. **PPL-Push** 推日（中级 / 增肌 / 6 天 / 75 分）
2. **PPL-Pull** 拉日
3. **PPL-Legs** 腿日
4. **FullBody-A 初学者**（新手 3 天 / 45 分 / 增肌）
5. **FullBody-B 中级全身**（4 天）
6. **5×5 Strength 力量**（3 天 / 力量 / 深蹲卧推硬拉杠铃划船推举 5×5）
7. **HIIT Fat-Loss 减脂**（4 天 / 波比跳+壶铃+跳绳 40 分）
8. **HomeBodyWeight 家庭徒手**（无器械、3 天 / 增肌耐力）
9. **DumbbellOnly 只有哑铃**（4 天 / 公寓训练）
10. **PowerLiftPeak 力量举峰值周**（16 周峰值最后一周模板 — 高级）
11. **OlderAdult Mobility 中老年灵活 + 轻量**（3 天 / 30 分钟 / 维持）
12. **Athlete Explosive 爆发力训练**（4 天 / 挺举相关派生 / 箱跳 / 药球）

- [ ] **Step 1: schema 测试 → fail**

- [ ] **Step 2: 生成 src/data/plans.json 90KB（引用已存在的 exercises.json 中动作 id，不重复图片）**

- [ ] **Step 3: exercises-store.ts 新增 `listTemplates()` + `getTemplate(id)`**

- [ ] **Step 4: test → pass；tsc 0；commit feat(data): 12 workout templates offline**

### Task 4B: warmups.json — 70 条热身/激活/拉伸/泡沫轴

分 5 类：
- 通用有氧 5 分钟热身（跑步机/划船机/开合跳/高抬腿）
- 按肌群激活（胸/背/肩/髋/膝/踝/腕）
- 训练后静态拉伸序列（18 肌群 × 3 条）
- 泡沫轴放松 6 条
- 瑜伽流恢复 1 条（15 分钟）

每条存 `id / name 7 语 / steps[] 7 语 / links to existing exercise media_id（用现有图）/ durationSec`。

- [ ] **Step 1: schema 测试**

- [ ] **Step 2: 生成 src/data/warmups.json**

- [ ] **Step 3: store 新增 warmup 选择器**

- [ ] **Step 4: 新建 app/warmup/[id].tsx 实现序列播放器（倒计时+下一动作按钮+振动）**

### Task 4C: nutrition.json — 200 条营养词条 + 10 饮食计划

200 词条（蛋白质/碳水/脂肪/宏量营养素比例 / 补剂：肌酸、咖啡因、乳清蛋白、肌醇、鱼油 / 常见食物热量表 top100 / 断食 16:8 / 水分摄入推荐）
10 饮食计划（增肌 40/40/20 / 减脂 40/30/30 / 素食增肌 / 低碳生酮 / 地中海 / 备赛 12 周 / 维持 / 马拉松碳水负荷 / 青少年健身 / 中老年肌肉保持）
7 语翻译（词条名+摘要）。

- [ ] **Step 1: schema**

- [ ] **Step 2: 生成 src/data/nutrition.json**

- [ ] **Step 3: store 新增 nutritionLogs**

### Task 4D: pr-definitions.json — 15 条标准 PR + 1RM Brzycki 计算

```ts
interface PRDefinition { id: string; name 7 语; exerciseId: string | null; mode: 'repmax' | 'distance' | 'time'; defaultReps?: number }
```
卧推 / 深蹲 / 硬拉 / 军事推举 / 引体向上（负重或自重复数）/ 双杠臂屈伸（负重）/ 杠铃划船 / 前蹲 / 挺举 / 抓举 / 农夫行走 40m / 平板支撑时间 / 500m 划船 / 1RM Bench / 1RM Squat。
公式：`1RM = weight × (36 / (37 - reps))`（Brzycki），实现 `calculateOneRM(w,reps)` / `estimateMaxes(1RM)` 给出 1-12RM 表。

---

## M5. 功能矩阵落地（9 块缺失 → features/）

### Task 5A: 组间休息倒计时 Timer（workout-timer）
特性：完成一组后自动触发（受 settings.autoRest 控制）；可配置秒数 +10s/-10s 调整；振动（expo-haptics NotificationSuccess）；前台通知 + 后台通知（expo-notifications）；全屏计时器页 + 迷你条；支持 skip；支持“下一组动作名字”预览；声音（系统默认提示音 / 可选自定义）。

### Task 5B: Warmup & CoolDown 流程（warmup feature）
训练开始前推荐 warmup；训练完成后推荐 cool down；均可选跳过；每个动作序列播放 + 倒计时 + 振动。

### Task 5C: 身体数据（body-profile）
字段：记录日期、体重 kg/lb、体脂%（阻抗或目测）、BMI、胸围、腰围、臀围、上臂围（左/右）、大腿围（左/右）、小腿围、颈围、照片占位（不保存图，仅说明）；每条可编辑；图表（按周平滑曲线，用纯 SVG 画，不引图表库，减小包体）。

### Task 5D: 训练计划模板（templates）
展示 12 预置 + 用户自建（可从历史训练中 clone 模板）；编辑模板增删动作；调整默认重量×次数×休息；分享模板 JSON。

### Task 5E: PR 墙（stats 子模块）
15 条标准 PR 记录；自动从训练历史推断 PR（重量×次计算 1RM）；手动录入；每次训练完成自动“祝贺” Toast；显示 PR 时间线（第 1 次 / 最近一次 / 差值 kg）。

### Task 5F: 营养（nutrition）
词条字典搜索；TDEE/BMI 计算器；每日宏量目标（蛋白质 1.6-2.2g/kg 体重 …）；营养日志记录（按天）；进度对比。

### Task 5G: 本地通知提醒（notifications）
expo-notifications requestPermissions 首次；3 种提醒：a) 每日固定训练时间提醒；b) 久坐提醒（每 60 分钟活动 3 分钟）；c) 训练完成 n 小时后蛋白质补充提醒；开关在 profile 通知设置。

### Task 5H: 数据导入导出（import-export）
导出：所有 vault v3 数据（settings/workouts/favs/body/pr/nutrition/reminders）JSON + zip 到 Documents 目录（expo-file-system + expo-sharing shareAsync）；导入：选 zip 后提示冲突（保留/覆盖/合并）；自动版本迁移。

### Task 5I: 训练完成分享卡（share-card）
训练完成页生成一张 SVG 卡片（neo-brutalist editorial 风格：连续天数、总容量、PR 达成、动作数、日期）→ 转 PNG → expo-sharing 分享到微信/Line/Telegram/…。

---

## M6. exercises.json 字段补全

### Task 6A: 1324 条动作批量注入字段
新增字段（不覆盖原字段）：
```
difficulty: 'beginner'|'intermediate'|'advanced' （根据 equipment + 复合度自动推断：杠铃复合=advanced，器械孤立=intermediate，自重基础=beginner）
category_enum: 'compound'|'isolation'|'cardio'|'mobility' （body_part='cardio' 直接 cardio；secondary_muscles.length >= 2 且 equipment=barbell/dumbbell/ 则 compound；否则 isolation；若有 stretch 关键字 mobility）
muscle_group_aliases: Record<LanguageCode, string>
equipment_category: 'bodyweight'|'barbell'|'dumbbell'|'cable'|'machine'|'kettlebell'|'band'|'smith'|'ez-bar'|'olympic'|'other'
```
- [ ] **Step 1: 写 tests/m6/exercises-schema.test.ts — 100% 有 difficulty/category_enum**

- [ ] **Step 2: 编写 Node 脚本 src/scripts/patch-exercise-fields.mjs 200 行，遍历 exercises.json，映射规则批量写入**

- [ ] **Step 3: 执行 → 写回**

- [ ] **Step 4: 运行 test → 通过**

### Task 6B: 动作库页接入新字段
library 筛选新增“难度” 3 chips；Tab 4 个 chips 全部 Accordion 折叠；Muscle group 中文别名显示在筛选区标题下方。

### Task 6C: 动作详情页
难度星 Badge（3 级 → 1/2/3 星）；分类 chip compound/isolation/cardio；器械分类 icon；PR 徽章（若存在历史 → 显示“个人记录: 80kg x 5”）；Warmup 按钮。

---

## M7. UX/无障碍/动画帧

### Task 7A: Reduce Motion 系统偏好尊重
所有 stagger/spring 动画在 RN Appearance reduceMotion 时直接禁用（立即显示不做插值）。

### Task 7A2: 对比度/亮主题全面回归
v1.0.12 柔化后 dark 模式 OK；light 模式逐页检查（home/library/workout/profile/exercise）对比度 AA 标准（文字≥4.5:1，大字≥3:1）。不合格项用 chroma.js 调 stroke/textSecondary。

### Task 7B: 无障碍 accessibilityLabel 审计
每个 Pressable/按钮都加 `accessibilityLabel` + `accessibilityRole`；图片加 alt；Tab 加 accessibilityState selected。

### Task 7C: Haptic 滚动反馈 / 动画帧 < 16ms
FlashList 滚动手柄；筛选 Accordion 展开折叠 300ms；Toast 出现 240ms。

---

## M8. 质量门

### Task 8A: tsconfig strict
```jsoncompilerOptions.strict:true; noUncheckedIndexedAccess:true; exactOptionalPropertyTypes:true
```
- [ ] **Step 1: tsc --noEmit → 0 error**（修正 98% 的 any 断言；保留必要的 as any 写 // @ts-expect-error 理由注释）

### Task 8B: eslint（airbnb/rn/ts）+ 修复
```bash
npx expo lint 若未装 → npx expo install eslint eslint-config-expo
```

### Task 8C: gradle lintVitalRelease 无 error
v1.0.12 已 exit 0；保持无新增 issues。

### Task 8D: Metro bundle 尺寸审计
```bash
npx react-native bundle --platform android --dev false --entry-file node_modules/expo-router/entry --bundle-output /tmp/bundle.js --assets-dest /tmp/assets
ls -lh /tmp/bundle.js
```
目标：< 2.5MB (gzip < 700KB)。超了 → tree-shake gluestack 只引用到的组件。

---

## M9. 发布 v2.0.0

### Task 9A: 升级版本号
- package.json: `"version":"2.0.0"`
- app.json: `"version":"2.0.0"`
- android/app/build.gradle: `versionCode 20; versionName "2.0.0"`

### Task 9B: 生产就绪审查 Checklist
按 `production-readiness-review` specialist 输出：
✅ 构建可复现（gradle wrapper 锁定版本、lockfile 2 级）
✅ 崩溃归因（Expo 默认）
✅ 存储迁移（vault v2→v3 migrate 脚本覆盖）
✅ 离线完整性（1324×图 + 所有资源打包 assets）
✅ 无障碍 basic
✅ I18N 7 语无硬编码 CJK

### Task 9C: 构建 & 复制
```bash
cd android ; .\gradlew.bat assembleRelease
# 复制
C:\ChoyeonExercises\v2.0.0\ChoyeonExercises-v2.0.0-release.apk
```

### Task 9D: 产出 release notes 7 语（根目录 RELEASE_NOTES_v2.0.0.{zh,en,ja,es,ko,fr,ru}.md）

---

## 总任务统计
| 任务 | 子步骤数 | 预计耗时（分钟） |
|---|---|---|
| M1 gluestack 集成 + 19 组件 | 105 | 240 |
| M2 路由 + 动画 | 18 | 60 |
| M3 7 语 I18N | 35 | 180 |
| M4 资源（plans/warmups/nutrition/pr） | 28 | 150 |
| M5 9 功能 | 72 | 540 |
| M6 exercises 字段 + UI 接入 | 12 | 90 |
| M7 a11y/ux/动画 | 15 | 60 |
| M8 质量门 | 12 | 40 |
| M9 发布 | 7 | 30 |
| **合计** | **304** | **~23h** |

---

## 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| gluestack-ui v2 Expo Router 57 不兼容（报错） | ⚠️ M | 回退到 RNUILib 7.9（完全 Expo 兼容、无需原生）；19 组件 1:1 重写 |
| i18n 5 语翻译术语错漏导致用户困惑 | ⚠️ L | 每语都用 fitness 专业术语词典 + 术语表放在 `docs/superpowers/plans/appendix/fitness-terminology.csv`；人工 spot check 每语 20 键 |
| exercises.json 1324 条字段注入导致 schema 错位 | ⚠️ M | 写入前用 zod 校验 ExerciseV2 schema；失败回滚 |
| 组间休息倒计时后台运行不准（RN 后台） | ⚠️ L | 用 Date.now() 差值 + expo-notifications 本地定时触发前台倒计时仅作显示 |
| Metro bundle > 2.5MB 导致首屏慢 | ⚠️ M | gluestack-ui 单个组件 import 不引整个 themed；用 metro 的 lazyImport |
