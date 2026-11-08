import * as Haptics from 'expo-haptics';
import { useAppStore } from '@/store/useAppStore';

/**
 * Centralized haptic feedback helper.  Respects the user's
 * `settings.hapticFeedback` toggle so the preferences page is not a lie.
 *
 * Usage (replace all inline `Haptics.impactAsync` / `notificationAsync` calls):
 *   import { safeHaptic } from '@/utils/haptic';
 *   safeHaptic('light');
 *   safeHaptic('success');
 */
export type HapticKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection';

export function safeHaptic(kind: HapticKind = 'light'): void {
  // 参数白名单 guard：任何 undefined/null/非标准字符串 → 直接 return，避免 expo-haptics 原生桥接未知枚举值导致闪退
  const ALLOWED: HapticKind[] = ['light','medium','heavy','success','warning','error','selection'];
  if (!kind || ALLOWED.indexOf(kind as HapticKind) < 0) return;
  // Pull synchronously from store to avoid requiring React hooks context.
  // Works both inside and outside of component trees.
  let enabled: boolean;
  try {
    const st = useAppStore.getState?.();
    enabled = !!(st && st.settings && (st.settings as any).hapticFeedback !== false);
  } catch {
    enabled = true;
  }
  if (!enabled) return;

  try {
    switch (kind) {
      case 'light':
        Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light ?? 0);
        break;
      case 'medium':
        Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Medium ?? 1);
        break;
      case 'heavy':
        Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Heavy ?? 2);
        break;
      case 'success':
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType?.Success ?? 0);
        break;
      case 'warning':
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType?.Warning ?? 1);
        break;
      case 'error':
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType?.Error ?? 2);
        break;
      case 'selection':
        Haptics.selectionAsync?.();
        break;
    }
  } catch {
    // iOS 模拟器 / 低端 Android / 平板无振动器 —— 静默即可，绝不 rethrow 导致闪退
  }
}
