import type { LanguageCode, BodyPart } from '@/types';
import { Platform } from 'react-native';

// ============================================================================
// LOCAL-BUNDLE MEDIA RESOLVER
// ============================================================================
// All 1,324 JPG posters + 1,324 animated GIFs from the public dataset
// (D:\WebProjects\exercises-dataset) are COPIED VERBATIM into
//   android/app/src/main/assets/exercises/{images,videos}/
// at build time, so they ship inside the APK (~131 MB) and are accessed
// directly through Android's AssetManager.  There is ZERO network I/O.
//
// • URL scheme used:   file:///android_asset/exercises/<relativePath>
//     — Glide (expo-image's native Android loader) has a built-in
//       AndroidAssetUriLoader that decodes this scheme directly from the
//       APK, no file-system extraction needed.
//     — React Native's vanilla <Image> also supports it.
//
// • Dev-mode note: In Metro dev-server builds the asset is NOT present in
//   the on-device APK bundle so the URI fails to resolve.  That is expected
//   because <HybridImage> in UIKit falls back to the muscle-tint
//   <LocalImageCover> on any load error — the UI stays 100% usable during
//   development.  Only the release (or debug .apk) build ships the media.
//
// • If ever running on iOS / web: the Platform.select branches below return
//   '' (safe empty path) so the placeholder fallback chain kicks in again
//   — no crash, no broken images.
// ============================================================================

/**
 * Absolute base-URI for media bundled inside the Android APK `assets/exercises/`
 * subfolder.  On non-Android platforms (iOS / web / Expo Go / Windows) this
 * is '' and the UI falls back to tinted placeholders automatically.
 */
export const MEDIA_CDN_BASE: string = Platform.select({
  android: 'file:///android_asset/exercises/',
  default: '',
}) as string;

/**
 * Returns the LOCAL android_asset URI for a poster JPG, or '' on non-Android.
 *
 * @param relativePath e.g. "images/0001-2gPfomN.jpg"  (same key as exercises.json)
 */
export const getImageUrl = (relativePath: string): string => {
  if (!relativePath) return '';
  if (Platform.OS !== 'android') return '';
  // Normalise: strip a leading "./" or "/" just in case dataset drifts.
  const clean = relativePath.replace(/^\.?\//, '');
  return MEDIA_CDN_BASE + clean;
};

/**
 * Returns the LOCAL android_asset URI for an animated GIF, or '' on non-Android.
 *
 * @param relativePath e.g. "videos/0001-2gPfomN.gif"
 */
export const getGifUrl = (relativePath: string): string => {
  if (!relativePath) return '';
  if (Platform.OS !== 'android') return '';
  const clean = relativePath.replace(/^\.?\//, '');
  return MEDIA_CDN_BASE + clean;
};

export const DEFAULT_LANGUAGE: LanguageCode = 'zh';

export const STORAGE_KEYS = {
  WORKOUTS: '@choyeon/workouts',
  SETTINGS: '@choyeon/settings',
  FAVORITES: '@choyeon/favorites',
};

// ============================================================================
// CATEGORY META — canonical mapping aligned with exercises-dataset README.
// Exercise counts are the official numbers from the Statistics section.
// `icon` values are MaterialCommunityIcons glyph names used through the app
// (no emoji fallbacks anywhere in the pipeline).
// ============================================================================

export interface CategoryMeta {
  zh: string;
  en: string;
  icon: string; // MaterialCommunityIcons glyph
  count?: number; // official count from README (if top-level)
  /** Brief explanation of how this category groups exercises (shown in help/tooltip). */
  note?: string;
}

// ---- BODY PARTS (10 canonical slugs from README) ----------------------------
//
// Official counts: Upper Arms 292 · Upper Legs 227 · Back 203 · Waist 169
//                  Chest 163 · Shoulders 143 · Lower Legs 59 · Lower Arms 37
//                  Cardio 29 · Neck 2
export const BODY_PART_LABELS: Record<BodyPart, CategoryMeta> = {
  back: {
    zh: '背部',
    en: 'Back',
    icon: 'arm-flex-outline',
    count: 203,
    note: '涵盖背阔肌、斜方肌、菱形肌、竖脊肌等背部肌群的水平/垂直拉类动作。',
  },
  cardio: {
    zh: '有氧',
    en: 'Cardio',
    icon: 'run-fast',
    count: 29,
    note: '以提升心肺耐力为目标的跑步、骑行、划船、跳绳等有氧训练。',
  },
  chest: {
    zh: '胸部',
    en: 'Chest',
    icon: 'weight-lifter',
    count: 163,
    note: '针对胸大肌的推、飞、夹胸类动作，涵盖平卧/上斜/下斜角度。',
  },
  'lower arms': {
    zh: '前臂',
    en: 'Forearms',
    icon: 'hand-front-left',
    count: 37,
    note: '腕屈伸、腕卷曲、 farmer carry 等针对前臂屈肌/伸肌/握力的训练。',
  },
  'lower legs': {
    zh: '小腿',
    en: 'Calves',
    icon: 'shoe-print',
    count: 59,
    note: '站姿/坐姿提踵、跳跃类动作，训练腓肠肌与比目鱼肌。',
  },
  neck: {
    zh: '颈部',
    en: 'Neck',
    icon: 'account-cowboy-hat-outline',
    count: 2,
    note: '针对胸锁乳突肌与斜方肌上部的颈屈伸与颈部强化动作。',
  },
  shoulders: {
    zh: '肩部',
    en: 'Shoulders',
    icon: 'human-handsup',
    count: 143,
    note: '推举、侧平举、前平举、反向飞鸟，覆盖三角肌前/中/后三束。',
  },
  'upper arms': {
    zh: '上臂',
    en: 'Upper Arms',
    icon: 'dumbbell',
    count: 292,
    note: '肱二头肌弯举类 + 肱三头肌屈伸类动作，是整个数据集最大的分类。',
  },
  'upper legs': {
    zh: '大腿',
    en: 'Upper Legs',
    icon: 'human-male-board-poll',
    count: 227,
    note: '深蹲、硬拉、箭步蹲、腿举、腿屈伸/腿弯举，覆盖股四头、膕绳、臀肌。',
  },
  waist: {
    zh: '核心',
    en: 'Waist (Core)',
    icon: 'weight-lifter',
    count: 169,
    note: '卷腹、平板支撑、俄罗斯转体、健腹轮等腹横肌/腹直肌/腹斜肌训练。',
  },
};

// ---- EQUIPMENT (canonical slugs from README + cardio types seen in JSON) -----
//
// Official counts: Body Weight 325 · Dumbbell 294 · Cable 157 · Barbell 154
//                  Leverage Machine 81 · Band 54 · Smith Machine 48 · Kettlebell 41
//                  Weighted 36 · Stability Ball 28 · EZ Barbell 23 · Other 83
//
// NOTE: The dataset uses "band" as the slug for resistance-band exercises,
// NOT "resistance band". Keep "resistance band" as alias mapped to same icon
// so old data / search terms still resolve visually.
export const EQUIPMENT_LABELS: Record<string, CategoryMeta> = {
  // --- Canonical (README top-12) set ---
  'body weight': {
    zh: '自重',
    en: 'Body Weight',
    icon: 'human-greeting-proximity',
    count: 325,
    note: '仅依靠自身重量完成，无需器械。占数据集约 25%，适合家庭训练。',
  },
  dumbbell: {
    zh: '哑铃',
    en: 'Dumbbell',
    icon: 'dumbbell',
    count: 294,
    note: '单手独立重量器械，支持单侧训练与更大活动度。',
  },
  cable: {
    zh: '绳索机',
    en: 'Cable',
    icon: 'link-variant',
    count: 157,
    note: '通过滑轮与配重提供持续张力，适合顶峰收缩与多角度动作。',
  },
  barbell: {
    zh: '杠铃',
    en: 'Barbell',
    icon: 'dumbbell',
    count: 154,
    note: '双侧平衡长杆，深蹲/卧推/硬拉三大项的标准器械。',
  },
  'leverage machine': {
    zh: '杠杆器械',
    en: 'Leverage Machine',
    icon: 'cog-transfer-outline',
    count: 81,
    note: '带固定轨迹的杠杆类力量器械，通常在商用健身房中出现。',
  },
  band: {
    zh: '弹力带',
    en: 'Band',
    icon: 'tape-measure',
    count: 54,
    note: '弹性阻力带，曲线阻力随伸长变大，适合热身与康复。',
  },
  'smith machine': {
    zh: '史密斯机',
    en: 'Smith Machine',
    icon: 'arrow-up-down-bold-outline',
    count: 48,
    note: '带固定垂直轨道的杠铃架，可独立进行深蹲/卧推等复合动作。',
  },
  kettlebell: {
    zh: '壶铃',
    en: 'Kettlebell',
    icon: 'kettlebell',
    count: 41,
    note: '重心偏移的壶形器械，常用于摇摆、抓举与爆发力训练。',
  },
  weighted: {
    zh: '负重附加',
    en: 'Weighted',
    icon: 'weight-kilogram',
    count: 36,
    note: '在自重动作基础上额外负重（负重背心、腰带挂片等）。',
  },
  'stability ball': {
    zh: '瑜伽球',
    en: 'Stability Ball',
    icon: 'circle-outline',
    count: 28,
    note: '瑞士球 / 健身球，不稳定平面强化核心与平衡能力。',
  },
  'ez barbell': {
    zh: 'EZ 曲杆',
    en: 'EZ Barbell',
    icon: 'trending-up',
    count: 23,
    note: '带弧度的短曲杆，用于降低腕关节压力的二头弯举与臂屈伸。',
  },

  // --- Dataset-specific slugs present in exercises.json but absent from README top-12 ---
  assisted: {
    zh: '辅助器械',
    en: 'Assisted',
    icon: 'hand-heart',
    note: '引体/双杠臂屈伸等自身体重动作的反助力辅助器械。',
  },
  'sled machine': {
    zh: '雪橇机',
    en: 'Sled Machine',
    icon: 'truck-outline',
    note: '带轮子的负重雪橇，常用于高强度推/拉训练与爆发力训练。',
  },
  roller: {
    zh: '健腹轮',
    en: 'Ab Roller',
    icon: 'circle',
    note: '单轮/双轮健腹轮，训练核心抗伸展能力。',
  },
  'wheel roller': {
    zh: '大滚轮',
    en: 'Wheel Roller',
    icon: 'circle-outline',
    note: '大尺寸滚轮，用于核心与肩带训练。',
  },
  'bosu ball': {
    zh: '波速球',
    en: 'Bosu Ball',
    icon: 'circle-double',
    note: '半球形不稳定平台，强化核心与平衡能力。',
  },
  'skierg machine': {
    zh: '划船测功仪',
    en: 'SkiErg',
    icon: 'ski',
    note: 'Concept2 SkiErg 模拟滑雪动作的上半身有氧器械。',
  },
  'upper body ergometer': {
    zh: '上肢功率车',
    en: 'Upper Body Ergometer',
    icon: 'bike',
    note: '坐姿手摇功率车，提供上半身有氧训练。',
  },
  'trap bar': {
    zh: '六角杆',
    en: 'Trap Bar',
    icon: 'hexagon',
    note: '六边形杠铃杆，常用于 Trap Bar Deadlift。',
  },
  'stepmill machine': {
    zh: '台阶机',
    en: 'StepMill',
    icon: 'stairs',
    note: '旋转台阶式有氧器械，模拟爬楼梯。',
  },

  other: {
    zh: '其他器械',
    en: 'Other',
    icon: 'dots-horizontal-circle-outline',
    count: 83,
    note: '无法归入标准分类或稀有器械（沙袋、雪橇、地雷管等）。',
  },

  // --- Alias: exercises.json also writes "resistance band" for a small subset.
  //     Map to identical semantics as plain "band" so icons stay consistent.
  'resistance band': {
    zh: '弹力带',
    en: 'Resistance Band',
    icon: 'tape-measure',
    note: '弹性阻力带（同 band 分类），数据集历史别名。',
  },

  // --- Cardio / auxiliary types that appear inside exercises.json ------------
  machine: { zh: '综合器械', en: 'Machine', icon: 'cog' },
  'elliptical machine': { zh: '椭圆机', en: 'Elliptical', icon: 'bike' },
  'stationary bike': { zh: '动感单车', en: 'Stationary Bike', icon: 'bike' },
  treadmill: { zh: '跑步机', en: 'Treadmill', icon: 'run-fast' },
  stairmaster: { zh: '登山机', en: 'Stairmaster', icon: 'stairs' },
  'medicine ball': { zh: '药球', en: 'Medicine Ball', icon: 'basketball' },
  'exercise ball': { zh: '瑜伽球', en: 'Exercise Ball', icon: 'circle-outline' },
  foam: { zh: '泡沫轴', en: 'Foam Roller', icon: 'rectangle-outline' },
  rope: { zh: '跳绳', en: 'Jump Rope', icon: 'arrow-horizontal-lock' },
  'olympic barbell': { zh: '奥杆', en: 'Olympic Barbell', icon: 'dumbbell' },
  hammer: { zh: '锤式', en: 'Hammer', icon: 'hammer' },
  tire: { zh: '轮胎', en: 'Tire', icon: 'tire' },
};

// ============================================================================
// CATEGORY-BASED EXERCISE HINTS
// Short explanation of what exercises in each category generally look like,
// rendered on section headers / info panels so the user learns "what counts
// as what".  Wording mirrors the dataset's README & browser semantics.
// ============================================================================

export const BODY_PART_NOTES: Record<BodyPart, string> = {
  back: '以「拉」为主的水平拉（划船）与垂直拉（引体/高位下拉），关注肩胛内收与脊柱中立。',
  cardio: '持续心律在最大心律 60%~85% 区间，时长 >15 分钟的训练形式。',
  chest: '以「推」为主，含平卧/上斜/下斜的卧推、飞鸟类，强调肘关节与躯干夹角。',
  'lower arms': '腕关节的屈伸与旋转，直接影响握力与大重量动作中的前臂耐力。',
  'lower legs': '踝关节跖屈/背屈类动作，腓肠肌注重爆发力，比目鱼肌注重静力耐力。',
  neck: '颈屈伸、颈侧屈与轻量抗阻训练，注意循序渐进避免颈部损伤。',
  shoulders: '推举（竖直面）+ 平举（水平面）动作，三角肌三束分别对应推、侧、后。',
  'upper arms': '肘部运动为主：肱二头肌「弯举」类（肘屈）+ 肱三头肌「屈伸」类（肘伸）。',
  'upper legs': '膝主导（股四头）、髋主导（膕绳/臀）、单腿稳定三类动作构成大腿训练主体。',
  waist: '躯干抗伸展、抗旋转、屈曲三类，平板与卷腹分别代表等长与动态两种训练逻辑。',
};

export const EQUIPMENT_USAGE_HINTS: Record<string, string> = {
  cable: '绳索机持续张力特性尤其适合肌肉顶峰收缩，训练中保持绳索不晃动。',
  'leverage machine': '杠杆器械固定轨迹适合新学员建立动作模式，注意不要过度依赖。',
  'smith machine': '史密斯轨道减少核心稳定需求，适合孤立训练或单人安全大重量。',
  'stability ball': '保持球上动作缓慢，注意核心预收紧，避免腰椎代偿。',
  band: '弹力带阻力随伸长递增，注意在动作末端控制离心阶段不回弹。',
  'ez barbell': 'EZ 杆有效降低腕部压力，适合弯举与窄距臂屈伸中的肘部健康。',
  kettlebell: '壶铃摇摆属于髋铰链模式，核心发力而非手臂，先掌握髋铰链再加重。',
  weighted: '附加负重需以动作质量优先，不要牺牲活动范围换取重量数字。',
};

// ============================================================================
// LANGUAGE UI LABELS (no flags/emoji — flag icons are emojis too).
// ============================================================================

export const LANGUAGE_LABELS: Record<
  LanguageCode,
  { zh: string; native: string; code: string; icon: string }
> = {
  zh: { zh: '简体中文', native: '中文', code: '简', icon: 'google-translate' },
  en: { zh: '英语', native: 'English', code: 'EN', icon: 'alphabet-latin' },
  es: { zh: '西班牙语', native: 'Español', code: 'ES', icon: 'alpha-e-circle-outline' },
  it: { zh: '意大利语', native: 'Italiano', code: 'IT', icon: 'alpha-i-circle-outline' },
  tr: { zh: '土耳其语', native: 'Türkçe', code: 'TR', icon: 'alpha-t-circle-outline' },
  ru: { zh: '俄语', native: 'Русский', code: 'RU', icon: 'alpha-r-circle-outline' },
  hi: { zh: '印地语', native: 'हिन्दी', code: 'HI', icon: 'alpha-h-circle-outline' },
  pl: { zh: '波兰语', native: 'Polski', code: 'PL', icon: 'alpha-p-circle-outline' },
  ko: { zh: '韩语', native: '한국어', code: '한', icon: 'alpha-k-circle-outline' },
  fr: { zh: '法语', native: 'Français', code: 'FR', icon: 'alpha-f-circle-outline' },
  ja: { zh: '日语', native: '日本語', code: '日', icon: 'alpha-j-circle-outline' },
};

// ============================================================================
// ICON LOOKUP HELPERS
// ============================================================================

export function iconForBodyPart(bp: BodyPart | string | null | undefined): string {
  if (!bp) return 'help-circle-outline';
  return BODY_PART_LABELS[bp as BodyPart]?.icon || 'help-circle-outline';
}

export function labelForBodyPart(bp: BodyPart | string | null | undefined, lang?: LanguageCode): string {
  if (!bp) return '未知';
  const meta = BODY_PART_LABELS[bp as BodyPart];
  if (!meta) return String(bp);
  return lang === 'en' ? meta.en : meta.zh;
}

export function iconForEquipment(eq: string | null | undefined): string {
  if (!eq) return 'help-circle-outline';
  return EQUIPMENT_LABELS[eq]?.icon || 'dumbbell';
}

// ============================================================================
// MUSCLE ALIAS — en abbreviation → zh full label.
// Covers the free-form strings that appear in exercises-dataset `target`
// and `secondary_muscles` fields (not controlled body-part slugs).
// ============================================================================
const MUSCLE_ALIAS_ZH: Record<string, string> = {
  // ===== Core =====
  abs: '腹直肌', rectusabdominis: '腹直肌', abdominals: '腹部', abdominis: '腹部',
  obliques: '腹外斜肌', externalobliques: '腹外斜肌', obliquesexternus: '腹外斜肌', obliquusexternus: '腹外斜肌', externaloblique: '腹外斜肌',
  obliquesinternus: '腹内斜肌', obliquusinternus: '腹内斜肌', internaloblique: '腹内斜肌',
  transverseabdominis: '腹横肌', transversusabdominis: '腹横肌', tva: '腹横肌',
  core: '核心', coremuscles: '核心肌群',
  stabilizers: '稳定肌',
  diaphragm: '膈肌', intercostals: '肋间肌',
  multifidus: '多裂肌', lumbarmultifidus: '腰部多裂肌',
  quadratuslumborum: '腰方肌', ql: '腰方肌', quadratus_lumborum: '腰方肌',
  // ===== Chest =====
  pecs: '胸大肌', pectorals: '胸大肌', pectoralismajor: '胸大肌', pectoralis_minor: '胸小肌', pectoralisminor: '胸小肌', pectoralisminorus: '胸小肌', chest: '胸部', chestmuscles: '胸部肌群',
  upperchest: '上胸', lowerchest: '下胸', innerchest: '中胸',
  // ===== Back =====
  lats: '背阔肌', latissimusdorsi: '背阔肌', latsdorsi: '背阔肌',
  trapezius: '斜方肌', traps: '斜方肌', trap: '斜方肌', uppertraps: '上斜方肌', trapeziusmiddle: '中斜方肌', trapeziusmid: '中斜方肌', midtraps: '中斜方肌', middletraps: '中斜方肌', trapeziuslower: '下斜方肌', lowertraps: '下斜方肌', lowtraps: '下斜方肌', trapeziusmuscle: '斜方肌',
  rhomboids: '菱形肌', rhomboidsmajor: '大菱形肌', rhomboidsminor: '小菱形肌', rhomboid: '菱形肌',
  serratusanterior: '前锯肌', serratus: '前锯肌',
  levatorscapulae: '肩胛提肌', levatorscapula: '肩胛提肌',
  erectorspinae: '竖脊肌', erectors: '竖脊肌', spinalerectors: '竖脊肌', erectorspinae_group: '竖脊肌', sacrospinalis: '竖脊肌',
  teresmajor: '大圆肌', teresminor: '小圆肌', teres_minor: '小圆肌',
  infraspinatus: '冈下肌', infraspinous: '冈下肌',
  supraspinatus: '冈上肌', supraspinous: '冈上肌',
  subscapularis: '肩胛下肌',
  rotatorcuff: '肩袖肌群', rotatorcuffs: '肩袖肌群',
  low: '下背', lowerback: '下背部', lumbars: '下背', lumbar: '腰部', lumbarspine: '腰椎', lowerbackmuscles: '下背部',
  upperback: '上背部', midback: '中背部',
  backmuscles: '背部肌群', backmuscle: '背部肌群',
  shouldergirdle: '肩胛带',
  scapularstabilizers: '肩胛稳定肌', scapularstabiliser: '肩胛稳定肌',
  scapula: '肩胛骨', sternum: '胸骨', patella: '髌骨', pelvis: '骨盆',
  // ===== Shoulders =====
  delts: '三角肌', deltoids: '三角肌', deltoid: '三角肌',
  deltoidanterior: '三角肌前束', anteriordelt: '三角肌前束', frontdelt: '三角肌前束', anteriordeltoid: '三角肌前束',
  deltoidlateral: '三角肌中束', lateraldelt: '三角肌中束', sidedelt: '三角肌中束', middledelt: '三角肌中束', lateraldeltoid: '三角肌中束',
  deltoidposterior: '三角肌后束', posteriordelt: '三角肌后束', reardelt: '三角肌后束', backdelt: '三角肌后束', posteriordeltoid: '三角肌后束',
  // ===== Upper Arms =====
  tris: '肱三头肌', triceps: '肱三头肌', tricepsbrachii: '肱三头肌',
  tricepslonghead: '肱三头肌长头', longheadofthetriceps: '肱三头肌长头', triceps_long_head: '肱三头肌长头',
  tricepslateralhead: '肱三头肌外侧头', lateralheadofthetriceps: '肱三头肌外侧头', triceps_lateral_head: '肱三头肌外侧头',
  tricepsmedialhead: '肱三头肌内侧头', medialheadofthetriceps: '肱三头肌内侧头',
  bis: '肱二头肌', biceps: '肱二头肌', bicepsbrachii: '肱二头肌',
  brachialis: '肱肌', brachialismuscle: '肱肌',
  brachioradialis: '肱桡肌',
  elbowflexors: '肘屈肌', elbowextensors: '肘伸肌',
  // ===== Forearms =====
  forearms: '前臂', wristflexors: '腕屈肌', wristextensors: '腕伸肌', flexors: '屈肌', extensors: '伸肌',
  handmuscles: '手部肌群', handgrip: '握力', grip: '握力',
  // ===== Glutes / Hips =====
  glutes: '臀大肌', gluteusmaximus: '臀大肌', glutemax: '臀大肌', glut: '臀大肌', glutealmuscles: '臀部肌群',
  gluteusmedius: '臀中肌', glutemed: '臀中肌', gluteus_medius: '臀中肌',
  gluteusminimus: '臀小肌', glutemin: '臀小肌', gluteus_minimus: '臀小肌',
  piriformis: '梨状肌', piriformismuscle: '梨状肌',
  hip: '髋部', hips: '髋部', hipflexors: '髋屈肌', iliopsoas: '髂腰肌', iliopsoasmuscle: '髂腰肌', psoas: '髂腰肌',
  hipprimarymover: '髋部主动肌', gluteal: '臀部',
  // ===== Hamstrings =====
  ham: '腘绳肌', hams: '腘绳肌', hamstrings: '腘绳肌', bicepsfemoris: '股二头肌', bicepfemoris: '股二头肌', bicepsfem: '股二头肌', bicepsfemor: '股二头肌',
  semitendinosus: '半腱肌', semi_tendinosus: '半腱肌',
  semimembranosus: '半膜肌', semi_membranosus: '半膜肌',
  hamstringmuscles: '腘绳肌群',
  // ===== Quads =====
  quads: '股四头肌', quadriceps: '股四头肌', quadricepsfemoris: '股四头肌', quadricep: '股四头肌',
  vastusmedialis: '股内侧肌', vastus_medialis: '股内侧肌', vmo: '股内侧肌',
  vastuslateralis: '股外侧肌', vastus_lateralis: '股外侧肌', vl: '股外侧肌',
  vastusintermedius: '股中间肌', vastus_intermedius: '股中间肌', vi: '股中间肌',
  // ===== Adductors / Abductors =====
  adductors: '内收肌', hipadductors: '内收肌',
  adductorlongus: '长收肌', adductor_longus: '长收肌', longadductor: '长收肌',
  adductormagnus: '大收肌', adductor_magnus: '大收肌', greatadductor: '大收肌',
  adductorbrevis: '短收肌', adductor_brevis: '短收肌', shortadductor: '短收肌',
  pectineus: '耻骨肌', gracilis: '股薄肌', sartorius: '缝匠肌',
  abductors: '外展肌', hipabductors: '外展肌',
  // ===== Calves / Lower Leg =====
  calves: '小腿', calfmuscles: '小腿肌群',
  gastrocnemius: '腓肠肌',
  gastrocnemiusmedial: '腓肠肌内侧头', gastrocnemiusmedialhead: '腓肠肌内侧头', medialgastrocnemius: '腓肠肌内侧头',
  gastrocnemiuslateral: '腓肠肌外侧头', lateralheadgastrocnemius: '腓肠肌外侧头',
  soleus: '比目鱼肌',
  tibialisanterior: '胫骨前肌', tibialisant: '胫骨前肌',
  anklemuscles: '踝关节肌群',
  intrinsicfootmuscles: '足底固有肌',
  // ===== Whole-body / Compound meta =====
  fullbody: '全身肌群', wholebody: '全身肌群', totalbody: '全身肌群', entirebody: '全身肌群',
  lowerbody: '下肢', upperbody: '上肢', lowerextremity: '下肢', upperextremity: '上肢', lowerextremities: '下肢', upperextremities: '上肢',
  // ===== Cardiovascular / spine / cardio meta =====
  cardiovascularsystem: '心血管系统', cardiovascular: '心血管', system: '系统',
  cardiorespiratory: '心肺', cardiorespiratorysystem: '心肺系统',
  spine: '脊柱', spinalcolumn: '脊柱', vertebralcolumn: '脊柱',
  // ===== Neck =====
  neck: '颈部',
};

// ============================================================================
// EQUIPMENT ALIAS ZH — en free-form equipment phrase / canonical slug
// shorthand → zh label 25+ 条。仅用于中文显示。lang==en 或未命中时
// 调用 labelForEquipment 回退到 EQUIPMENT_LABELS。
// ============================================================================
export const EQUIPMENT_ALIAS_ZH: Record<string, string> = {
  barbell: '杠铃', 'bar': '杠铃', 'olympicbar': '奥杆', 'olympicbarbell': '奥杆',
  dumbbell: '哑铃', 'db': '哑铃', 'dumbbells': '哑铃', 'bell': '哑铃',
  kettlebell: '壶铃', 'kb': '壶铃', 'kettlebells': '壶铃',
  cable: '绳索机', 'cables': '绳索机', 'cablemachine': '绳索机', 'pulley': '滑轮机',
  smithmachine: '史密斯架', 'smith': '史密斯架',
  lever: '杠杆机', 'leveragemachine': '杠杆机', 'levermachine': '杠杆机',
  machine: '固定器械', 'machines': '固定器械', 'gymmachine': '综合器械',
  bodyweight: '自重', 'body': '自重', 'bw': '自重', 'bodyweightonly': '自重',
  band: '弹力带', 'bands': '弹力带', 'resistanceband': '弹力带', 'resistancebands': '弹力带', 'miniband': '迷你弹力带',
  ezcurlbar: 'EZ曲杆', 'ezbar': 'EZ曲杆', 'ezbarbell': 'EZ曲杆', 'curlbar': '曲杆',
  preachercurl: '牧师凳机', 'preacherbench': '牧师凳', 'preacher': '牧师凳',
  tbarrow: 'T杠划船', 'tbar': 'T杠', 't-bar': 'T杠',
  assisted: '辅助式', 'assistedmachine': '辅助器械',
  hammerstrength: '悍马机', 'hammer': '悍马机',
  hyperextension: '山羊挺身凳', 'hyperextensionbench': '山羊挺身凳', 'ghd': '山羊挺身凳', 'romanchairextension': '山羊挺身',
  plyobox: '跳箱', 'plyometricbox': '跳箱', 'stepbox': '跳箱', 'boxjump': '跳箱',
  pullupbar: '单杠', 'pullup': '单杠', 'chinningbar': '单杠', 'chinups': '单杠',
  parallelbar: '双杠', 'parallels': '双杠', 'dipsbar': '双杠', 'dipstation': '双杠',
  romanchair: '罗马椅', 'romanchairbench': '罗马椅',
  sled: '雪橇机', 'sledmachine': '雪橇机', 'sledpush': '雪橇', 'sledpull': '雪橇',
  trapbar: '六角杠铃', 'trap': '六角杆', 'hexbar': '六角杠铃', 'hex': '六角杆',
  vikingpress: '维京推举', 'viking': '维京机',
  landmine: '地雷管', 'landmines': '地雷管', 'landminebar': '地雷管',
  medicineball: '药球', 'medball': '药球', 'medballslam': '药球',
  suspension: '悬挂训练带', 'suspensiontrainer': '悬挂训练带', 'trx': '悬挂训练带',
};

// ============================================================================
// labelForEquipment — v1.0.7 先查 EQUIPMENT_ALIAS_ZH 再 fallback EQUIPMENT_LABELS
// ============================================================================
/**
 * @param eq 原始器械字符串 (slug / 自由格式 / 别名)
 * @param lang 'zh' 走 EQUIPMENT_ALIAS_ZH → EQUIPMENT_LABELS 链路；其他语言首字母大写回退
 */
export function labelForEquipment(eq: string | null | undefined, lang?: LanguageCode): string {
  if (!eq) return '未知器械';
  const raw = String(eq).trim();
  if (lang === 'en') {
    // — lang=en: 先查 EQUIPMENT_LABELS 的 en 名，否则首字母大写
    const meta = EQUIPMENT_LABELS[raw.toLowerCase()];
    if (meta?.en) return meta.en;
    return raw.length ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
  }
  // — lang=zh 或未指定：先查别名表 (归一化 = 去空格去连字符小写)，再查 EQUIPMENT_LABELS.zh
  const key = raw.toLowerCase().replace(/[\s_\-]/g, '');
  if (EQUIPMENT_ALIAS_ZH[key]) return EQUIPMENT_ALIAS_ZH[key];
  const meta = EQUIPMENT_LABELS[raw];
  if (meta?.zh) return meta.zh;
  // 兜底：原字符串（未命中时保留）
  return raw;
}

/**
 * Translate a free-form muscle abbreviation/phrase (as seen in `target` /
 * `secondary_muscles`) to zh full name.  For `lang !== 'zh'` returns the
 * original string with first-letter capitalisation.
 */
export function labelForMuscle(
  raw: string | null | undefined,
  lang: LanguageCode = 'zh',
): string {
  if (!raw) return '';
  const key = String(raw).trim().toLowerCase().replace(/[\s_\-0-9]/g, '');
  if (lang === 'zh') {
    if (MUSCLE_ALIAS_ZH[key]) return MUSCLE_ALIAS_ZH[key];
    if (BODY_PART_LABELS[key as BodyPart]?.zh) return BODY_PART_LABELS[key as BodyPart].zh;
    // fallback: return the raw original (usually descriptive zh already)
    const original = String(raw).trim();
    return original;
  }
  const s = String(raw).trim();
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/**
 * Helper: translate a `target` field or turn an English muscle phrase
 * into zh by splitting on punctuation and running each word/segment
 * through `labelForMuscle`.  If everything ends up untranslated we fall
 * back to the exercise's zh instructions lead sentence.
 */
export function translateTargetPhrase(
  raw: string | null | undefined,
  lang: LanguageCode = 'zh',
  fallbackZh?: string,
): string {
  if (!raw) return fallbackZh ?? '';
  if (lang !== 'zh') {
    const s = String(raw).trim();
    return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
  const original = String(raw).trim();
  // If it contains Chinese already, just return as-is.
  if (/[\u4e00-\u9fff]/.test(original)) return original;
  // v1.0.7 升级：对 3 种分隔符都能正确拆词：
  //   (1) "Muscle1 & Muscle2" / "Muscle1, Muscle2 and Muscle3" → 并列表
  //   (2) "Region (primary/secondary)" → 先去括号外层保留内部 (primary/secondary)
  //   (3) 单个空格分隔的两词 (Glutes & Hamstrings / Chest Shoulders Triceps)
  // 分割符覆盖：/ , & + ( ) 空格 以及 " and / or "
  const parenStripped = original
    .replace(/\(([^)]+)\)/g, ' $1 ')           // "Lower body (quads/glutes)" → "Lower body  quads/glutes "
    .replace(/[()]/g, ' ');                     // 残留括号清掉
  const tokens = parenStripped
    .split(/[\/,&+]+|\s+(?:and|or)\s+|\s+/i)
    .map((t) => t.trim())
    .filter((t) => t && t.length >= 2);         // 丢掉 1 字 token (噪声介词/冠词)
  // tokens 可能是多词肌肉短语（例如 "Trapezius Middle"）→ 不是逐词而是逐段翻译
  const translated = tokens.map((t) => {
    // 先整段查别名（例如 "trapeziusmiddle" / "trapezius middle" 统一归一）
    const zh = labelForMuscle(t, 'zh');
    // 如果整段查不到，就把该段输出原文（避免错误翻译）
    return zh || t;
  });
  const result = translated.join('、');
  if (!result || /^[\s、]+$/.test(result)) return fallbackZh ?? original;
  return result;
}

// Target is a free-form English muscle label (not a controlled slug).
// Returns a presentable title-case string.  There is no 1:1 canonical mapping
// because exercises-dataset target values are descriptive English phrases
// (e.g. "Biceps Brachii", "Quadriceps", "Upper Chest"), not slugs.
export function labelForTarget(target: string | null | undefined, lang: LanguageCode = 'zh'): string {
  if (!target) return '-';
  return translateTargetPhrase(target, lang);
}

// Animations in exercises-dataset live under `gif_url` (legacy dataset key) or
// the newer semantic `animation` field.  We resolve them the same way as
// getGifUrl — always from the locally-bundled assets, never network.
export function getAnimationUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return '';
  return getGifUrl(relativePath);
}

// Chinese display name for an Exercise with graceful fallback.
// Prioritizes dataset-provided `name_zh` when it exists and is meaningful
// (i.e. contains at least one Chinese character), otherwise falls back to the
// original English `name`.  We intentionally do NOT ship an in-app translator;
// translation is done offline by scripts/translate_names.py so bundle size
// stays small and terminology is gym-native Chinese.
export function displayNameZh(ex: { name: string; name_zh?: string | null } | null | undefined): string {
  if (!ex) return '';
  const zh = ex.name_zh;
  if (zh && typeof zh === 'string' && /[\u4e00-\u9fff]/.test(zh)) {
    return zh.trim();
  }
  return ex.name || '';
}

// ============================================================================
// BODY REGIONS — hierarchical grouping of the 10 canonical body parts.
// Used by the Library filter to let users narrow from broad region down to
// specific body part, reducing decision fatigue compared to showing all
// 10 chips at once.  Inspired by Strong / Hevy / Fitbod filter UX.
// ============================================================================

export type BodyRegion = 'all' | 'upper' | 'lower' | 'core' | 'cardio' | 'neck';

export const BODY_REGIONS: { key: BodyRegion; zh: string; en: string; icon: string; parts: BodyPart[] }[] = [
  { key: 'all', zh: '全部', en: 'All', icon: 'view-grid-outline', parts: [] },
  { key: 'upper', zh: '上肢', en: 'Upper Body', icon: 'arm-flex', parts: ['back', 'chest', 'shoulders', 'upper arms', 'lower arms'] },
  { key: 'lower', zh: '下肢', en: 'Lower Body', icon: 'human-male-board-poll', parts: ['upper legs', 'lower legs'] },
  { key: 'core', zh: '核心', en: 'Core', icon: 'weight-lifter', parts: ['waist'] },
  { key: 'cardio', zh: '有氧', en: 'Cardio', icon: 'run-fast', parts: ['cardio'] },
  { key: 'neck', zh: '颈部', en: 'Neck', icon: 'account-cowboy-hat-outline', parts: ['neck'] },
];

export function bodyPartBelongsToRegion(bp: BodyPart, region: BodyRegion): boolean {
  if (region === 'all') return true;
  const r = BODY_REGIONS.find((x) => x.key === region);
  return r ? r.parts.includes(bp) : false;
}

// ============================================================================
// EQUIPMENT GROUPS — grouping 28 equipment types into 6 intuitive categories.
// Reduces the 28-chip horizontal scroll to 7 group tabs, then shows only
// the relevant equipment chips for that group.
// ============================================================================

export type EquipmentGroup = 'all' | 'free' | 'machine' | 'cable' | 'band' | 'bodyweight' | 'cardio';

export const EQUIPMENT_GROUPS: { key: EquipmentGroup; zh: string; en: string; icon: string; items: string[] }[] = [
  { key: 'all', zh: '全部', en: 'All', icon: 'view-grid-outline', items: [] },
  { key: 'free', zh: '自由重量', en: 'Free Weights', icon: 'dumbbell', items: ['dumbbell', 'barbell', 'ez barbell', 'kettlebell', 'olympic barbell', 'trap bar', 'hammer'] },
  { key: 'machine', zh: '固定器械', en: 'Machines', icon: 'cog', items: ['leverage machine', 'smith machine', 'sled machine', 'machine', 'stepmill machine', 'stairmaster'] },
  { key: 'cable', zh: '绳索', en: 'Cable', icon: 'link-variant', items: ['cable'] },
  { key: 'band', zh: '弹力带', en: 'Bands', icon: 'tape-measure', items: ['band', 'resistance band'] },
  { key: 'bodyweight', zh: '自重/辅助', en: 'Body Weight', icon: 'human-greeting-proximity', items: ['body weight', 'weighted', 'assisted', 'roller', 'wheel roller', 'bosu ball', 'foam', 'medicine ball', 'exercise ball'] },
  { key: 'cardio', zh: '有氧器械', en: 'Cardio', icon: 'run-fast', items: ['treadmill', 'elliptical machine', 'stationary bike', 'upper body ergometer', 'skierg machine', 'rope', 'tire'] },
];

export function equipmentBelongsToGroup(eq: string, group: EquipmentGroup): boolean {
  if (group === 'all') return true;
  const g = EQUIPMENT_GROUPS.find((x) => x.key === group);
  return g ? g.items.includes(eq) : false;
}
