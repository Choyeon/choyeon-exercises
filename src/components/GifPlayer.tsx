import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View, Image as RNImage, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useThemeColors } from '@/theme';
import type { Colors } from '@/theme';
import { Icon } from './UIKit';

const FILL: any = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

interface GifPlayerProps {
  /** URL to the .gif file — in offline-only mode this is typically '' */
  gifUri: string;
  /** URL to the static poster JPG — used as fallback when GIF fails */
  posterUri: string;
  /** Whether to play GIF (true) or show poster (false) */
  active: boolean;
  /** Optional tint color for the placeholder slab (e.g. muscle group color) */
  tint?: string;
  /** Called when both GIF attempts fail and we settle on the poster */
  onFallbackToPoster?: () => void;
  /** Optional override for placeholder icon name */
  placeholderIcon?: string;
  /**
   * Frame fitting: 'cover' fills the frame (detail hero), 'contain' letterboxes
   * so the FULL animation frame stays visible (list cards — never cropped).
   */
  contentFit?: 'cover' | 'contain';
}

/**
 * 与主题无关的静态样式一次建好；依赖 colors 的部分按主题缓存（见 getGifStyles）。
 */
const GIF_STATIC_STYLES = StyleSheet.create({
  container: { width: '100%', height: '100%' },
  img: { width: '100%', height: '100%' },
  loadingOverlay: { ...FILL, alignItems: 'center', justifyContent: 'center' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

const gifStylesCache = new WeakMap<Colors, ReturnType<typeof createGifStyles>>();

function createGifStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      ...GIF_STATIC_STYLES.container,
      backgroundColor: colors.surfaceElevated,
    },
    img: {
      ...GIF_STATIC_STYLES.img,
      backgroundColor: colors.surfaceElevated,
    },
    loadingOverlay: {
      ...GIF_STATIC_STYLES.loadingOverlay,
      backgroundColor: colors.surfaceElevated,
    },
    placeholder: GIF_STATIC_STYLES.placeholder,
  });
}

function getGifStyles(colors: Colors) {
  let cached = gifStylesCache.get(colors);
  if (!cached) {
    cached = createGifStyles(colors);
    gifStylesCache.set(colors, cached);
  }
  return cached;
}

/**
 * GifPlayer — renders exercise media with a robust fallback chain.
 *
 * OFFLINE MODE (current default):
 *   All media URLs resolve to '' so no network is ever used.  This component
 *   detects empty URIs immediately and short-circuits straight to the
 *   Tier-D tinted placeholder slab — no loading spinner, no timeout wait,
 *   no wasted CPU on doomed HTTP requests.  The placeholder uses a
 *   muscle-group tint + body-part icon, which is still visually scannable.
 *
 * FALLBACK ORDER when URIs are actually provided and `active=true`:
 *   Tier A — expo-image (Glide, best caching + network handling).
 *   Tier B — RN core Image (Fresco + explicit animated-gif dep).
 *   Tier C — static poster JPG.
 *   Tier D — solid tinted placeholder slab (never blank, guaranteed render).
 */
export function GifPlayer({
  gifUri,
  posterUri,
  active,
  tint,
  onFallbackToPoster,
  placeholderIcon = 'dumbbell',
  contentFit = 'cover',
}: GifPlayerProps) {
  const colors = useThemeColors();
  // ★ 修复内存泄漏：组件卸载后异步回调（onLoadEnd/onError）不再 setState
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const safeSet = useCallback((fn: () => void) => {
    if (mountedRef.current) fn();
  }, []);

  // ------------------------------------------------------------------
  // OFFLINE SHORT-CIRCUIT — no media URLs provided → instant placeholder.
  // This is the 99.9% path in the current offline-only build.
  // ------------------------------------------------------------------
  const hasAnyMedia = !!gifUri || !!posterUri;

  // Simplified state machine — each tier is tried ONCE per activation.
  type Tier = 'expo' | 'rn' | 'poster' | 'placeholder';
  const [tier, setTier] = useState<Tier>(() => {
    if (!hasAnyMedia) return 'placeholder';
    return active ? 'expo' : 'poster';
  });
  const [loading, setLoading] = useState(false);

  // Reset when animation toggles or URL changes (new exercise).
  useEffect(() => {
    if (!hasAnyMedia) {
      safeSet(() => { setTier('placeholder'); setLoading(false); });
      return;
    }
    if (!active) {
      safeSet(() => { setTier('poster'); setLoading(false); });
      return;
    }
    safeSet(() => { setTier('expo'); setLoading(true); });
  }, [active, gifUri, posterUri, hasAnyMedia, safeSet]);

  const tintColor = tint ?? colors.primary;

  // 样式按主题缓存到模块级：GifPlayer 被 ExerciseCard 用在 FlashList 的每一个
  // 可见 cell 里，逐实例 StyleSheet.create 会在滚动过程中持续制造分配与 GC。
  const styles = getGifStyles(colors);

  // --- Error handlers: each tier tries ONCE, then moves down the chain ---

  const handleExpoError = useCallback(() => {
    safeSet(() => { setTier('rn'); setLoading(true); });
  }, [safeSet]);

  const handleRnError = useCallback(() => {
    safeSet(() => { setTier('poster'); setLoading(false); });
    onFallbackToPoster?.();
  }, [safeSet, onFallbackToPoster]);

  // If poster also fails → move to placeholder (never blank screen).
  const handlePosterError = useCallback(() => {
    safeSet(() => { setTier('placeholder'); setLoading(false); });
    onFallbackToPoster?.();
  }, [safeSet, onFallbackToPoster]);

  const handleLoadEnd = useCallback(() => {
    safeSet(() => setLoading(false));
  }, [safeSet]);

  // ============================================================
  // TIER D (fast path) — solid tinted placeholder slab.
  // Used whenever hasAnyMedia is false (offline mode) OR every
  // remote-load tier has failed.  Renders instantly, zero I/O.
  // ============================================================
  if (tier === 'placeholder' || !hasAnyMedia) {
    return (
      // placeholder 的底色依赖 tint（每张卡都不同），只能走 inline style；
      // 其余与主题相关的部分已随 colors 缓存。
      <View style={[styles.placeholder, { backgroundColor: tintColor + '18' }]}>
        <Icon name={placeholderIcon} size={48} color={tintColor} />
      </View>
    );
  }

  // Not playing → show poster JPG.
  if (!active) {
    return (
      <View style={styles.container}>
        <ExpoImage
          source={posterUri}
          style={styles.img}
          contentFit={contentFit}
          transition={200}
          onError={handlePosterError}
        />
      </View>
    );
  }

  // ============================================================
  // TIER A — expo-image (Glide on Android, animated-gif via Glide native)
  // ============================================================
  if (tier === 'expo') {
    return (
      <View style={styles.container}>
        <ExpoImage
          source={gifUri}
          style={styles.img}
          contentFit={contentFit}
          onLoadEnd={handleLoadEnd}
          onError={handleExpoError}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>
    );
  }

  // ============================================================
  // TIER B — RN core Image (Fresco + explicit animated-gif dep)
  // ============================================================
  if (tier === 'rn') {
    return (
      <View style={styles.container}>
        <RNImage
          source={{ uri: gifUri }}
          style={styles.img}
          resizeMode={contentFit}
          onLoadEnd={handleLoadEnd}
          onError={handleRnError}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>
    );
  }

  // ============================================================
  // TIER C — static poster JPG (guaranteed to render if URL works)
  // ============================================================
  return (
    <View style={styles.container}>
      <ExpoImage
        source={posterUri}
        style={styles.img}
        contentFit={contentFit}
        onError={handlePosterError}
      />
    </View>
  );
}
