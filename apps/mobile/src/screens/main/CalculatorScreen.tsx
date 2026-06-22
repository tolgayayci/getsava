import { color, font, radius, space, type } from '@getsava/ui';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { Locale } from '../../i18n';
import { formatLira, formatPct, formatUsdc, useTranslation } from '../../i18n';
import { CBRT_CURRENT_1Y_RATE, compareBankVsSava } from '../../lib/bankRates';
import { usdcToTry, useTryRate } from '../../lib/fx';
import { useVault } from '../../lib/useVault';
import { useNav } from '../../nav';
import { Button, Icon, type IconName, NavHeader, Sheet } from '../../ui';

// Brief: project across 1 / 3 / 6 / 12 months (+ a 5-year long view).
const TERMS: { m: number; k: 't1m' | 't3m' | 't6m' | 't1y' | 't5y' }[] = [
  { m: 1, k: 't1m' },
  { m: 3, k: 't3m' },
  { m: 6, k: 't6m' },
  { m: 12, k: 't1y' },
  { m: 60, k: 't5y' },
];

/**
 * Yield calculator (result-first). Projects a USDC balance from a starting
 * amount + monthly contributions at a chosen APY, using MONTHLY COMPOUNDING:
 *   i = (1 + APY/100)^(1/12) − 1
 *   balance(n) = start·(1+i)^n + monthly·((1+i)^n − 1)/i
 * USDC is the predictable unit; ₺ is shown at today's rate as a reference.
 */
export function CalculatorScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { vault } = useVault();

  const [start, setStart] = useState(500);
  const [monthly, setMonthly] = useState(50);
  const [termM, setTermM] = useState(12);
  const [src, setSrc] = useState<'live' | 'custom'>('live');
  const [customRate, setCustomRate] = useState(8);
  const [picker, setPicker] = useState(false);
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });

  const isCustom = src === 'custom';
  const liveApy = vault?.apy ?? 0;
  const apy = isCustom ? customRate : liveApy;
  const srcLabel = isCustom ? t('calc.custom') : (vault?.name ?? 'USDC Core');

  // Bank-vs-Sava reality check, in DOLLAR terms, over the real 5-year window
  // (CBRT/TCMB published lira rates + live USD/TRY). The Sava row uses the SELECTED
  // rate (live or custom), so the comparison updates with the calculator's rate.
  const usdTry = useTryRate();
  const cmp = compareBankVsSava({ principalUsd: start, tryRateNow: usdTry, savaApyPct: apy });

  // monthly compounding
  const i = (1 + apy / 100) ** (1 / 12) - 1;
  const balAt = (n: number): number =>
    i === 0 ? start + monthly * n : start * (1 + i) ** n + monthly * (((1 + i) ** n - 1) / i);
  const future = balAt(termM);
  const added = monthly * termM;
  const earned = Math.max(0, future - start - added);

  const termKey = TERMS.find((x) => x.m === termM)?.k ?? 't1y';
  const termLabel = t(`calc.${termKey}` as Parameters<typeof t>[0]);

  // Smooth compound-growth line: the projected balance sampled across the term
  // (monthly for a year), drawn as a smooth rising curve + filled area. The
  // curve bows upward as the rate compounds (pronounced at higher rates).
  const steps = Math.min(termM, 60);
  const series = Array.from({ length: steps + 1 }, (_, k) => balAt((k / steps) * termM));
  const vMin = series[0] ?? 0;
  const vMax = series[steps] ?? vMin + 1;
  const padV = (vMax - vMin) * 0.12 || vMax * 0.12 || 1;
  const lo = Math.max(0, vMin - padV);
  const hi = vMax + padV;
  const pts = series.map((v, k) => ({
    x: (k / steps) * 100,
    y: 90 - ((v - lo) / (hi - lo || 1)) * 80,
  }));
  // Catmull-Rom → cubic-bezier smoothing for a clean curve through the points.
  const at = (idx: number) => pts[Math.max(0, Math.min(pts.length - 1, idx))] ?? { x: 0, y: 90 };
  let line = `M${at(0).x.toFixed(2)} ${at(0).y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  const area = `${line} L100 100 L0 100 Z`;

  const usd0 = (n: number) => Math.round(n).toLocaleString('en-US');
  const onNum = (setter: (n: number) => void, max: number) => (txt: string) => {
    const digits = txt.replace(/\D/g, '');
    setter(Math.min(max, Number.parseInt(digits || '0', 10)));
  };
  const adjRate = (d: number) =>
    setCustomRate((r) => Math.max(0, Math.min(100, Number((r + d).toFixed(1)))));

  return (
    <>
      <NavHeader title={t('calc.title')} onBack={() => nav.go('earn')} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s8 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Projection card */}
        <View
          style={styles.proj}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setCardSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
          }}
        >
          {cardSize.w > 0 ? (
            <Svg style={styles.projBg} width={cardSize.w} height={cardSize.h}>
              <Defs>
                <LinearGradient
                  id="projBg"
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={cardSize.h}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0%" stopColor={color.purple2} stopOpacity={0.32} />
                  <Stop offset="100%" stopColor={color.purple} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={cardSize.w} height={cardSize.h} fill="url(#projBg)" />
            </Svg>
          ) : null}
          <Text style={styles.projK}>
            {t('calc.future')} · {termLabel}
          </Text>
          <View style={styles.projValRow}>
            <Text style={styles.projVal}>{formatUsdc(future, locale, false)}</Text>
            <Text style={styles.projUnit}>USDC</Text>
          </View>
          <View style={styles.projSub}>
            <Text style={styles.projGain}>+{formatUsdc(earned, locale, false)} USDC</Text>
            <Text style={styles.projDot}>·</Text>
            <Text style={styles.projTry}>≈ {formatLira(usdcToTry(future), locale)}</Text>
          </View>
          <View style={styles.spark}>
            <Svg width="100%" height={78} viewBox="0 0 100 100" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="calcGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={color.purple} stopOpacity={0.34} />
                  <Stop offset="100%" stopColor={color.purple} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={area} fill="url(#calcGrad)" />
              <Path
                d={line}
                stroke={color.purple}
                strokeWidth={2.5}
                fill="none"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          </View>
        </View>

        {/* Time frame */}
        <View style={styles.tabs}>
          {TERMS.map((tm) => {
            const on = termM === tm.m;
            return (
              <Pressable
                key={tm.m}
                onPress={() => setTermM(tm.m)}
                style={[styles.tab, on && styles.tabOn]}
                hitSlop={4}
              >
                <Text style={[styles.tabTxt, on && styles.tabTxtOn]}>
                  {t(`calc.${tm.k}` as Parameters<typeof t>[0])}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* FX caveat */}
        <View style={styles.fxNote}>
          <Icon name="info" size={15} stroke={color.amber} />
          <Text style={styles.fxNoteTxt}>{t('calc.fxNote')}</Text>
        </View>

        {/* Inputs */}
        <Text style={styles.secLabel}>{t('calc.adjust')}</Text>
        <View style={styles.fields}>
          <NumField
            icon="wallet"
            label={t('calc.startLbl')}
            value={usd0(start)}
            onChange={onNum(setStart, 100_000_000)}
            suffix="USDC"
            help={`≈ ${formatLira(usdcToTry(start), locale)}`}
          />
          <NumField
            icon="plus"
            label={t('calc.monthlyLbl')}
            value={usd0(monthly)}
            onChange={onNum(setMonthly, 10_000_000)}
            suffix={`USDC / ${t('calc.mo')}`}
            help={`≈ ${formatLira(usdcToTry(monthly), locale)}`}
          />
          <View style={styles.field}>
            <View style={styles.fieldLbl}>
              <Icon name="spark" size={14} stroke={color.inkDim} />
              <Text style={styles.fieldLblTxt}>{t('calc.rateFrom')}</Text>
            </View>
            <Pressable style={styles.src} onPress={() => setPicker(true)}>
              <View style={styles.srcLead}>
                <View style={[styles.srcDot, isCustom && styles.srcDotCustom]} />
                <View style={styles.flex}>
                  <Text style={styles.srcV}>{srcLabel}</Text>
                  <Text style={styles.srcK}>
                    {isCustom ? t('calc.customSub') : `${t('calc.live')} · ${t('calc.variable')}`}
                  </Text>
                </View>
              </View>
              <View style={styles.srcRate}>
                <Text style={styles.srcRateTxt}>~{formatPct(apy, locale)}</Text>
                <Icon name="chevR" size={16} stroke={color.inkFaint} />
              </View>
            </Pressable>
            {isCustom ? (
              <View style={styles.customRow}>
                <Text style={styles.customLbl}>{t('calc.customLbl')}</Text>
                <View style={styles.stepper}>
                  <Pressable onPress={() => adjRate(-0.5)} style={styles.stepBtn} hitSlop={6}>
                    <Text style={styles.stepTxt}>−</Text>
                  </Pressable>
                  <Text style={styles.stepVal}>{formatPct(customRate, locale)}</Text>
                  <Pressable onPress={() => adjRate(0.5)} style={styles.stepBtn} hitSlop={6}>
                    <Text style={styles.stepTxt}>+</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Breakdown */}
        <Text style={styles.secLabel}>{t('calc.breakdown')}</Text>
        <View style={styles.brk}>
          <BrkRow k={t('calc.bkStart')} usdc={start} locale={locale} />
          <BrkRow k={t('calc.bkAdded')} usdc={added} locale={locale} />
          <BrkRow k={t('calc.yield')} usdc={earned} locale={locale} green />
          <BrkRow k={t('calc.future')} usdc={future} locale={locale} total />
        </View>

        {/* Bank-vs-Sava reality check — real data, dollar terms */}
        <Text style={styles.secLabel}>{t('calc.cmpTitle')}</Text>
        <View style={styles.cmp}>
          <Text style={styles.cmpSub}>{t('calc.cmpSub')}</Text>
          <View style={styles.cmpBase}>
            <Text style={styles.cmpBaseK}>{t('calc.cmpBaseline')}</Text>
            <Text style={styles.cmpBaseV}>${usd0(cmp.startUsd)}</Text>
          </View>
          <CmpRow
            label={t('calc.cmpCash')}
            usd={cmp.cashUsd}
            pct={cmp.cashPct}
            hint={t('calc.cmpCashHint')}
          />
          <CmpRow
            label={t('calc.cmpBank')}
            usd={cmp.bankUsd}
            pct={cmp.bankPct}
            hint={t('calc.cmpBankHint')}
            nominal={t('calc.cmpBankNominal', { lira: formatLira(cmp.bankLiraNow, locale) })}
          />
          <CmpRow
            label={t('calc.cmpSava')}
            usd={cmp.savaUsd}
            pct={cmp.savaPct}
            hint={t('calc.cmpSavaHint')}
            positive
          />
          <View style={styles.cmpFoot}>
            <Text style={styles.cmpBankRate}>
              {t('calc.cmpVsBank')} ~{formatPct(CBRT_CURRENT_1Y_RATE * 100, locale)} ·{' '}
              {t('calc.cmpVsBankSub')}
            </Text>
            <Text style={styles.cmpSource}>{t('calc.cmpSource', { rate: usdTry.toFixed(2) })}</Text>
          </View>
        </View>

        <Text style={styles.projNote}>{t('calc.projNote')}</Text>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
        <Button iconName="earn" label={t('calc.openEarn')} onPress={() => nav.go('earn')} />
      </View>

      <Sheet visible={picker} onClose={() => setPicker(false)} title={t('calc.rateFrom')}>
        <View style={styles.pickList}>
          <Pressable
            style={[styles.pick, !isCustom && styles.pickOn]}
            onPress={() => {
              setSrc('live');
              setPicker(false);
            }}
          >
            <View style={styles.pickIc}>
              <Text style={styles.pickDollar}>$</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.pickName}>{vault?.name ?? 'USDC Core'}</Text>
              <Text style={styles.pickSub}>{t('calc.live')} · Blend</Text>
            </View>
            <Text style={styles.pickRate}>~{formatPct(vault?.apy ?? 0, locale)}</Text>
            {!isCustom ? <Icon name="check" size={15} stroke={color.green} /> : null}
          </Pressable>
          <Pressable
            style={[styles.pick, isCustom && styles.pickOn]}
            onPress={() => {
              setSrc('custom');
              setPicker(false);
            }}
          >
            <View style={[styles.pickIc, styles.pickIcCustom]}>
              <Icon name="calc" size={17} stroke={color.purple} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.pickName}>{t('calc.custom')}</Text>
              <Text style={styles.pickSub}>{t('calc.customSub')}</Text>
            </View>
            {isCustom ? <Icon name="check" size={15} stroke={color.green} /> : null}
          </Pressable>
        </View>
        <View style={styles.pickNote}>
          <Icon name="info" size={13} stroke={color.inkDim} />
          <Text style={styles.pickNoteTxt}>{t('calc.pickNote')}</Text>
        </View>
      </Sheet>
    </>
  );
}

function NumField({
  icon,
  label,
  value,
  onChange,
  suffix,
  help,
}: {
  icon: IconName;
  label: string;
  value: string;
  onChange: (txt: string) => void;
  suffix: string;
  help: string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLbl}>
        <Icon name={icon} size={14} stroke={color.inkDim} />
        <Text style={styles.fieldLblTxt}>{label}</Text>
      </View>
      <View style={styles.numBox}>
        <Text style={styles.numCur}>$</Text>
        <TextInput
          style={styles.numIn}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          selectionColor={color.purple}
        />
        <Text style={styles.numSuffix}>{suffix}</Text>
      </View>
      <View style={styles.numHelp}>
        <Icon name="earn" size={11} stroke={color.inkFaint} />
        <Text style={styles.numHelpTxt}>{help}</Text>
      </View>
    </View>
  );
}

function BrkRow({
  k,
  usdc,
  locale,
  green = false,
  total = false,
}: {
  k: string;
  usdc: number;
  locale: Locale;
  green?: boolean;
  total?: boolean;
}) {
  return (
    <View style={[styles.brkRow, !total && styles.brkBorder]}>
      <Text style={[styles.brkK, total && styles.brkKTotal]}>{k}</Text>
      <View style={styles.brkV}>
        <Text style={[styles.brkU, green && styles.brkUGreen, total && styles.brkUTotal]}>
          {green ? '+' : ''}
          {formatUsdc(usdc, locale, false)} USDC
        </Text>
        <Text style={styles.brkT}>≈ {formatLira(usdcToTry(usdc), locale)}</Text>
      </View>
    </View>
  );
}

function CmpRow({
  label,
  usd,
  pct,
  hint,
  nominal,
  positive = false,
}: {
  label: string;
  usd: number;
  pct: number;
  hint: string;
  nominal?: string;
  positive?: boolean;
}) {
  const up = pct >= 0;
  return (
    <View style={styles.cmpRow}>
      <View style={styles.cmpRowTop}>
        <Text style={styles.cmpLabel}>{label}</Text>
        <View style={styles.cmpRight}>
          <Text style={[styles.cmpUsd, positive && styles.cmpUsdPos]}>
            {positive ? '~' : ''}${Math.round(usd).toLocaleString('en-US')}
          </Text>
          <View style={[styles.cmpChip, up ? styles.cmpChipPos : styles.cmpChipNeg]}>
            <Text style={[styles.cmpChipTxt, up ? styles.cmpChipTxtPos : styles.cmpChipTxtNeg]}>
              {up ? '+' : ''}
              {Math.round(pct)}%
            </Text>
          </View>
        </View>
      </View>
      {nominal ? <Text style={styles.cmpNominal}>{nominal}</Text> : null}
      <Text style={styles.cmpHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, paddingTop: space.s2 },
  flex: { flex: 1 },

  cmp: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    padding: space.s4,
  },
  cmpSub: { ...type.caption, color: color.inkDim, lineHeight: 18 },
  cmpBase: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: space.s3,
    marginBottom: space.s2,
  },
  cmpBaseK: { ...type.micro, color: color.inkFaint, textTransform: 'uppercase', letterSpacing: 1 },
  cmpBaseV: { fontFamily: font.bold, fontSize: 16, color: color.ink },
  cmpRow: { borderTopWidth: 1, borderTopColor: color.hairSoft, paddingTop: 12, marginTop: 12 },
  cmpRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cmpLabel: { ...type.bodyStrong, fontSize: 14, color: color.ink, flex: 1 },
  cmpRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cmpUsd: { fontFamily: font.extraBold, fontSize: 18, color: color.red },
  cmpUsdPos: { color: color.green },
  cmpChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    minWidth: 44,
    alignItems: 'center',
  },
  cmpChipNeg: { backgroundColor: color.redSoft },
  cmpChipPos: { backgroundColor: color.greenSoft },
  cmpChipTxt: { fontFamily: font.bold, fontSize: 11.5 },
  cmpChipTxtNeg: { color: color.red },
  cmpChipTxtPos: { color: color.green },
  cmpNominal: { fontFamily: font.mono, fontSize: 11.5, color: color.inkFaint, marginTop: 3 },
  cmpHint: { ...type.micro, color: color.inkDim, marginTop: 4, lineHeight: 15 },
  cmpFoot: { marginTop: space.s4, gap: 4 },
  cmpBankRate: { ...type.micro, fontFamily: font.semiBold, color: color.inkDim },
  cmpSource: { ...type.micro, color: color.inkFaint, lineHeight: 14 },

  proj: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.purpleBd,
    borderRadius: radius.lg,
    padding: space.s5,
    marginTop: space.s2,
    overflow: 'hidden',
  },
  projBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  projK: {
    ...type.label,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  projValRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: space.s2 },
  projVal: {
    fontFamily: font.extraBold,
    fontSize: 36,
    color: color.ink,
    letterSpacing: -1,
  },
  projUnit: { fontFamily: font.bold, fontSize: 22, color: color.inkDim, marginLeft: 9 },
  projSub: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  projGain: { fontFamily: font.bold, fontSize: 13.5, color: color.green },
  projDot: { ...type.body, color: color.inkFaint },
  projTry: { fontFamily: font.mono, fontSize: 12.5, color: color.inkDim },
  spark: { marginTop: space.s4, height: 78, marginHorizontal: -space.s5, marginBottom: -space.s5 },

  tabs: { flexDirection: 'row', gap: 6, marginTop: space.s4 },
  tab: {
    flex: 1,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
  },
  tabOn: { backgroundColor: color.surface2, borderColor: color.purpleBd },
  tabTxt: { ...type.micro, fontFamily: font.semiBold, color: color.inkFaint },
  tabTxtOn: { color: color.ink },

  fxNote: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    backgroundColor: color.amberSoft,
    borderWidth: 1,
    borderColor: color.amberBd,
    borderRadius: radius.md,
    padding: space.s3,
    marginTop: space.s4,
  },
  fxNoteTxt: { ...type.caption, color: color.amber, flex: 1, lineHeight: 18 },

  secLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginTop: space.s6,
    marginBottom: space.s3,
  },
  fields: { gap: space.s4 },
  field: {},
  fieldLbl: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: space.s2 },
  fieldLblTxt: { ...type.caption, color: color.inkDim, fontFamily: font.semiBold },
  numBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
    height: 54,
  },
  numCur: { fontFamily: font.bold, fontSize: 18, color: color.inkFaint, marginRight: 6 },
  numIn: { flex: 1, fontFamily: font.extraBold, fontSize: 20, color: color.ink, padding: 0 },
  numSuffix: { fontFamily: font.semiBold, fontSize: 12.5, color: color.inkFaint },
  numHelp: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  numHelpTxt: { fontFamily: font.mono, fontSize: 11.5, color: color.inkFaint },

  src: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
    height: 60,
  },
  srcLead: { flexDirection: 'row', alignItems: 'center', gap: space.s3, flex: 1 },
  srcDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.green },
  srcDotCustom: { backgroundColor: color.purple },
  srcV: { ...type.bodyStrong, fontSize: 14.5, color: color.ink },
  srcK: { ...type.micro, color: color.inkFaint, marginTop: 2 },
  srcRate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  srcRateTxt: { fontFamily: font.bold, fontSize: 14, color: color.green },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.s3,
  },
  customLbl: { ...type.caption, color: color.inkDim },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.pill,
  },
  stepBtn: { width: 38, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontFamily: font.bold, fontSize: 20, color: color.purple },
  stepVal: {
    fontFamily: font.bold,
    fontSize: 14,
    color: color.ink,
    minWidth: 52,
    textAlign: 'center',
  },

  brk: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
  },
  brkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    gap: space.s4,
  },
  brkBorder: { borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  brkK: { ...type.body, color: color.inkDim },
  brkKTotal: { fontFamily: font.bold, color: color.ink },
  brkV: { alignItems: 'flex-end' },
  brkU: { fontFamily: font.bold, fontSize: 14, color: color.ink },
  brkUGreen: { color: color.green },
  brkUTotal: { fontSize: 15.5, color: color.ink },
  brkT: { fontFamily: font.mono, fontSize: 11, color: color.inkFaint, marginTop: 2 },

  projNote: { ...type.micro, color: color.inkFaint, marginTop: space.s3, lineHeight: 16 },

  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
  },

  pickList: { gap: space.s2 },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    padding: space.s3,
  },
  pickOn: { borderColor: color.purpleBd, backgroundColor: color.surface2 },
  pickIc: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: color.usdcSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickIcCustom: { backgroundColor: color.purpleSoft },
  pickDollar: { fontFamily: font.extraBold, fontSize: 16, color: color.usdc },
  pickName: { ...type.bodyStrong, fontSize: 14.5, color: color.ink },
  pickSub: { ...type.micro, color: color.inkFaint, marginTop: 2 },
  pickRate: { fontFamily: font.bold, fontSize: 14, color: color.green },
  pickNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: space.s3 },
  pickNoteTxt: { ...type.micro, color: color.inkFaint, flex: 1, lineHeight: 16 },
});
