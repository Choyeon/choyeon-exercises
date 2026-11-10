import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { Icon, PressableScale } from '@/components/UIKit';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { safeHaptic } from '@/utils/haptic';
import { backupSizeKb, parseBackup, summarizeBackup } from '@/utils/backup';
import type { BackupErrorCode } from '@/utils/backup';
import { useAppStore } from '@/store/useAppStore';

// ============================================================================
// BackupSheet —— 备份 / 恢复面板。
//
// 设计约束：这是一个纯离线工具 App，不申请任何存储/分享/剪贴板权限，
// 也不引入 expo-file-system / expo-sharing / expo-clipboard 等原生模块。
// 所以备份走「纯文本」路线：
//   · 导出：把 JSON 渲染在可长按选择的 <Text selectable> 里，用户自行复制
//     到任意地方（备忘录、微信收藏、邮件草稿箱……）；
//   · 导入：贴一段文本进来，本地解析。
//
// 这看起来"土"，但它有三个硬优点：
//   1) 零权限、零原生依赖、永不因系统版本升级而失效；
//   2) 用户看得见自己备份了什么，不存在"云上黑箱"；
//   3) 换手机只要能传一段文字就能恢复。
// ============================================================================

export interface BackupSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Tab = 'export' | 'import';

const ERROR_TEXT: Record<BackupErrorCode, { zh: string; en: string }> = {
  empty: { zh: '内容为空，请先粘贴备份文本。', en: 'Nothing to import yet.' },
  notJson: { zh: '不是合法的 JSON 文本，可能复制时缺了头尾。', en: 'Not valid JSON.' },
  notObject: { zh: 'JSON 顶层不是对象，可能不是本 App 的备份。', en: 'Top level is not an object.' },
  wrongApp: { zh: '这不是 Choyeon Gym 的备份文件。', en: 'Not a Choyeon Gym backup.' },
  unsupportedVersion: { zh: '备份版本过高，请升级 App 后再导入。', en: 'Backup version is newer than this app.' },
  noData: { zh: '备份里没有任何可导入的数据。', en: 'Backup contains no data.' },
};

export function BackupSheet({ visible, onClose }: BackupSheetProps) {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const zh = !i18n.language?.startsWith('en');

  const exportBackup = useAppStore((s) => s.exportBackup);
  const importBackup = useAppStore((s) => s.importBackup);
  const workouts = useAppStore((s) => s.workouts);

  const [tab, setTab] = useState<Tab>('export');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 导出文本只在面板可见时生成 —— 训练记录可能很长，
  // 没必要为随时可能不打开的面板反复序列化整库。
  const exported = useMemo(() => {
    if (!visible || tab !== 'export') return '';
    return exportBackup();
  }, [visible, tab, exportBackup, workouts]);

  const sizeKb = useMemo(() => (exported ? backupSizeKb(exported) : 0), [exported]);

  const preview = useMemo(() => {
    if (!exported) return null;
    try {
      return summarizeBackup(JSON.parse(exported));
    } catch {
      return null;
    }
  }, [exported]);

  /**
   * 导入前的实时预览：用户边贴边看到「这段文本里有多少次训练」，
   * 而不是点了按钮才知道贴错了 —— 覆盖模式尤其关键。
   */
  const draftPreview = useMemo(() => {
    if (tab !== 'import') return null;
    const trimmed = draft.trim();
    if (trimmed.length === 0) return null;
    const parsed = parseBackup(trimmed);
    if (!parsed.ok) return { ok: false as const, code: parsed.error };
    return { ok: true as const, summary: summarizeBackup(parsed.payload), warnings: parsed.warnings };
  }, [tab, draft]);

  const runImport = useCallback(
    (mode: 'merge' | 'replace') => {
      setError(null);
      setNotice(null);
      const res = importBackup(draft, mode);
      if (!res.ok) {
        const e = ERROR_TEXT[res.error as BackupErrorCode];
        setError(e ? (zh ? e.zh : e.en) : String(res.error));
        safeHaptic('warning');
        return;
      }
      const s = res.summary;
      safeHaptic('success');
      setNotice(
        zh
          ? `导入完成（${mode === 'merge' ? '合并' : '覆盖'}）：训练 ${s.workouts} 次 · 组 ${s.sets} · PR ${s.prRecords}`
          : `Imported (${mode}): ${s.workouts} sessions · ${s.sets} sets · ${s.prRecords} PRs`
      );
      setDraft('');
    },
    [draft, importBackup, zh]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
        sheet: {
          backgroundColor: colors.bg,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          maxHeight: '88%',
        },
        grabber: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.surfaceBorder,
          alignSelf: 'center',
          marginBottom: spacing.md,
        },
        head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
        title: { ...typography.h3, color: colors.textPrimary },
        closeBtn: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceElevated,
        },
        summaryCard: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        summaryItem: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
        summaryNum: { ...typography.bodyBold, color: colors.primary },
        summaryLabel: { ...typography.micro, color: colors.textTertiary },
        hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 20 },
        jsonBox: {
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          borderRadius: radius.md,
          padding: spacing.md,
          maxHeight: 260,
          marginBottom: spacing.md,
        },
        jsonText: { ...typography.mono, fontSize: 10, lineHeight: 14, color: colors.textSecondary },
        inputBox: {
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          borderRadius: radius.md,
          padding: spacing.md,
          height: 180,
          marginBottom: spacing.md,
        },
        input: { ...typography.mono, fontSize: 11, lineHeight: 16, color: colors.textPrimary },
        errBox: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.danger + '18',
          borderWidth: 1,
          borderColor: colors.danger + '44',
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        errText: { flex: 1, ...typography.caption, color: colors.textPrimary },
        okBox: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.success + '18',
          borderWidth: 1,
          borderColor: colors.success + '44',
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        okText: { flex: 1, ...typography.caption, color: colors.textPrimary },
        btnRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
        primaryBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          backgroundColor: colors.primary,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
        },
        primaryBtnText: { ...typography.bodyBold, color: colors.textInverse },
        ghostBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
        },
        ghostBtnText: { ...typography.bodyBold, color: colors.textSecondary },
      }),
    [colors, typography]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.grabber} />

            <View style={styles.head}>
              <Text style={styles.title}>
                {t('backup.title', { defaultValue: '备份与恢复' })}
              </Text>
              <PressableScale
                onPress={onClose}
                style={styles.closeBtn}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={t('common.close', { defaultValue: '关闭' })}
              >
                <Icon name="close" size={16} color={colors.textSecondary} />
              </PressableScale>
            </View>

            <SegmentedControl<Tab>
              options={[
                { value: 'export', label: t('backup.tabExport', { defaultValue: '导出' }), icon: 'export' },
                { value: 'import', label: t('backup.tabImport', { defaultValue: '导入' }), icon: 'import' },
              ]}
              value={tab}
              onChange={(next) => {
                safeHaptic('selection');
                setTab(next);
                setError(null);
                setNotice(null);
              }}
            />

            <View style={{ height: spacing.md }} />

            {tab === 'export' ? (
              <>
                {preview ? (
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                      <Stat n={preview.workouts} l={t('backup.statWorkouts', { defaultValue: '次训练' })} />
                      <Stat n={preview.sets} l={t('backup.statSets', { defaultValue: '组' })} />
                      <Stat n={preview.prRecords} l="PR" />
                      <Stat n={preview.templates} l={t('backup.statTemplates', { defaultValue: '模板' })} />
                      <Stat n={preview.bodyEntries} l={t('backup.statBody', { defaultValue: '身体数据' })} />
                    </View>
                    <Text style={[styles.summaryLabel, { marginTop: spacing.xs }]}>
                      {t('backup.size', { defaultValue: '约 {{v}} KB', v: sizeKb })}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.hint}>
                  {t('backup.exportHint', {
                    defaultValue: '长按下方文本可全选复制，粘贴到备忘录 / 任何能存文字的地方即可。恢复时把整段文本贴回「导入」。',
                  })}
                </Text>

                <ScrollView style={styles.jsonBox} nestedScrollEnabled>
                  <Text style={styles.jsonText} selectable>
                    {exported}
                  </Text>
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.hint}>
                  {t('backup.importHint', {
                    defaultValue: '把之前导出的整段文本粘贴进来。合并模式按 id 去重保留双方数据；覆盖模式会先清空本机数据。',
                  })}
                </Text>

                <TextInput
                  value={draft}
                  onChangeText={(v) => {
                    setDraft(v);
                    setError(null);
                  }}
                  // 容器样式与字体样式必须合并：RN 的 TextInput 不会把
                  // 外层 style 继承给内部文本节点。
                  style={[styles.inputBox, styles.input]}
                  multiline
                  textAlignVertical="top"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={t('backup.pastePlaceholder', { defaultValue: '在此粘贴备份文本…' })}
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel={t('backup.pastePlaceholder', { defaultValue: '在此粘贴备份文本…' })}
                />

                {draftPreview && !draftPreview.ok ? (
                  <View style={styles.errBox}>
                    <Icon name="alert-circle-outline" size={18} color={colors.danger} />
                    <Text style={styles.errText}>
                      {(() => {
                        const e = ERROR_TEXT[draftPreview.code];
                        return e ? (zh ? e.zh : e.en) : String(draftPreview.code);
                      })()}
                    </Text>
                  </View>
                ) : null}

                {draftPreview && draftPreview.ok ? (
                  <View style={styles.summaryCard}>
                    <Text style={[styles.summaryLabel, { marginBottom: spacing.xs }]}>
                      {t('backup.willImport', { defaultValue: '将导入' })}
                      {draftPreview.summary.exportedAt
                        ? ` · ${String(draftPreview.summary.exportedAt).slice(0, 10)}`
                        : ''}
                    </Text>
                    <View style={styles.summaryRow}>
                      <Stat n={draftPreview.summary.workouts} l={t('backup.statWorkouts', { defaultValue: '次训练' })} />
                      <Stat n={draftPreview.summary.sets} l={t('backup.statSets', { defaultValue: '组' })} />
                      <Stat n={draftPreview.summary.prRecords} l="PR" />
                      <Stat n={draftPreview.summary.templates} l={t('backup.statTemplates', { defaultValue: '模板' })} />
                      <Stat n={draftPreview.summary.bodyEntries} l={t('backup.statBody', { defaultValue: '身体数据' })} />
                    </View>
                    {draftPreview.warnings.length > 0 ? (
                      <Text style={[styles.summaryLabel, { marginTop: spacing.xs }]}>
                        {t('backup.partialWarning', {
                          defaultValue: '其中有部分记录格式异常，导入时会被跳过（其余正常导入）。',
                        })}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {error ? (
                  <View style={styles.errBox}>
                    <Icon name="alert-circle-outline" size={18} color={colors.danger} />
                    <Text style={styles.errText}>{error}</Text>
                  </View>
                ) : null}

                {notice ? (
                  <View style={styles.okBox}>
                    <Icon name="check-circle-outline" size={18} color={colors.success} />
                    <Text style={styles.okText}>{notice}</Text>
                  </View>
                ) : null}

                <View style={styles.btnRow}>
                  <PressableScale
                    onPress={() => runImport('merge')}
                    style={styles.primaryBtn}
                    scaleTo={0.98}
                    accessibilityRole="button"
                    accessibilityLabel={t('backup.merge', { defaultValue: '合并导入' })}
                  >
                    <Icon name="set-merge" size={16} color={colors.textInverse} />
                    <Text style={styles.primaryBtnText}>
                      {t('backup.merge', { defaultValue: '合并导入' })}
                    </Text>
                  </PressableScale>

                  <PressableScale
                    onPress={() => {
                      // 覆盖导入是不可逆的（先清空本机全部数据），必须二次确认
                      Alert.alert(
                        t('backup.replace', { defaultValue: '覆盖导入' }),
                        t('backup.replaceConfirm', {
                          defaultValue: '覆盖会删除本机现有的全部训练记录、模板、身体数据与 PR，且无法撤销。确定继续？',
                        }),
                        [
                          { text: t('common.cancel', { defaultValue: '取消' }), style: 'cancel' },
                          {
                            text: t('backup.replace', { defaultValue: '覆盖导入' }),
                            style: 'destructive',
                            onPress: () => runImport('replace'),
                          },
                        ]
                      );
                    }}
                    style={styles.ghostBtn}
                    scaleTo={0.98}
                    accessibilityRole="button"
                    accessibilityLabel={t('backup.replace', { defaultValue: '覆盖导入' })}
                  >
                    <Icon name="restore" size={16} color={colors.textSecondary} />
                    <Text style={styles.ghostBtnText}>
                      {t('backup.replace', { defaultValue: '覆盖导入' })}
                    </Text>
                  </PressableScale>
                </View>
              </>
            )}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
      <Text style={{ ...typography.bodyBold, color: colors.primary }}>{n}</Text>
      <Text style={{ ...typography.micro, color: colors.textTertiary }}>{l}</Text>
    </View>
  );
}
