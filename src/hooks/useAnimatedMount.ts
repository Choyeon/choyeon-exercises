import React, { useMemo, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  WithSpringConfig,
  withDelay,
} from 'react-native-reanimated';
// ============================================================================
// useAnimatedMount — FadeInUp + stagger entry animation.
//
// Usage:
//   const { animatedStyle } = useAnimatedMount({ delay: 80 * index });
//   return <Animated.View style={animatedStyle}>...</Animated.View>;
//
// Honors the OS-level "reduce motion" accessibility setting: when
// enabled, the component renders immediately at opacity=1 / translate=0
// with zero animation.  Spring config is tuned for the neo-editorial
// aesthetic — critically-damped, never bouncy, never playful.
// ============================================================================

export interface UseAnimatedMountOptions {
  /** Delay in ms before the entry animation begins. */
  delay?: number;
  /** Vertical distance (px) the content travels up during fade-in. Default 12. */
  travelY?: number;
  /** Total fade duration in ms. Default 340. */
  duration?: number;
  /** Override spring cfg (applied to translateY). Default critically-damped. */
  springConfig?: Partial<WithSpringConfig>;
  /** If provided, setVisible(false) triggers a fade-out. Omit for mount-only. */
  initialVisible?: boolean;
}

export interface UseAnimatedMountResult {
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  /** Imperative control if caller wants to later unmount with fade-out. */
  setVisible: (visible: boolean) => void;
}

const DEFAULT_SPRING: WithSpringConfig = {
  mass: 0.65,
  stiffness: 320,
  damping: 26,
  overshootClamping: true,
};

export function useAnimatedMount(opts: UseAnimatedMountOptions = {}): UseAnimatedMountResult {
  const {
    delay = 0,
    travelY = 12,
    duration = 340,
    springConfig,
    initialVisible = true,
  } = opts;

  const opacity = useSharedValue(initialVisible ? 0 : 0);
  const translateY = useSharedValue(initialVisible ? travelY : 0);

  // Reduce-motion: we read the OS setting once per mount.  If the user
  // toggles it while the screen is mounted, we won't react mid-animation
  // (that would be excessive complexity) — but future mounts respect it.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v: boolean) => {
        if (alive) setReducedMotion(!!v);
      })
      .catch(() => {
        // Not available on all RN versions / platforms — default FALSE.
      });
    return () => { alive = false; };
  }, []);

  const springCfg = useMemo(
    () => ({ ...DEFAULT_SPRING, ...(springConfig ?? {}) }) as any,
    [springConfig]
  );

  // Drive entry on mount.
  useEffect(() => {
    if (!initialVisible) return;
    if (reducedMotion) {
      // Skip animation entirely — snap to final frame.
      opacity.value = 1;
      translateY.value = 0;
      return undefined;
    }
    const doDelay = (fn: () => void, ms: number) => {
      if (ms <= 0) { fn(); return; }
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    };
    const cancel = doDelay(() => {
      opacity.value = withTiming(1, { duration });
      translateY.value = withSpring(0, springCfg);
    }, delay);
    return cancel;
  }, [reducedMotion, delay, duration, initialVisible, opacity, translateY, springCfg]);

  const setVisible = (visible: boolean) => {
    if (reducedMotion) {
      opacity.value = visible ? 1 : 0;
      translateY.value = 0;
      return;
    }
    if (visible) {
      opacity.value = withDelay(delay, withTiming(1, { duration }));
      translateY.value = withDelay(delay, withSpring(0, springCfg));
    } else {
      // Fade out — shorter duration, no spring, just a clean fade.
      opacity.value = withTiming(0, { duration: 220 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return { animatedStyle, setVisible };
}

export default useAnimatedMount;
