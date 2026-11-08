/**
 * ui — gluestack-backed primitive component re-export barrel.
 *
 * Contains 9 primitives that were added in the M1 gluestack-ui v2 MVP
 * integration milestone.  Callers typically import via `UIKit.tsx`
 * (which re-exports everything below alongside the v1 UIKit atoms):
 *
 *   import { Badge, useToast } from '@/components/UIKit';
 *
 * You may also import from this file directly — it is a plain barrel
 * with zero side effects so bundlers / Metro can tree-shake unused
 * primitives without penalty.
 */

export { Toast, ToastProvider, useToast } from './Toast';
export type { ToastVariant, ToastOptions } from './Toast';

export { AlertDialog, ConfirmDialog } from './AlertDialog';
export type { ConfirmDialogProps, ConfirmDialogVariant } from './AlertDialog';

export { Progress } from './Progress';
export type { ProgressProps } from './Progress';

export { ProgressRing } from './ProgressRing';
export type { ProgressRingProps } from './ProgressRing';

export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { Switch } from './Switch';
export type { SwitchProps } from './Switch';

export { SegmentedControl } from './SegmentedControl';
export type {
  SegmentedControlProps,
  SegmentedControlOption,
} from './SegmentedControl';

export { Badge } from './Badge';
export type { UIBadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { HapticButton } from './HapticButton';
export type { HapticButtonProps, HapticButtonVariant } from './HapticButton';
