/**
 * HIG audit — traverses every app screen and component file and checks it
 * against a set of Apple Human Interface Guidelines criteria that are
 * statically verifiable:
 *
 *   HARD (must pass):  no hardcoded legacy dark bg, no industrial 900 weight,
 *                      theme-aware (useThemeColors), edge-safe (SafeArea).
 *   SOFT (reported):   accessibilityRole/Label present, grouped-card pattern.
 *
 * This is the "遍历每一个页面" automated gate. Visual / device-size checks are
 * covered by the QA matrix document (no simulator in this headless env).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, acc);
    } else if (entry.name.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Files that are not "screens" — layout config / redirect entry.
function isNonScreen(rel: string) {
  const n = rel.replace(/\\/g, '/');
  return n.includes('_layout.tsx') || n === 'app/index.tsx';
}

const screens = walk(path.join(ROOT, 'app')).map((f) => path.relative(ROOT, f)).sort();
const components = walk(path.join(ROOT, 'src/components'))
  .map((f) => path.relative(ROOT, f))
  .sort();

interface Report {
  file: string;
  screen: boolean;
  theme: boolean;
  safe: boolean;
  a11y: number;
  grouped: boolean;
  legacyBg: boolean;
  heavyWeight: boolean;
  /** Screen hides the native stack header — it then MUST provide its own back control. */
  hidesNativeHeader: boolean;
  hasBackAffordance: boolean;
  /** Coarse (>=1pt) surface strokes instead of iOS hairlines. */
  coarseStroke: boolean;
  /** Screen constrains content to a readable column on wide displays. */
  readableColumn: boolean;
}

function auditFile(rel: string, isScreen: boolean): Report {
  const src = read(rel);
  const hidesNativeHeader = /headerShown:\s*false/.test(src);
  const hasBackAffordance =
    /AppleNavBar/.test(src) ||
    /name=["']chevron-left["']/.test(src) ||
    /name=["']arrow-left["']/.test(src) ||
    /router\.back\(\)/.test(src);
  return {
    file: rel,
    screen: isScreen,
    theme: src.includes('useThemeColors'),
    safe: /SafeAreaView|useSafeAreaInsets/.test(src),
    a11y: (src.match(/accessibilityRole|accessibilityLabel|accessibilityHint/g) || []).length,
    grouped: /GroupedCard|<GroupedCard|borderRadius|radius\.[a-z]/i.test(src),
    legacyBg: src.includes('#07090C') || src.includes('#F4F6F9'),
    heavyWeight: /fontWeight:\s*['"]900['"]/.test(src),
    hidesNativeHeader,
    hasBackAffordance,
    coarseStroke: /borderWidth:\s*[2-9]\b/.test(src),
    readableColumn: /maxContentWidth/.test(src),
  };
}

describe('HIG audit — every screen is theme-aware, edge-safe, no legacy tokens', () => {
  const reports: Report[] = [];
  for (const rel of screens) {
    reports.push(auditFile(rel, !isNonScreen(rel)));
  }

  const failures: string[] = [];
  for (const r of reports) {
    if (r.legacyBg) failures.push(`${r.file}: legacy bg/color token present`);
    if (r.heavyWeight) failures.push(`${r.file}: industrial 900 font-weight present`);
    if (r.screen && !r.theme) failures.push(`${r.file}: not theme-aware (missing useThemeColors)`);
    if (r.screen && !r.safe) failures.push(`${r.file}: missing SafeArea handling`);
  }

  it('prints a per-screen HIG compliance report', () => {
    // eslint-disable-next-line no-console
    console.log('\nHIG AUDIT — SCREENS');
    // eslint-disable-next-line no-console
    console.log('file'.padEnd(34), 'theme safe a11y  grouped');
    for (const r of reports) {
      // eslint-disable-next-line no-console
      console.log(
        r.file.padEnd(34),
        String(r.theme).padEnd(6),
        String(r.safe).padEnd(5),
        String(r.a11y).padEnd(4),
        String(r.grouped),
      );
    }
    expect(reports.length).toBeGreaterThan(0);
  });

  it('has no legacy tokens or industrial weights on any screen', () => {
    expect(failures.filter((f) => f.includes('legacy') || f.includes('900'))).toEqual([]);
  });

  it('uses no over-heavy font weights (iOS tops out at Bold 700)', () => {
    const heavy: string[] = [];
    for (const rel of [...screens, ...components]) {
      const src = read(rel);
      if (/fontWeight:\s*['"](800|900)['"]/.test(src)) heavy.push(rel);
    }
    expect(heavy).toEqual([]);
  });

  it('every screen is theme-aware and edge-safe', () => {
    const structural = failures.filter((f) => f.includes('theme-aware') || f.includes('SafeArea'));
    expect(structural).toEqual([]);
  });

  it('every screen exposes at least one accessibility attribute', () => {
    const bad = reports.filter((r) => r.screen && r.a11y === 0).map((r) => r.file);
    expect(bad).toEqual([]);
  });

  it('screens that hide the native header provide a back affordance', () => {
    // HIG: a screen that opts out of the native navigation bar must supply its
    // own, discoverable way back — otherwise the user is trapped.
    const bad = reports
      .filter((r) => r.screen && r.hidesNativeHeader && !r.hasBackAffordance)
      .map((r) => r.file);
    expect(bad).toEqual([]);
  });

  it('no screen uses coarse (>=2pt) strokes', () => {
    const bad = reports.filter((r) => r.coarseStroke).map((r) => r.file);
    expect(bad).toEqual([]);
  });

  it('every screen constrains content to a readable column on wide displays', () => {
    // HIG: on iPad / landscape the content column must not stretch to the
    // full display width — long line lengths hurt readability.
    const bad = reports.filter((r) => r.screen && !r.readableColumn).map((r) => r.file);
    expect(bad).toEqual([]);
  });
});

describe('HIG audit — components are theme-aware and free of legacy tokens', () => {
  const reports: Report[] = components.map((rel) => auditFile(rel, false));

  it('prints a per-component HIG compliance report', () => {
    // eslint-disable-next-line no-console
    console.log('\nHIG AUDIT — COMPONENTS');
    // eslint-disable-next-line no-console
    console.log('file'.padEnd(40), 'theme a11y  grouped');
    for (const r of reports) {
      // eslint-disable-next-line no-console
      console.log(
        r.file.padEnd(40),
        String(r.theme).padEnd(6),
        String(r.a11y).padEnd(4),
        String(r.grouped),
      );
    }
    expect(reports.length).toBeGreaterThan(0);
  });

  it('no component uses legacy tokens', () => {
    const bad = reports.filter((r) => r.legacyBg || r.heavyWeight).map((r) => r.file);
    expect(bad).toEqual([]);
  });
});
