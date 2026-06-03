import { color, font, radius, space, type } from '@getsava/ui';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '../../auth';
import type { Locale } from '../../i18n';
import { formatLira, formatPct, formatUsdc, liraParts, useTranslation } from '../../i18n';
import { usdcToTry } from '../../lib/fx';
import { useBalances } from '../../lib/useBalances';
import { usePosition } from '../../lib/usePosition';
import { useNav } from '../../nav';
import { Icon, Notice } from '../../ui';

/** Indicative pool rate shown on the "start earning" nudge (live APY is D3/T2). */
const POOL_RATE = 8;

function HeroBalance({ value, isUsd, locale }: { value: number; isUsd: boolean; locale: Locale }) {
  if (isUsd) {
    const s = formatUsdc(value, locale, false);
    const i = s.lastIndexOf('.');
    return (
      <Text style={styles.hero}>
        <Text style={styles.heroNum}>{s.slice(0, i)}</Text>
        <Text style={styles.heroDec}>{s.slice(i)}</Text>
        <Text style={styles.heroSufUsd}> USDC</Text>
      </Text>
    );
  }
  const p = liraParts(value, locale);
  return (
    <Text style={styles.hero}>
      {p.pre ? <Text style={styles.heroSym}>{p.pre}</Text> : null}
      <Text style={styles.heroNum}>{p.int}</Text>
      <Text style={styles.heroDec}>
        {p.sep}
        {p.dec}
      </Text>
      {p.suf ? <Text style={styles.heroSym}> {p.suf}</Text> : null}
    </Text>
  );
}

export function HomeScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const email = useWalletStore((s) => s.email);
  const { balances, loading, error, refresh } = useBalances();
  const position = usePosition();

  const idle = Number.parseFloat(balances.usdc || '0');
  const supplied = position?.suppliedUsdc ?? 0;
  const yieldUsdc = position?.yieldUsdc ?? 0;
  const totalUsdc = idle + supplied;
  const rate = position?.rate ?? POOL_RATE;
  const earning = position !== null;
  const hasYield = earning && yieldUsdc > 0;

  const isUsd = nav.cur === 'usd';
  const total = isUsd ? totalUsdc : usdcToTry(totalUsdc);
  const initials = (email?.slice(0, 2) ?? 'sa').toUpperCase();

  return (
    <>
      <View style={styles.header}>
        <Pressable
          style={styles.avatar}
          onPress={() => nav.go('settings')}
          accessibilityLabel="settings"
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </Pressable>
        <Text style={styles.wordmark}>
          sa<Text style={styles.wordmarkV}>v</Text>a
        </Text>
        <Pressable
          style={styles.avatar}
          onPress={() => nav.push('activity')}
          accessibilityLabel="activity"
        >
          <Icon name="clock" size={18} stroke={color.inkDim} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s6 }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.inkDim} />
        }
      >
        {/* hero */}
        <View style={styles.heroWrap}>
          {earning ? (
            <Pressable
              style={[styles.ratePill, styles.ratePillEarn]}
              onPress={() => nav.go('earn')}
            >
              <Icon name="spark" size={14} stroke={color.green} />
              <Text style={styles.ratePillEarnText}>
                {t('home.earning')} ~{formatPct(rate, locale)}
              </Text>
              <Text style={styles.rpVar}>{t('common.variable')}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.ratePill} onPress={() => nav.openSheet('addFunds')}>
              <Icon name="spark" size={14} stroke={color.inkDim} />
              <Text style={styles.ratePillText}>
                {t('home.startEarning', { rate: formatPct(rate, locale) })}
              </Text>
            </Pressable>
          )}

          <Pressable onPress={() => nav.setCur(isUsd ? 'try' : 'usd')}>
            <HeroBalance value={total} isUsd={isUsd} locale={locale} />
          </Pressable>

          {hasYield ? (
            <View style={styles.earnedLine}>
              <View style={styles.greenDot} />
              <Text style={styles.earnedAmt}>+{formatLira(usdcToTry(yieldUsdc), locale)}</Text>
              <Text style={styles.earnedPer}>{t('home.earnedSuffix')}</Text>
            </View>
          ) : (
            <Text style={styles.held}>{t('home.heldInUsdc')}</Text>
          )}

          <View style={styles.curPills}>
            <Pressable
              style={[styles.curPill, !isUsd && styles.curPillOn]}
              onPress={() => nav.setCur('try')}
            >
              <Text style={[styles.curPillText, !isUsd && styles.curPillTextOn]}>₺ TRY</Text>
            </Pressable>
            <Pressable
              style={[styles.curPill, isUsd && styles.curPillOn]}
              onPress={() => nav.setCur('usd')}
            >
              <Text style={[styles.curPillText, isUsd && styles.curPillTextOnUsd]}>USDC</Text>
            </Pressable>
          </View>
        </View>

        {/* actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.action, styles.actionPrimary]}
            onPress={() => nav.openSheet('addFunds')}
          >
            <Icon name="plus" size={17} stroke={color.purpleInk} />
            <Text style={[styles.actionText, styles.actionTextPrimary]}>{t('home.add')}</Text>
          </Pressable>
          <Pressable
            style={[styles.action, idle <= 1e-7 && styles.actionDisabled]}
            disabled={idle <= 1e-7}
            onPress={() => nav.push('send')}
          >
            <Icon name="arrowUp" size={17} />
            <Text style={styles.actionText}>{t('home.withdraw')}</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => nav.go('earn')}>
            <Icon name="earn" size={17} />
            <Text style={styles.actionText}>{t('home.earn')}</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={{ marginTop: space.s5 }}>
            <Notice tone="red" icon="alert" title={t('home.errTitle')} body={t('home.errBody')} />
          </View>
        ) : null}

        {/* your money — always shows the wallet row; vault row only when supplied */}
        <View style={styles.sec}>
          <Text style={styles.secLabel}>{t('home.yourMoney')}</Text>
        </View>
        <View style={styles.mlist}>
          <Pressable style={styles.mrow} onPress={() => nav.openSheet('addFunds')}>
            <View style={[styles.mrowIc, styles.mrowIcWallet]}>
              <Icon name="wallet" size={19} stroke={color.inkDim} />
            </View>
            <View style={styles.mrowMid}>
              <Text style={styles.mrowName}>{t('home.inWallet')}</Text>
              <Text style={styles.mrowSub}>{t('home.inWalletSub')}</Text>
            </View>
            <View style={styles.mrowRight}>
              <Text style={styles.mrowVal}>{formatLira(usdcToTry(idle), locale)}</Text>
              <Text style={styles.mrowValSub}>{formatUsdc(idle, locale)}</Text>
            </View>
          </Pressable>

          {position ? (
            <Pressable style={[styles.mrow, styles.mrowLast]} onPress={() => nav.go('earn')}>
              <View style={[styles.mrowIc, styles.mrowIcVault]}>
                <Icon name="vault" size={22} stroke={color.purple} />
              </View>
              <View style={styles.mrowMid}>
                <Text style={styles.mrowName}>{position.vaultName}</Text>
                <View style={styles.mrowSubRow}>
                  <View style={styles.greenDotSmall} />
                  <Text style={styles.mrowSubV}>
                    {t('home.earning')} ~{formatPct(position.rate, locale)} ·{' '}
                    <Text style={styles.varInline}>{t('common.variable')}</Text>
                  </Text>
                </View>
              </View>
              <View style={styles.mrowRight}>
                <Text style={styles.mrowVal}>{formatLira(usdcToTry(supplied), locale)}</Text>
                <Text style={styles.mrowValSubG}>+{formatLira(usdcToTry(yieldUsdc), locale)}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    paddingHorizontal: space.gutter,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.label, color: color.inkDim },
  wordmark: { ...type.h2, fontSize: 19, color: color.ink },
  wordmarkV: { color: color.purple },
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter },

  heroWrap: { alignItems: 'center', paddingTop: space.s4 },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  ratePillEarn: { backgroundColor: color.greenSoft, borderColor: 'rgba(88, 218, 152, 0.22)' },
  ratePillText: { fontFamily: font.bold, fontSize: 13.5, color: color.inkDim },
  ratePillEarnText: { fontFamily: font.bold, fontSize: 13.5, color: color.green },
  rpVar: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: color.amber,
    paddingLeft: 7,
    marginLeft: 3,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.14)',
  },
  hero: { marginTop: 18, textAlign: 'center' },
  heroNum: { fontFamily: font.extraBold, fontSize: 54, color: color.ink, letterSpacing: -2 },
  heroDec: { fontFamily: font.extraBold, fontSize: 54, color: color.inkFaint, letterSpacing: -2 },
  heroSym: { fontFamily: font.semiBold, fontSize: 32, color: color.inkDim },
  heroSufUsd: { fontFamily: font.semiBold, fontSize: 26, color: color.inkDim },
  earnedLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  earnedAmt: { fontFamily: font.bold, fontSize: 15, color: color.green },
  earnedPer: { fontFamily: font.medium, fontSize: 15, color: color.inkFaint },
  held: { ...type.body, fontSize: 15, color: color.inkFaint, marginTop: 16 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.green },
  curPills: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.pill,
    padding: 3,
    marginTop: 18,
  },
  curPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill },
  curPillOn: { backgroundColor: color.surface2 },
  curPillText: { fontFamily: font.bold, fontSize: 12.5, color: color.inkFaint },
  curPillTextOn: { color: color.ink },
  curPillTextOnUsd: { color: color.purple },

  actions: { flexDirection: 'row', gap: 8, marginTop: space.s6 },
  action: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionPrimary: { backgroundColor: color.purple, borderColor: color.purple },
  actionDisabled: { opacity: 0.4 },
  actionText: { fontFamily: font.bold, fontSize: 13.5, color: color.ink },
  actionTextPrimary: { color: color.purpleInk },

  sec: { marginTop: space.s7, marginBottom: space.s3 },
  secLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  mlist: { marginTop: space.s1 },
  mrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: color.hairSoft,
  },
  mrowLast: { borderBottomWidth: 0 },
  mrowIc: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mrowIcWallet: { backgroundColor: color.surface2 },
  mrowIcVault: { backgroundColor: color.purpleSoft },
  mrowMid: { flex: 1 },
  mrowName: { fontFamily: font.semiBold, fontSize: 15, color: color.ink },
  mrowSub: { fontFamily: font.regular, fontSize: 12.5, color: color.inkFaint, marginTop: 3 },
  mrowSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  mrowSubV: { fontFamily: font.regular, fontSize: 12.5, color: color.inkFaint },
  greenDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.green },
  varInline: { color: color.amber },
  mrowRight: { alignItems: 'flex-end', gap: 3 },
  mrowVal: { fontFamily: font.bold, fontSize: 15.5, color: color.ink },
  mrowValSub: { fontFamily: font.mono, fontSize: 11.5, color: color.inkFaint },
  mrowValSubG: { fontFamily: font.mono, fontSize: 11.5, color: color.green },
});
