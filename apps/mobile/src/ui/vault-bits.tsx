import { color, font, radius, space, type } from '@getsava/ui';
import { useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { formatLira, formatPct, formatUsdc, useTranslation } from '../i18n';
import { usdcToTry } from '../lib/fx';
import type { ChartPoint, Timeframe } from '../lib/rate-series';
import { TIMEFRAMES } from '../lib/rate-series';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { VarTag } from './VarTag';

/* ============================================================
   Vault UI primitives — ported from the handoff "Ledger" design
   into @getsava/ui tokens. Shared by all 5 Earn screens.
   ============================================================ */

/** Squared accent dot: green for low risk, amber for mid. */
export function RiskDot({ risk }: { risk: 'low' | 'mid' }) {
  return <View style={[styles.riskDot, risk === 'low' ? styles.riskDotLow : styles.riskDotMid]} />;
}

/** Pool status pill. 0/1 Active · 2/3 On ice · ≥4 Frozen. */
export function StatusPill({ status }: { status: number }) {
  const { t } = useTranslation();
  const active = status <= 1;
  const frozen = status >= 4;
  const label = active
    ? t('vault.statusActive')
    : frozen
      ? t('vault.statusFrozen')
      : t('vault.statusIce');
  const tint = active ? color.green : frozen ? color.red : color.amber;
  const bg = active ? color.greenSoft : frozen ? color.redSoft : color.amberSoft;
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <View style={[styles.statusDot, { backgroundColor: tint }]} />
      <Text style={[styles.statusLabel, { color: tint }]}>{label}</Text>
    </View>
  );
}

const CHART_H = 210;
const PAD_TOP = 14;
const PAD_BOTTOM = 10;

/** Catmull-Rom → cubic-bezier smoothing for a soft, trading-app line. */
function smoothPath(pts: ReadonlyArray<readonly [number, number]>): string {
  if (pts.length < 2) {
    return '';
  }
  const at = (k: number): readonly [number, number] =>
    pts[Math.max(0, Math.min(pts.length - 1, k))] as readonly [number, number];
  let d = `M${at(0)[0].toFixed(1)} ${at(0)[1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * Full-width interactive APY chart (Midas/Robinhood-style): smooth area+line. Touch
 * anywhere and slide — the whole chart captures the gesture, so a crosshair + dot
 * flow under the finger and `onScrub` reports the point (the screen's hero is the
 * readout). Green when the window rises, red when it falls.
 */
export function RateChart({
  data,
  height = CHART_H,
  onScrub,
}: {
  data: ChartPoint[];
  height?: number;
  onScrub?: (p: ChartPoint | null) => void;
}) {
  const [w, setW] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  const wRef = useRef(0);
  const dataRef = useRef(data);
  dataRef.current = data;
  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;

  function pick(e: GestureResponderEvent) {
    const width = wRef.current || 1;
    const d = dataRef.current;
    const n = d.length;
    const i = Math.max(0, Math.min(n - 1, Math.round((e.nativeEvent.locationX / width) * (n - 1))));
    setScrub(i);
    onScrubRef.current?.(d[i] ?? null);
  }
  function end() {
    setScrub(null);
    onScrubRef.current?.(null);
  }

  const panRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (panRef.current === null) {
    panRef.current = PanResponder.create({
      // Capture the gesture immediately so a touch anywhere on the chart scrubs and
      // keeps following — the user never has to land on the line itself.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: pick,
      onPanResponderMove: pick,
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }

  const onLayout = (e: LayoutChangeEvent) => {
    wRef.current = e.nativeEvent.layout.width;
    setW(e.nativeEvent.layout.width);
  };

  if (w === 0 || data.length < 2) {
    return <View style={{ height }} onLayout={onLayout} />;
  }

  const n = data.length;
  const values = data.map((d) => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sp = max - min || Math.max(min, 1);
  // Pad the vertical range so a stable (near-flat) rate sits mid-box, not glued to an edge.
  const lo = min - sp * 0.25;
  const hi = max + sp * 0.25;
  const range = hi - lo || 1;
  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const xAt = (i: number) => (i / (n - 1)) * w;
  const yAt = (v: number) => PAD_TOP + (1 - (v - lo) / range) * innerH;
  const pts = data.map((d, i) => [xAt(i), yAt(d.v)] as const);

  const rising = (data[n - 1]?.v ?? 0) >= (data[0]?.v ?? 0);
  const tint = rising ? color.green : color.red;
  const line = smoothPath(pts);
  const baseY = (height - PAD_BOTTOM).toFixed(1);
  const area = `${line} L${xAt(n - 1).toFixed(1)} ${baseY} L0 ${baseY} Z`;
  const lastPt = pts[n - 1] ?? ([0, 0] as const);
  const sPt = pts[scrub ?? n - 1] ?? lastPt;

  return (
    <View style={{ height }} onLayout={onLayout} {...panRef.current.panHandlers}>
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={tint} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={tint} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#rateFill)" />
        <Path
          d={line}
          fill="none"
          stroke={tint}
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {scrub === null ? (
          <>
            <Circle cx={lastPt[0]} cy={lastPt[1]} r={8} fill={tint} fillOpacity={0.18} />
            <Circle cx={lastPt[0]} cy={lastPt[1]} r={4} fill={tint} />
          </>
        ) : (
          <>
            <Line
              x1={sPt[0]}
              y1={0}
              x2={sPt[0]}
              y2={height}
              stroke={color.inkFaint}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <Circle cx={sPt[0]} cy={sPt[1]} r={10} fill={tint} fillOpacity={0.18} />
            <Circle cx={sPt[0]} cy={sPt[1]} r={5.5} fill={tint} stroke={color.bg} strokeWidth={2} />
          </>
        )}
      </Svg>
    </View>
  );
}

const TF_KEY: Record<Timeframe, string> = {
  '1D': 'd1',
  '1W': 'w1',
  '2W': 'w2',
  '1M': 'm1',
  '3M': 'm3',
  '1Y': 'y1',
};

/** Range selector under the chart (1D · 1W · 2W · 1M · 3M · 1Y). */
export function TimeframeTabs({
  value,
  onChange,
}: {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={chartStyles.tabs}>
      {TIMEFRAMES.map((tf) => {
        const active = tf === value;
        return (
          <Pressable
            key={tf}
            onPress={() => onChange(tf)}
            style={[chartStyles.tab, active && chartStyles.tabActive]}
            hitSlop={6}
          >
            <Text style={[chartStyles.tabLabel, active && chartStyles.tabLabelActive]}>
              {t(`chart.${TF_KEY[tf]}` as Parameters<typeof t>[0])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 6, marginTop: space.s3 },
  tab: {
    flex: 1,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: color.surface2 },
  tabLabel: { fontFamily: font.semiBold, fontSize: 12, color: color.inkFaint },
  tabLabelActive: { color: color.ink },
});

/** Vault list card. Tappable row with rate, risk, pool size and your value / CTA. */
export function Vrow({
  name,
  apy,
  risk,
  poolSizeUsdc,
  onPress,
  held = false,
  yourValueUsdc,
  paused = false,
}: {
  name: string;
  apy: number;
  risk: 'low' | 'mid';
  poolSizeUsdc: number;
  onPress: () => void;
  held?: boolean;
  yourValueUsdc?: number;
  paused?: boolean;
}) {
  const { t, locale } = useTranslation();
  const riskTint = risk === 'low' ? color.green : color.amber;
  return (
    <View
      accessibilityRole="button"
      onTouchEnd={onPress}
      style={[styles.vrow, held && styles.vrowHas]}
    >
      <View style={styles.vrowHead}>
        <View style={styles.vrowMark}>
          <Text style={styles.vrowMarkText}>$</Text>
        </View>
        <View style={styles.vrowId}>
          <Text style={styles.vrowName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.vrowRiskLine}>
            <RiskDot risk={risk} />
            <Text style={[styles.vrowRisk, { color: riskTint }]}>
              {risk === 'low' ? t('vault.lowerRisk') : t('vault.higherRisk')}
            </Text>
            {paused ? (
              <View style={styles.pausedChip}>
                <Icon name="lock" size={10} stroke={color.inkFaint} />
                <Text style={styles.pausedChipText}>{t('earn.pausedTitle')}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.vrowApy}>
          <Text style={styles.vrowApyNum}>~{formatPct(apy, locale)}</Text>
          <Text style={styles.vrowApyVar}>{t('common.variable')}</Text>
        </View>
      </View>
      <View style={styles.vrowFoot}>
        <View style={styles.vfStat}>
          <Text style={styles.vfK}>{t('vault.poolSize')}</Text>
          <Text style={styles.vfV}>{formatUsdc(poolSizeUsdc, locale)}</Text>
        </View>
        {held ? (
          <View style={[styles.vfStat, styles.vfStatRight]}>
            <Text style={styles.vfK}>{t('vault.yourValue')}</Text>
            <Text style={styles.vfV}>{formatLira(usdcToTry(yourValueUsdc ?? 0), locale)}</Text>
          </View>
        ) : (
          <View style={styles.vrowCta}>
            <Text style={styles.vrowCtaText}>{t('vault.supplyHere')}</Text>
            <Icon name="chevR" size={15} stroke={color.purple} />
          </View>
        )}
      </View>
    </View>
  );
}

/** Position card: value now (₺) + USDC, yield earned, supply APY. */
export function Vpos({
  valueUsdc,
  yieldUsdc,
  apy,
  since,
}: {
  valueUsdc: number;
  yieldUsdc: number;
  apy: number;
  since?: string;
}) {
  const { t, locale } = useTranslation();
  return (
    <View style={styles.vpos}>
      <View style={styles.vposHead}>
        <View style={styles.vposBadge}>
          <Icon name="check" size={11} stroke={color.green} />
          <Text style={styles.vposBadgeText}>{t('vault.supplied')}</Text>
        </View>
        {since ? (
          <Text style={styles.vposSince}>
            {t('vault.since')} {since}
          </Text>
        ) : null}
      </View>
      <View style={styles.vposMain}>
        <Text style={styles.vposK}>{t('vault.valueNow')}</Text>
        <Text style={styles.vposVal}>{formatLira(usdcToTry(valueUsdc), locale)}</Text>
        <Text style={styles.vposUsd}>{formatUsdc(valueUsdc, locale)}</Text>
      </View>
      <View style={styles.vposGrid}>
        <View style={styles.vpgCell}>
          <Text style={styles.vpgK}>{t('vault.yieldAll')}</Text>
          <Text style={[styles.vpgV, styles.vpgVGreen]}>
            +{formatLira(usdcToTry(yieldUsdc), locale)}
          </Text>
          <Text style={styles.vpgS}>+{formatUsdc(yieldUsdc, locale)}</Text>
        </View>
        <View style={[styles.vpgCell, styles.vpgCellRight]}>
          <Text style={styles.vpgK}>{t('vault.supplyApy')}</Text>
          <Text style={styles.vpgV}>~{formatPct(apy, locale)}</Text>
          <View style={styles.vpgAmber}>
            <Icon name="info" size={10} stroke={color.amber} />
            <Text style={styles.vpgAmberText}>{t('common.variable')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Pool stats list + utilization bar + status. */
export function PoolStats({
  poolSizeUsdc,
  utilization,
  supplyApy,
  borrowApy,
  status,
  safetyUsdc,
  onExplorer,
}: {
  poolSizeUsdc: number;
  utilization: number;
  supplyApy: number;
  borrowApy: number;
  status: number;
  safetyUsdc?: number;
  onExplorer: () => void;
}) {
  const { t, locale } = useTranslation();
  const utilPct = Math.max(0, Math.min(100, Math.round(utilization * 100)));
  return (
    <View>
      <View style={styles.pstat}>
        <View style={styles.psRow}>
          <View style={styles.psK}>
            <Icon name="wallet" size={14} stroke={color.inkDim} />
            <Text style={styles.psKText}>{t('vault.poolSize')}</Text>
          </View>
          <Text style={styles.psV}>{formatUsdc(poolSizeUsdc, locale)}</Text>
        </View>
        {safetyUsdc !== undefined ? (
          <View style={styles.psRow}>
            <View style={styles.psK}>
              <Icon name="shield" size={14} stroke={color.green} />
              <Text style={styles.psKText}>{t('vault.safety')}</Text>
            </View>
            <Text style={styles.psV}>{formatUsdc(safetyUsdc, locale)}</Text>
          </View>
        ) : null}
        <View style={[styles.psRow, styles.psRowCol]}>
          <View style={styles.psUtilHead}>
            <View style={styles.psK}>
              <Icon name="spark" size={14} stroke={color.inkDim} />
              <Text style={styles.psKText}>{t('vault.utilization')}</Text>
            </View>
            <Text style={styles.psV}>{formatPct(utilPct, locale)}</Text>
          </View>
          <View style={styles.psBar}>
            <View style={[styles.psFill, { width: `${utilPct}%` }]} />
          </View>
          <Text style={styles.psHint}>{t('vault.utilHint')}</Text>
        </View>
        <View style={styles.psRow}>
          <View style={styles.psK}>
            <Icon name="earn" size={14} stroke={color.inkDim} />
            <Text style={styles.psKText}>{t('vault.rates')}</Text>
          </View>
          <Text style={styles.psV}>
            ~{formatPct(supplyApy, locale)} <Text style={styles.psSlash}>/</Text> ~
            {formatPct(borrowApy, locale)}
          </Text>
        </View>
        <View style={styles.psRow}>
          <View style={styles.psK}>
            <Icon name="globe" size={14} stroke={color.inkDim} />
            <Text style={styles.psKText}>{t('vault.status')}</Text>
          </View>
          <StatusPill status={status} />
        </View>
      </View>
      <View accessibilityRole="button" onTouchEnd={onExplorer} style={styles.linkRow}>
        <Icon name="external" size={15} stroke={color.inkDim} />
        <Text style={styles.linkRowText}>{t('vault.viewExplorer')}</Text>
      </View>
    </View>
  );
}

/** APY composition bar: green base + purple rewards, with legend. */
export function BreakdownBar({ basePct, rewardsPct }: { basePct: number; rewardsPct: number }) {
  const { t, locale } = useTranslation();
  const total = basePct + rewardsPct || 1;
  const baseW = Math.max(0, Math.min(100, (basePct / total) * 100));
  return (
    <View style={styles.bdWrap}>
      <View style={styles.bdBar}>
        <View style={[styles.bdSegBase, { width: `${baseW}%` }]} />
        <View style={[styles.bdSegRew, { width: `${100 - baseW}%` }]} />
      </View>
      <View style={styles.bdLegend}>
        <View style={styles.bdLeg}>
          <View style={[styles.bdDot, styles.bdDotBase]} />
          <Text style={styles.bdLegText}>{t('vault.base')}</Text>
          <Text style={styles.bdLegVal}>~{formatPct(basePct, locale)}</Text>
        </View>
        <View style={styles.bdLeg}>
          <View style={[styles.bdDot, styles.bdDotRew]} />
          <Text style={styles.bdLegText}>{t('vault.rewards')}</Text>
          <Text style={styles.bdLegVal}>~{formatPct(rewardsPct, locale)}</Text>
        </View>
      </View>
    </View>
  );
}

/** "Before you supply" tappable card. */
export function LearnCard({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <View accessibilityRole="button" onTouchEnd={onPress} style={styles.learnCard}>
      <View style={styles.learnCardIcon}>
        <Icon name="shield" size={20} stroke={color.purpleInk} />
      </View>
      <View style={styles.learnCardText}>
        <Text style={styles.learnCardTitle}>{t('vault.learn')}</Text>
        <Text style={styles.learnCardSub}>{t('vault.learnSub')}</Text>
      </View>
      <Icon name="chevR" size={18} stroke={color.purple} />
    </View>
  );
}

interface LearnSectionDef {
  readonly icon: 'info' | 'earn' | 'alert' | 'shield';
  readonly tint: string;
  readonly bg: string;
  readonly title: string;
  readonly body: string;
}

/** Bottom sheet with the 4 "before you supply" sections + Supply footer. */
export function LearnSheet({
  visible,
  onClose,
  onSupply,
}: {
  visible: boolean;
  onClose: () => void;
  onSupply: () => void;
}) {
  const { t } = useTranslation();
  const sections: LearnSectionDef[] = [
    {
      icon: 'info',
      tint: color.purple,
      bg: color.purpleSoft,
      title: t('vault.learnWhatT'),
      body: t('vault.learnWhatD'),
    },
    {
      icon: 'earn',
      tint: color.green,
      bg: color.greenSoft,
      title: t('vault.learnHowT'),
      body: t('vault.learnHowD'),
    },
    {
      icon: 'alert',
      tint: color.red,
      bg: color.redSoft,
      title: t('vault.learnRiskT'),
      body: t('vault.learnRiskD'),
    },
    {
      icon: 'shield',
      tint: color.blue,
      bg: color.blueSoft,
      title: t('vault.learnSafeT'),
      body: t('vault.learnSafeD'),
    },
  ];
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('vault.learn')}
      dock={
        <Button label={t('vault.supply')} variant="primary" iconName="earn" onPress={onSupply} />
      }
    >
      {sections.map((s) => (
        <View key={s.title} style={styles.learnSec}>
          <View style={[styles.learnSecIcon, { backgroundColor: s.bg }]}>
            <Icon name={s.icon} size={17} stroke={s.tint} />
          </View>
          <View style={styles.learnSecText}>
            <Text style={styles.learnSecTitle}>{s.title}</Text>
            <Text style={styles.learnSecBody}>{s.body}</Text>
          </View>
        </View>
      ))}
    </Sheet>
  );
}

/** Compact vault summary strip atop the supply / withdraw flows. */
export function VaultSummary({
  name,
  apy,
  mode,
  suppliedUsdc,
  yieldUsdc,
}: {
  name: string;
  apy: number;
  mode: 'supply' | 'withdraw';
  suppliedUsdc?: number;
  yieldUsdc?: number;
}) {
  const { t, locale } = useTranslation();
  return (
    <View style={styles.vsum}>
      <View style={styles.vsumIcon}>
        <Text style={styles.vsumIconText}>USDC</Text>
      </View>
      <View style={styles.vsumMid}>
        <Text style={styles.vsumName} numberOfLines={1}>
          {name}
        </Text>
        {mode === 'withdraw' ? (
          <Text style={styles.vsumSub} numberOfLines={1}>
            {t('vault.supplied')} {formatLira(usdcToTry(suppliedUsdc ?? 0), locale)} ·{' '}
            <Text style={styles.vsumSubGreen}>
              +{formatLira(usdcToTry(yieldUsdc ?? 0), locale)}
            </Text>
          </Text>
        ) : (
          <View style={styles.vsumSubRow}>
            <Icon name="shield" size={11} stroke={color.green} />
            <Text style={styles.vsumSub}>{t('vault.vetted')}</Text>
          </View>
        )}
      </View>
      <View style={styles.vsumApy}>
        <Text style={styles.vsumApyNum}>~{formatPct(apy, locale)}</Text>
        <VarTag label={t('common.variable')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // risk dot
  riskDot: { width: 7, height: 7, borderRadius: 2 },
  riskDotLow: { backgroundColor: color.green },
  riskDotMid: { backgroundColor: color.amber },

  // status pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.s2 + 1,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontFamily: font.bold, fontSize: 11, letterSpacing: 0.1 },

  // vrow
  vrow: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md + 2,
    paddingHorizontal: space.s4,
    paddingVertical: 15,
  },
  vrowHas: { borderColor: color.greenSoft },
  vrowHead: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  vrowMark: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vrowMarkText: { fontFamily: font.extraBold, fontSize: 20, color: color.purpleInk },
  vrowId: { flex: 1, minWidth: 0, gap: 3 },
  vrowName: { ...type.title, fontFamily: font.bold, fontSize: 16, color: color.ink },
  vrowRiskLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vrowRisk: { fontFamily: font.regular, fontSize: 12.5 },
  pausedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 3,
    backgroundColor: color.surface2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm - 4,
  },
  pausedChipText: { fontFamily: font.bold, fontSize: 10, color: color.inkFaint },
  vrowApy: { alignItems: 'flex-end', gap: 2 },
  vrowApyNum: { fontFamily: font.extraBold, fontSize: 19, color: color.green, letterSpacing: -0.3 },
  vrowApyVar: {
    fontFamily: font.bold,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: color.amber,
  },
  vrowFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderColor: color.hairSoft,
  },
  vfStat: { gap: 4 },
  vfStatRight: { alignItems: 'flex-end' },
  vfK: { fontFamily: font.regular, fontSize: 11, color: color.inkFaint },
  vfV: { fontFamily: font.bold, fontSize: 14, color: color.ink },
  vrowCta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vrowCtaText: { fontFamily: font.bold, fontSize: 13.5, color: color.purple },

  // vpos
  vpos: {
    backgroundColor: color.greenSoft,
    borderWidth: 1,
    borderColor: color.greenSoft,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
    paddingTop: space.s4,
  },
  vposHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vposBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: color.greenSoft,
    paddingHorizontal: space.s2,
    paddingVertical: 3,
    borderRadius: radius.sm - 4,
  },
  vposBadgeText: { fontFamily: font.bold, fontSize: 11, color: color.green },
  vposSince: { fontFamily: font.regular, fontSize: 12, color: color.inkDim },
  vposMain: {
    paddingTop: 14,
    paddingBottom: space.s4,
    borderBottomWidth: 1,
    borderColor: color.hairSoft,
  },
  vposK: { fontFamily: font.regular, fontSize: 12, color: color.inkFaint, marginBottom: 7 },
  vposVal: { fontFamily: font.extraBold, fontSize: 32, color: color.ink, letterSpacing: -0.9 },
  vposUsd: { fontFamily: font.mono, fontSize: 12.5, color: color.inkFaint, marginTop: 7 },
  vposGrid: { flexDirection: 'row' },
  vpgCell: { flex: 1, paddingVertical: 14 },
  vpgCellRight: {
    borderLeftWidth: 1,
    borderColor: color.hairSoft,
    paddingLeft: space.s4,
  },
  vpgK: { fontFamily: font.regular, fontSize: 11.5, color: color.inkFaint, marginBottom: 7 },
  vpgV: { fontFamily: font.extraBold, fontSize: 19, color: color.ink, letterSpacing: -0.4 },
  vpgVGreen: { color: color.green },
  vpgS: { fontFamily: font.mono, fontSize: 11, color: color.inkFaint, marginTop: 6 },
  vpgAmber: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  vpgAmberText: { fontFamily: font.semiBold, fontSize: 11, color: color.amber },

  // pool stats
  pstat: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
  },
  psRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: color.hairSoft,
  },
  psRowCol: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  psK: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  psKText: { fontFamily: font.regular, fontSize: 13, color: color.inkDim },
  psV: { fontFamily: font.bold, fontSize: 15, color: color.ink, textAlign: 'right' },
  psSlash: { fontFamily: font.regular, color: color.inkFaint },
  psUtilHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  psBar: {
    height: 8,
    borderRadius: 5,
    backgroundColor: color.surface2,
    overflow: 'hidden',
  },
  psFill: { height: '100%', borderRadius: 5, backgroundColor: color.purple },
  psHint: { fontFamily: font.regular, fontSize: 11.5, color: color.inkFaint, lineHeight: 17 },

  // explorer link row
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: radius.md - 2,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
  },
  linkRowText: { fontFamily: font.semiBold, fontSize: 13, color: color.inkDim },

  // breakdown bar
  bdWrap: { marginTop: space.s4 },
  bdBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: color.surface2,
  },
  bdSegBase: { backgroundColor: color.green },
  bdSegRew: { backgroundColor: color.purple },
  bdLegend: { flexDirection: 'row', gap: 18, marginTop: 10 },
  bdLeg: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bdDot: { width: 9, height: 9, borderRadius: 3 },
  bdDotBase: { backgroundColor: color.green },
  bdDotRew: { backgroundColor: color.purple },
  bdLegText: { fontFamily: font.regular, fontSize: 12, color: color.inkDim },
  bdLegVal: { fontFamily: font.bold, fontSize: 12, color: color.ink, marginLeft: 2 },

  // learn card
  learnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: color.purpleSoft,
    borderWidth: 1,
    borderColor: color.purpleBd,
    borderRadius: radius.md,
    padding: space.s4,
  },
  learnCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm + 1,
    backgroundColor: color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnCardText: { flex: 1, minWidth: 0 },
  learnCardTitle: { fontFamily: font.bold, fontSize: 14, color: color.ink },
  learnCardSub: { fontFamily: font.regular, fontSize: 12, color: color.inkDim, marginTop: 2 },

  // learn sheet sections
  learnSec: {
    flexDirection: 'row',
    gap: 13,
    paddingVertical: space.s4,
    borderBottomWidth: 1,
    borderColor: color.hairSoft,
  },
  learnSecIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  learnSecText: { flex: 1, minWidth: 0 },
  learnSecTitle: { fontFamily: font.bold, fontSize: 14.5, color: color.ink, marginBottom: 5 },
  learnSecBody: { fontFamily: font.regular, fontSize: 13, lineHeight: 21, color: color.inkDim },

  // vault summary strip
  vsum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  vsumIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm - 1,
    backgroundColor: color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsumIconText: { fontFamily: font.extraBold, fontSize: 11.5, color: color.purpleInk },
  vsumMid: { flex: 1, minWidth: 0, gap: 3 },
  vsumName: { fontFamily: font.bold, fontSize: 14.5, color: color.ink },
  vsumSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vsumSub: { fontFamily: font.regular, fontSize: 12, color: color.inkDim },
  vsumSubGreen: { fontFamily: font.semiBold, color: color.green },
  vsumApy: { alignItems: 'flex-end', gap: 4 },
  vsumApyNum: { fontFamily: font.extraBold, fontSize: 16, color: color.green, letterSpacing: -0.2 },
});
