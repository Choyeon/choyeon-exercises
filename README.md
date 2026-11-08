# Choyeon Exercises

基于 [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) 的动作训练应用，收录 1,324 个标准健身动作，支持按部位 / 器械筛选、收藏、动画预览与训练计划。

**定位：纯离线工具。** 没有商业化内容、没有账号、没有联网请求、没有社区/社交。所有数据只存在本机，导出与恢复也只走「一段纯文本」，不申请任何存储 / 分享权限。

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

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React Native 0.86.3 + Expo SDK 57 |
| 路由 | Expo Router（`typedRoutes`） |
| 状态 | Zustand 5 + `persist` + AsyncStorage |
| 列表 | Shopify FlashList 2.0 |
| 图片 | expo-image |
| 动画 | react-native-reanimated 4 |
| 图表 | react-native-svg（手写柱状 / 热力图，不引图表库） |
| 国际化 | i18next + react-i18next |
| 语言 | TypeScript 6（strict） |
| 测试 | 自研零依赖 runner（用项目自带 `typescript` 做内存转译） |
| 构建 | Gradle (compileSdk 36, targetSdk 36) |

## 开发

### 前置要求

- Node.js ≥ 18
- JDK 17
- Android SDK 36 + Build Tools 36.0.0
- Android SDK Platform 36

### 安装

```bash
git clone https://github.com/Choyeon/choyeon-exercises.git
cd choyeon-exercises
npm install
```

### 运行

```bash
# 启动 Metro bundler
npm start

# Android (需要先执行 npx expo prebuild)
npm run android
```

### 校验

```bash
npm run typecheck   # tsc --noEmit
npm test            # 全部单测（60 条）
npm run verify      # typecheck + test，提交前跑这个
```

单测 runner 是 `scripts/ts-require.js` + `scripts/run-tests.js`：直接用项目自带的
`typescript` 把被测的 `.ts` 模块在内存里转译成 CommonJS 再 require，
因此**可以直接测 TS 真身**，不需要额外装 `jest-expo` / `ts-jest` / `ts-node`，
也天然支持 `@/` 路径别名。新增用例只要在 `tests/` 下建一个导出
`{ name, tests: [{ name, fn }] }` 的 `.js` 文件即可。

### 构建 Release APK

```bash
# 1. 生成原生项目（首次或依赖变更后）
npx expo prebuild --platform android

# 2. 配置签名（gradle.properties）
# android.useAndroidX=true
# android.requireJetifier=false
# expo.useProguard=false
# MYAPP_RELEASE_KEYSTORE=C:/path/to/release.keystore
# MYAPP_RELEASE_KEYSTORE_PASSWORD=your_password
# MYAPP_RELEASE_KEY_ALIAS=your_alias
# MYAPP_RELEASE_KEY_PASSWORD=your_key_password

# 3. 构建
cd android
./gradlew assembleRelease
```

构建产物：`android/app/build/outputs/apk/release/app-release.apk`

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
├── app.json               # Expo 配置
├── babel.config.js
├── metro.config.js
└── package.json
```

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

## 许可证

MIT © Choyeon
