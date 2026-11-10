import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// expo-router 57 bundles @react-navigation/bottom-tabs and re-exports its
// types from its internal layout module.
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
// Android 原生液态玻璃 Tab 栏：Kyant0 的 iOS 26 风格玻璃胶囊 + 可拖拽的液态
// 选择水滴（Jetpack Compose 原生渲染，背景实时折射 RN 画面）。
import { AndroidGlassBottomTabs, AndroidGlassTab } from 'expo-android-glass-view';
import { useThemeColors, useIsDark } from '@/theme';
import { Icon } from '@/components/UIKit';
import { safeHaptic } from '@/utils/haptic';
import { GlassSurface, LiquidLens, glassRadius } from './LiquidGlass';

// ============================================================================
// iOS 26 · Liquid Glass tab bar
// ----------------------------------------------------------------------------
// Follows the iOS 26 tab bar: a floating capsule of glass that hovers above
// the content instead of being welded to the bottom of the screen.
//
//   · capsule material with a bright specular rim
//   · every item is a floating glass tile
//   · the selected item morphs — the icon scales up, a specular lens swells
//     behind it and the icon "lifts" out of the material (iOS 26 behaviour)
//   · the bar respects the home-indicator inset so the capsule never
//     collides with the gesture area
//
// On Android the whole bar is delegated to `expo-android-glass-view`:
// `AndroidGlassBottomTabs` already ships Kyant's native liquid-glass capsule
// with the draggable selection droplet, so nothing is re-implemented here.
// ============================================================================

const SPRING = { mass: 0.6, stiffness: 260, damping: 24 } as const;

type TabStyle = {
  icon: string;
  activeIcon: string;
  accent: string;
};

/** Per-tab iconography + accent (kept in sync with the theme palette). */
function useTabStyles(): Record<string, TabStyle> {
  const colors = useThemeColors();
  return {
    index: { icon: 'home-outline', activeIcon: 'home', accent: colors.primary },
    library: { icon: 'book-open-variant', activeIcon: 'book-open-variant', accent: colors.info },
    workout: { icon: 'clipboard-outline', activeIcon: 'clipboard-play-outline', accent: colors.accent },
    profile: { icon: 'account-outline', activeIcon: 'account', accent: colors.muscle.shoulders },
  };
}

/** Resolve the label of a route, honouring `tabBarLabel` / `title`. */
function resolveRouteLabel(
  route: { name: string },
  options: { tabBarLabel?: unknown; title?: unknown }
): string {
  const rawLabel =
    typeof options.tabBarLabel === 'string'
      ? options.tabBarLabel
      : ((options.title as string | undefined) ?? route.name);
  return typeof rawLabel === 'string' ? rawLabel : route.name;
}

const TabItem = memo(function TabItem({
  focused,
  icon,
  activeIcon,
  accent,
  label,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  focused: boolean;
  icon: string;
  activeIcon: string;
  accent: string;
  label: string;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
}) {
  const colors = useThemeColors();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, progress]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.18]) },
      { translateY: interpolate(progress.value, [0, 1], [0, -2]) },
    ],
  }));

  const lensStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.25, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1]) }],
  }));

  const tint = focused ? accent : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={styles.item}
    >
      <View style={styles.iconStage}>
        <Animated.View style={[StyleSheet.absoluteFill, lensStyle]} pointerEvents="none">
          <LiquidLens size={54} color={accent} />
        </Animated.View>
        <Animated.View style={iconStyle}>
          <Icon name={focused ? activeIcon : icon} size={25} color={tint} />
        </Animated.View>
      </View>
      <Text
        numberOfLines={1}
        style={[styles.label, { color: focused ? accent : colors.textSecondary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

// ----------------------------------------------------------------------------
// Android — native liquid-glass bar (expo-android-glass-view)
// ----------------------------------------------------------------------------
function AndroidLiquidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const tabStyles = useTabStyles();

  // Routes hidden with `href: null` reach a custom bar as `display: 'none'`.
  const routes = useMemo(
    () =>
      state.routes.filter(
        (route) =>
          StyleSheet.flatten(descriptors[route.key].options.tabBarItemStyle)?.display !== 'none'
      ),
    [state.routes, descriptors]
  );

  const focusedKey = state.routes[state.index]?.key;
  const selectedIndex = Math.max(
    0,
    routes.findIndex((route) => route.key === focusedKey)
  );

  const handleSelect = useCallback(
    (index: number) => {
      const route = routes[index];
      if (!route) return;
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
      safeHaptic('light');
    },
    [navigation, routes]
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { paddingBottom: insets.bottom + 10 }]}
    >
      <AndroidGlassBottomTabs
        theme={dark ? 'dark' : 'light'}
        accentColor={colors.primary}
        selectedIndex={selectedIndex}
        onTabSelected={handleSelect}
        style={styles.androidBar}
      >
        {routes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.key === focusedKey;
          const style = tabStyles[route.name] ?? tabStyles.index;
          const label = resolveRouteLabel(route, options as never);
          const accessibilityLabel =
            (options.tabBarAccessibilityLabel as string | undefined) ?? label;

          return (
            <AndroidGlassTab
              key={route.key}
              label={label}
              labelStyle={{ color: colors.textSecondary }}
              // The native droplet tints the selected tab, so every icon is
              // drawn in one neutral colour.
              icon={
                <View
                  accessible
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={accessibilityLabel}
                >
                  <Icon
                    name={focused ? style.activeIcon : style.icon}
                    size={24}
                    color={colors.textSecondary}
                  />
                </View>
              }
            />
          );
        })}
      </AndroidGlassBottomTabs>
    </View>
  );
}

// ----------------------------------------------------------------------------
// iOS — Apple UIGlassEffect capsule
// ----------------------------------------------------------------------------
function IosLiquidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const tabStyles = useTabStyles();

  const entrance = useSharedValue(0);
  useEffect(() => {
    entrance.value = withTiming(1, { duration: 220 });
  }, [entrance]);

  const barStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: interpolate(entrance.value, [0, 1], [14, 0]) }],
  }));

  const handlePress = useCallback(
    (routeName: string, routeKey: string) => {
      const event = navigation.emit({
        type: 'tabPress',
        target: routeKey,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(routeName);
      }
      safeHaptic('light');
    },
    [navigation]
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { paddingBottom: insets.bottom + 10 }]}
    >
      <Animated.View style={[styles.barWrap, barStyle]}>
        <GlassSurface
          borderRadius={glassRadius.capsule}
          intensity={70}
          style={styles.bar}
          accessible={false}
        >
          {/* top specular sweep — the light that rolls across iOS 26 glass */}
          <View style={styles.sweep} pointerEvents="none" />

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const style = tabStyles[route.name] ?? tabStyles.index;
            const label = resolveRouteLabel(route, options as never);

            return (
              <TabItem
                key={route.key}
                focused={focused}
                icon={style.icon}
                activeIcon={style.activeIcon}
                accent={style.accent}
                label={label}
                accessibilityLabel={
                  (options.tabBarAccessibilityLabel as string | undefined) ?? label
                }
                onPress={() => handlePress(route.name, route.key)}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              />
            );
          })}
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

export function LiquidTabBar(props: BottomTabBarProps) {
  if (Platform.OS === 'android') {
    return <AndroidLiquidTabBar {...props} />;
  }
  return <IosLiquidTabBar {...props} />;
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  barWrap: {
    // the capsule floats — it must not be glued to the screen edge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 62,
    paddingHorizontal: 6,
  },
  androidBar: {
    // the native bar keeps its own 64dp height and 4dp side padding so the
    // selection droplet stays aligned with the icons
    borderRadius: 32,
  },
  sweep: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 0,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    minHeight: 48,
  },
  iconStage: {
    width: 40,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
    includeFontPadding: false,
  },
});
