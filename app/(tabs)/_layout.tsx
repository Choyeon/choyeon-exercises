import React, { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@/theme';
import { LiquidTabBar } from '@/components/ui/LiquidTabBar';

// ============================================================================
// Tab navigator — iOS 26 "Liquid Glass" tab bar.
//
// The bar is a floating glass capsule (see LiquidTabBar) instead of the old
// full-width opaque strip, so page content can scroll underneath it and every
// tab screen reserves the extra bottom clearance it needs.
// ============================================================================
export default function TabLayout() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const labels = useMemo(
    () => ({
      index: t('tabs.home'),
      library: t('tabs.library'),
      workout: t('tabs.workout'),
      profile: t('tabs.profile'),
    }),
    [t]
  );

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      // The liquid glass bar renders its own labels.
      tabBarShowLabel: false,
      tabBarActiveTintColor: colors.primary as any,
      tabBarInactiveTintColor: colors.textTertiary as any,
    }),
    [colors.primary, colors.textTertiary]
  );

  return (
    <Tabs
      screenOptions={screenOptions}
      tabBar={(props) => <LiquidTabBar {...props} />}
      backBehavior="history"
    >
      <Tabs.Screen name="index" options={{ title: labels.index }} />
      <Tabs.Screen name="library" options={{ title: labels.library }} />
      <Tabs.Screen name="workout" options={{ title: labels.workout }} />
      <Tabs.Screen name="profile" options={{ title: labels.profile }} />
    </Tabs>
  );
}
