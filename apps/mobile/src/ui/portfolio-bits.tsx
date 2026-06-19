import { color, font, radius, space, type } from '@getsava/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { formatLira, formatUsdc, useTranslation } from '../i18n';
import { usdcToTry } from '../lib/fx';
import type { PortfolioPoint } from '../lib/portfolio-series';
import { Icon } from './Icon';

/**
 * Portfolio view (T2.D4): a 90-day value chart (real on-chain position value over
 * time) + a principal-vs-yield breakdown. Yield is provable-or-N/A — when it can't
 * be proven on-chain the split shows "—" rather than a fabricated number.
 */
export function PortfolioCard({
  series,
  valueUsdc,
  yieldUsdc,
  coveredDays,
  onExplorer,
}: {
  series: PortfolioPoint[];
  valueUsdc: number;
  yieldUsdc: number | null;
  coveredDays: number;
  onExplorer: () => void;
}) {
  const { t, locale } = useTranslation();

  const principalUsdc = yieldUsdc === null ? null : Math.max(0, valueUsdc - yieldUsdc);
  const yieldPct =
    yieldUsdc !== null && valueUsdc > 0 ? Math.min(1, Math.max(0, yieldUsdc / valueUsdc)) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.k}>{t('portfolio.valueNow')}</Text>
        <Text style={styles.window}>{t('portfolio.window')}</Text>
      </View>
      <Text style={styles.val}>{formatLira(usdcToTry(valueUsdc), locale)}</Text>
      <Text style={styles.valUsd}>{formatUsdc(valueUsdc, locale)}</Text>

      <View style={styles.chart}>
        <ValueChart series={series} />
      </View>

      {/* principal-vs-yield breakdown */}
      <View style={styles.barRow}>
        <View style={styles.bar}>
          <View style={[styles.barPrincipal, { flex: Math.max(0.0001, 1 - yieldPct) }]} />
          <View style={[styles.barYield, { flex: Math.max(0.0001, yieldPct) }]} />
        </View>
      </View>
      <View style={styles.legend}>
        <Legend
          dot={color.usdc}
          label={t('portfolio.principal')}
          value={principalUsdc === null ? '—' : formatUsdc(principalUsdc, locale)}
        />
        <Legend
          dot={color.green}
          label={t('portfolio.yieldLabel')}
          value={yieldUsdc === null ? '—' : `+${formatUsdc(yieldUsdc, locale)}`}
        />
      </View>

      <Pressable style={styles.foot} onPress={onExplorer} hitSlop={6}>
        <Icon name="shield" size={13} stroke={color.inkFaint} />
        <Text style={styles.footTx}>
          {t('portfolio.onchain')}
          {coveredDays > 0 ? ` · ${t('portfolio.history', { days: String(coveredDays) })}` : ''}
        </Text>
        <Icon name="external" size={13} stroke={color.inkFaint} />
      </Pressable>
    </View>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: dot }]} />
      <Text style={styles.legendK}>{label}</Text>
      <Text style={styles.legendV}>{value}</Text>
    </View>
  );
}

/** 90-day portfolio-value area+line chart (viewBox 0..100, non-scaling stroke). */
function ValueChart({ series }: { series: PortfolioPoint[] }) {
  const n = series.length;
  const vals = series.map((p) => p.valueUsdc);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.12 || max * 0.12 || 1;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;
  const xAt = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * 100);
  const yAt = (v: number) => 96 - ((v - lo) / (hi - lo || 1)) * 88;
  const line = series
    .map((p, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(2)} ${yAt(p.valueUsdc).toFixed(2)}`)
    .join(' ');
  const area = `${line} L100 100 L0 100 Z`;
  return (
    <Svg width="100%" height={92} viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="pfGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color.green} stopOpacity={0.26} />
          <Stop offset="100%" stopColor={color.green} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#pfGrad)" />
      <Path
        d={line}
        stroke={color.green}
        strokeWidth={2}
        fill="none"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    padding: space.s4,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  k: { ...type.label, letterSpacing: 1, textTransform: 'uppercase', color: color.inkFaint },
  window: { ...type.micro, color: color.inkFaint },
  val: { fontFamily: font.extraBold, fontSize: 26, color: color.ink, marginTop: 4 },
  valUsd: { fontFamily: font.mono, fontSize: 12.5, color: color.inkFaint, marginTop: 2 },
  chart: { height: 92, marginTop: space.s3, marginBottom: space.s3 },
  barRow: { marginTop: space.s2 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  barPrincipal: { backgroundColor: color.usdc },
  barYield: { backgroundColor: color.green },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.s3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendK: { ...type.caption, color: color.inkDim },
  legendV: { fontFamily: font.bold, fontSize: 13, color: color.ink, marginLeft: 4 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: space.s4,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
  },
  footTx: { ...type.micro, color: color.inkFaint, flex: 1 },
});
