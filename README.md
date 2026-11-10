<p align="center">
  <img src="assets/icon.png" width="128" alt="Choyeon Gym 图标"/>
</p>

<h1 align="center">Choyeon Gym</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.0-blue" alt="version"/>
  <img src="https://img.shields.io/badge/platform-Android-green" alt="platform"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license"/>
  <img src="https://img.shields.io/badge/typecheck-passing-success" alt="typecheck"/>
</p>

<p align="center">
  一款纯离线、无账号、无联网的健身动作训练应用。<br/>
  收录 <b>1,324</b> 个标准健身动作，支持按部位 / 器械筛选、收藏、动画预览与科学训练计划。
</p>

---

## 应用图标

沿用项目**原有 logo**（橙 → 珊瑚粉 → 品红紫渐变的「C」弧 + 奔跑人形），只在其外补一层 **squircle（方圆形）浅色近白底** 与细边框，并留出合适的留白。这样既保留原设计的辨识度，也解决了此前 logo 被启动器拉伸变形的问题。

<p align="center">
  <img src="assets/icon.png" width="200" alt="Choyeon Gym 应用图标"/>
</p>

- **不重绘 logo**：中央图形直接取自原有透明 PNG（`docs/screenshots/original-logo.png`），未做任何 AI 重绘。
- **Android 自适应图标**：前景为原 logo（透明底，收在 66dp 安全区内），背景为浅色层；前景/背景资源按 **108dp** 规范生成（mdpi 108 → xxxhdpi 432），避免系统二次缩放导致拉伸。
- **Play Store / 旧版 Android**：浅色圆角方阵 + 原 logo 的完整图标（512 × 512），四角透明。
- **复更方式**：`docs/screenshots/_icon3.mjs` 用浏览器 canvas 合成全部密度，保留 alpha，可直接重跑。

---

## 界面预览

以下截图均为 **Android 16 模拟器真机截图**（1080 × 1920，手势导航/小白条沉浸模式），Apple HIG 风格、真实数据、真实文案。数据面板 / 我的 等页面在无训练记录时显示为空状态，属正常表现。

底部悬浮胶囊为 **iOS 26 液态玻璃导航栏**（原生组件，见下方「iOS 26 液态玻璃」）：玻璃会实时折射身后滚动的内容，选中项是一颗可拖拽的液态水滴。

### 浅色模式

| | | |
|---|---|---|
| <img src="docs/screenshots/01-home.png" width="200" alt="首页"/> | <img src="docs/screenshots/02-library.png" width="200" alt="动作库"/> | <img src="docs/screenshots/03-workout.png" width="200" alt="训练日志"/> |
| **首页** · 今日推荐 / 周目标 / 快捷入口 | **动作库** · 1,324 动作两级筛选 | **训练日志** · 计划模板 / 历史 / 连续天数 |
| <img src="docs/screenshots/04-stats.png" width="200" alt="数据面板"/> | <img src="docs/screenshots/05-body.png" width="200" alt="身体数据"/> | <img src="docs/screenshots/06-templates.png" width="200" alt="训练模板"/> |
| **数据面板** · 容量趋势 / 日历热力图 | **身体数据** · 围度 / 体重追踪 | **训练模板** · 可复用计划 |
| <img src="docs/screenshots/07-warmup.png" width="200" alt="热身"/> | <img src="docs/screenshots/08-exercise.png" width="200" alt="动作详情"/> | <img src="docs/screenshots/09-profile.png" width="200" alt="我的"/> |
| **热身** · 动态拉伸流程 | **动作详情** · 动画 / 要点 / 变式 | **我的** · 统计 / 偏好 / 备份 |

### 深色模式

| | | |
|---|---|---|
| <img src="docs/screenshots/dark-01-home.png" width="200" alt="首页·深色"/> | <img src="docs/screenshots/dark-02-library.png" width="200" alt="动作库·深色"/> | <img src="docs/screenshots/dark-03-workout.png" width="200" alt="训练·深色"/> |
| **首页** | **动作库** | **训练日志** |
| <img src="docs/screenshots/dark-04-stats.png" width="200" alt="数据面板·深色"/> | <img src="docs/screenshots/dark-05-body.png" width="200" alt="身体数据·深色"/> | <img src="docs/screenshots/dark-06-templates.png" width="200" alt="训练模板·深色"/> |
| **数据面板** | **身体数据** | **训练模板** |
| <img src="docs/screenshots/dark-07-warmup.png" width="200" alt="热身·深色"/> | <img src="docs/screenshots/dark-08-exercise.png" width="200" alt="动作详情·深色"/> | <img src="docs/screenshots/dark-09-profile.png" width="200" alt="我的·深色"/> |
| **热身** | **动作详情** | **我的** |

> 全面屏适配：Tab 栏高度随系统手势区（小白条）动态避让，状态栏 / 导航栏沉浸透明，内容在明暗两套主题下均不被遮挡。

---

## 功能

### 动作库与详情

- **动作库** — 1,324 个动作，部位 → 身体区域、器械组 → 器械 两级筛选
- **动画预览** — 高帧率 GIF 动作演示，支持播放 / 暂停切换
- **收藏** — 任何动作可标记收藏，在动作库「我的收藏」Tab 快速访问
- **自定义动作** — 库里没有的动作可自建，与内置动作同等参与训练与统计

### 训练执行

- **组类型** — 正式组 / 热身组 / 递减组 / 力竭组 / AMRAP，逐组可切换
- **上次参考** — 每个动作显示上次训练的重量×次数，一键铺到本次所有组
- **实时 1RM** — 按所选公式（Epley / Brzycki / Lombardi / O'Conner / Wathan）实时估算
- **杠铃片配重** — 按你的杆重与实际有的片，算出每侧挂几片；配不出时明确提示最接近且不超重的解
- **休息计时** — 完成一组自动倒计时，±10 秒微调，App 切后台回来按墙钟自动校正
- **PR 自动记录** — 完成的组超过历史最高重量（或同重量更高次数）自动生成 PR 并提示

### 数据与统计

- **数据面板** — 总览、本周目标、容量趋势（30 天）、训练日历（13 周热力图）、肌群分布、PR 墙
- **口径统一** — 容量 / 连续天数 / 周目标全部走 `src/utils/analytics.ts`，首页、数据面板、设置页三处不会各算一套
- **单位** — kg / lb 可切换；内部一律以 kg 归一后再展示换算

### 设置与数据

- **每周训练目标** — 设定后首页显示达成度进度条
- **备份 / 恢复** — 导出为一段 JSON 文本（可长按复制），导入支持「合并」（按 id 去重）与「覆盖」（二次确认）
- **多语言** — 中文 / English 全量；ja / es / ko / fr / ru 基础覆盖（缺失键回退英文）
- **主题** — 深色 / 浅色 / 跟随系统

---

## 下载与安装

- **GitHub Release（推荐）**：[v1.1.0 下载页](https://github.com/Choyeon/choyeon-exercises/releases/tag/v1.1.0)
  - 安装包：`app-release-arm64-v8a.apk`（仅含 `arm64-v8a` 架构，适用于绝大多数现代 Android 手机）
  - 首次安装请在系统设置中允许「未知来源」安装；若提示签名，确认来自本仓库发布。
  - v1.1.0 起：底部导航换为**原生 iOS 26 液态玻璃**（Android 侧为 Jetpack Compose 真实折射），界面按 Apple HIG 全量重构。
- **自行构建**：见下方「构建 Release APK」。

> 定位：纯离线工具。没有商业化内容、没有账号、没有联网请求、没有社区 / 社交。所有数据只存在本机，导出与恢复也只走「一段纯文本」，不申请任何存储 / 分享权限。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React Native 0.86.3 + Expo SDK 57 |
| 路由 | Expo Router（`typedRoutes`） |
| 状态 | Zustand 5 + `persist` + AsyncStorage |
| 列表 | Shopify FlashList 2.0 |
| 图片 | expo-image |
| 动画 | react-native-reanimated 4 |
| 液态玻璃 | iOS：`expo-glass-effect`（系统 UIGlassEffect）<br/>Android：`expo-android-glass-view`（Jetpack Compose 原生折射） |
| 图表 | react-native-svg（手写柱状 / 热力图，不引图表库） |
| 国际化 | i18next + react-i18next |
| 语言 | TypeScript 6（strict） |
| 测试 | 逻辑层：自研零依赖 runner（项目自带 `typescript` 内存转译）<br/>UI 层：jest-expo + @testing-library/react-native |
| 构建 | Gradle (compileSdk 36, targetSdk 36) |

### iOS 26 液态玻璃

底部导航与卡片材质全部使用**第三方原生组件**，不手写复刻折射算法：

- **iOS 26+**：`expo-glass-effect` 的 `GlassView` —— 系统级 `UIGlassEffect`，跟随环境光、按压时形变，文字可用 `PlatformColor('labelColor')` 自动适配。
- **Android**：`expo-android-glass-view` —— Jetpack Compose 渲染，实时采样**同一窗口内 RN 画面的背后像素**作为背板，做真实折射（边缘色散、模糊、vibrancy、高光）。
  - 导航栏用其 `AndroidGlassBottomTabs`：玻璃胶囊 + **可拖拽的液态选择水滴**（iOS 26 同款交互），内容滚动时背景实时跟着变。
  - 其余玻璃面用 `AndroidGlassView`（卡片 / 搜索框等）。
  - 依赖：Android 13+（API 33）完整折射；Android 12 仅模糊 + vibrancy；更早版本退化为半透明纯色面板。

> 玻璃材质是**真实背板采样**，不是半透明遮罩——所以浅色模式下能看到卡片内容被磨砂透出，深色模式下能看见红色 / 蓝色卡片的光晕透过胶囊。


---

## 开发

### 前置要求

- Node.js ≥ 18
- JDK 17
- Android SDK 36 + Build Tools 36.0.0
- Android SDK Platform 36

### 安装与运行

```bash
git clone https://github.com/Choyeon/choyeon-exercises.git
cd choyeon-exercises
npm install

# 启动 Metro bundler
npm start

# Android（首次需先执行 npx expo prebuild）
npm run android
```

### 校验

```bash
npm run typecheck   # tsc --noEmit
npm test            # 逻辑层单测（60 条）
npm run test:ui     # UI 层渲染测试（jest-expo + RNTL）
npm run verify      # typecheck + test，提交前跑这个
```

测试分两层：

- **逻辑层**（`npm test`）—— runner 是 `scripts/ts-require.js` + `scripts/run-tests.js`：
  直接用项目自带的 `typescript` 把被测的 `.ts` 模块在内存里转译成 CommonJS 再 require，
  因此**可以直接测 TS 真身**，零额外依赖，也天然支持 `@/` 路径别名。
  新增用例只要在 `tests/` 下建一个导出 `{ name, tests: [{ name, fn }] }` 的 `.js` 文件即可。
- **UI 层**（`npm run test:ui`）—— jest-expo + @testing-library/react-native，
  覆盖 Apple 原语渲染、无障碍属性，以及一个遍历所有页面的 HIG 静态审计。

### 构建 Release APK

```bash
# 1. 生成原生项目（首次或依赖 / 资源变更后，例如更换图标）
npx expo prebuild --platform android

# 2. 配置签名（android/keystore.properties，不进版本库）
#    RELEASE_STORE_FILE=.../release.keystore
#    RELEASE_STORE_PASSWORD=...
#    RELEASE_KEY_ALIAS=...
#    RELEASE_KEY_PASSWORD=...

# 3. 构建（单架构 arm64-v8a，体积更小、构建更快）
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

构建产物：`android/app/build/outputs/apk/release/app-release.apk`

> **签名配置缺失时构建会直接失败**（而不是悄悄产出 debug 签名的包），
> 这是有意为之 —— 未签名 / 用 debug key 签的 "release" 包装到手机上才发现就晚了。
>
> **改了 JS 代码后必须先删掉旧的 JS bundle 再构建**：Gradle 增量构建不会重新打包
> `android/app/build/generated/assets/react/release/index.android.bundle`，
> 不删的话装上去还是旧代码：
> ```bash
> rm -f app/build/generated/assets/react/release/index.android.bundle
> ```

> **更换图标**：运行 `ego-browser nodejs < docs/screenshots/_icon3.mjs`，它会同时刷新 `assets/` 与
> `android/app/src/main/res/mipmap-*` 的全部密度（含 108dp 自适应前景/背景），随后直接重新构建即可。
> 不必执行 `expo prebuild`——那会重建 `android/app/build.gradle` 并覆盖本项目自定义的 release 签名配置。

## 项目结构

```
.
├── app/                    # Expo Router 页面
│   ├── (tabs)/            # 主页 / 动作库 / 训练 / 我的
│   ├── stats/             # 数据面板（栈上页面）
│   ├── body/              # 身体数据
│   ├── templates/         # 训练模板
│   ├── workout/start.tsx  # 训练执行页
│   └── exercise/[id].tsx  # 动作详情页
├── scripts/               # 工具脚本（含零依赖测试 runner）
├── tests/                 # 单元测试
├── src/
│   ├── components/        # 可复用组件
│   ├── constants/         # 部位 / 器械映射；settings.ts 为默认值唯一来源
│   ├── data/              # 数据集查询
│   ├── hooks/             # useRestTimer 等
│   ├── i18n/              # 翻译文件 (zh / en / ja / es / ko / fr / ru)
│   ├── store/             # Zustand store + sanitize（数据归一化）
│   ├── theme/             # 主题系统
│   ├── types/             # TypeScript 类型
│   └── utils/             # strength / analytics / backup / format ...
├── assets/                # 图标 / 字体 / 数据集
├── app.json               # Expo 配置（含图标与自适应图标）
├── babel.config.js
├── metro.config.js
└── package.json
```

---

## 数据与迁移约定

这几条是踩过坑后定下的硬约束，改动前请先读：

1. **持久化 key 不随 schema 版本改名。** vault key 固定为 `@choyeon/vault/v4`。
   改名会让老用户的全部历史数据静默消失——这是不可逆的事故。
   要升级 schema 请 bump `PERSIST_VERSION` 并写 `migrate`。
2. **rehydrate 后强制 `sanitizeState()`。** 历史 vault / 跨版本 merge 都可能写出
   `sets: undefined` 之类的残缺字段；所有数组字段在进入 UI 前必须归一化。
3. **默认值只有一处来源**：`src/constants/settings.ts` 的 `DEFAULT_SETTINGS` /
   `withDefaultSettings()`。store 的初始态与备份导入的补全共用它，
   否则用户换机导入后会得到两套不同的设置。
4. **逐字段 `??` 兜底**，不要写 `{ ...DEFAULT, ...partial }`——
   partial 里值为 `undefined` 的键会把默认值冲掉（JSON 序列化常见）。
5. **统计口径只允许实现在 `src/utils/analytics.ts`**，并在 `tests/analytics.test.ts`
   里锁死语义。历史上「总容量 / 连续天数」散落三处互相漂移过。
6. **纯逻辑模块零 RN 依赖**（`utils/`、`store/sanitize.ts`、`constants/settings.ts`），
   这样单测能直接加载它们，不用拉起整个 RN 运行时。

---

## 签名说明

Release APK 使用 V1 (JAR) + V2 (APK Signature Scheme v2) 双签名：

- **V1** 兼容 Android 7.0 以下及部分 OEM 安装器（腾讯移动应用引擎等）
- **V2** 提供完整性校验，Android 7.0+ 设备强制要求

构建完成后建议执行：

```bash
# 验证签名
apksigner verify --verbose --min-sdk-version 21 app-release.apk

# 计算 SHA256
shasum -a 256 app-release.apk
```

---

## 许可证

MIT © Choyeon
