import { color, font, radius, space, type } from '@getsava/ui';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '../../auth';
import { formatLira, formatPct, formatUsdc, liraParts, useTranslation } from '../../i18n';
import { usdcToTry } from '../../lib/fx';
import { useBalances } from '../../lib/useBalances';
import { useNav } from '../../nav';
import { Icon, Notice } from '../../ui';

/** Indicative pool rate shown on the "start earning" nudge (live APY is D3/T2). */
const POOL_RATE = 8;

function HeroBalance({
  value,
  isUsd,
  locale,
}: {
  value: number;
  isUsd: boolean;
  locale: 'en' | 'tr';
}) {
  if (isUsd) {
    const s = formatUsdc(value, locale, false);
    const i = s.lastIndexOf('.');
    return (
      <Text style={styles.hero}>
        <Text style={styles.heroNum}>{s.slice(0, i)}</Text>
        <Text style={styles.heroDec}>{s.slice(i)}</Text>
        <Text style={styles.heroSuf}> USDC</Text>
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
      {p.suf ? <Text style={styles.heroSuf}> {p.suf}</Text> : null}
    </Text>
  );
}

export function HomeScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const email = useWalletStore((s) => s.email);
  const { balances, loading, error, refresh } = useBalances();

  const idle = Number.parseFloat(balances.usdc || '0');
  const hasMoney = idle > 1e-7;
  const isUsd = nav.cur === 'usd';
  const total = isUsd ? idle : usdcToTry(idle);
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
          <Pressable style={styles.ratePill} onPress={() => nav.openSheet('addFunds')}>
            <Icon name="spark" size={14} stroke={color.inkDim} />
            <Text style={styles.ratePillText}>
              {t('home.startEarning', { rate: formatPct(POOL_RATE, locale) })}
            </Text>
          </Pressable>

          <Pressable onPress={() => nav.setCur(isUsd ? 'try' : 'usd')}>
            <HeroBalance value={total} isUsd={isUsd} locale={locale} />
          </Pressable>

          <Text style={styles.held}>{t('home.heldInUsdc')}</Text>

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
            style={[styles.action, !hasMoney && styles.actionDisabled]}
            disabled={!hasMoney}
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

        {/* your money */}
        {hasMoney ? (
          <>
            <View style={styles.sec}>
              <Text style={styles.secLabel}>{t('home.yourMoney')}</Text>
            </View>
            <Pressable style={styles.mrow} onPress={() => nav.openSheet('addFunds')}>
              <View style={styles.mrowIc}>
                <Icon name="wallet" size={19} />
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
          </>
        ) : null}
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

  heroWrap: { alignItems: 'center', paddingTop: space.s5 },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  ratePillText: { ...type.caption, color: color.inkDim, fontFamily: font.semiBold },
  hero: { marginTop: space.s5, textAlign: 'center' },
  heroNum: { fontFamily: font.extraBold, fontSize: 47, color: color.ink, letterSpacing: -1 },
  heroDec: { fontFamily: font.extraBold, fontSize: 47, color: color.inkFaint, letterSpacing: -1 },
  heroSym: { fontFamily: font.semiBold, fontSize: 28, color: color.inkDim },
  heroSuf: { fontFamily: font.semiBold, fontSize: 22, color: color.inkDim },
  held: { ...type.body, color: color.inkDim, marginTop: 10 },
  curPills: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: 9,
    padding: 2,
    marginTop: space.s4,
  },
  curPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  curPillOn: { backgroundColor: color.surface2 },
  curPillText: { ...type.label, color: color.inkFaint },
  curPillTextOn: { color: color.ink },
  curPillTextOnUsd: { color: color.green },

  actions: { flexDirection: 'row', gap: 10, marginTop: space.s6 },
  action: {
    flex: 1,
    height: 46,
    borderRadius: 11,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.hair,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionPrimary: { backgroundColor: color.purple, borderColor: 'transparent' },
  actionDisabled: { opacity: 0.38 },
  actionText: { ...type.bodyStrong, fontSize: 14.5, color: color.ink },
  actionTextPrimary: { color: color.purpleInk },

  sec: { marginTop: space.s7, marginBottom: space.s3 },
  secLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  mrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 8,
  },
  mrowIc: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mrowMid: { flex: 1 },
  mrowName: { ...type.bodyStrong, fontSize: 15, color: color.ink },
  mrowSub: { ...type.caption, color: color.inkFaint, marginTop: 2 },
  mrowRight: { alignItems: 'flex-end' },
  mrowVal: { ...type.bodyStrong, fontSize: 15, color: color.ink },
  mrowValSub: { fontFamily: font.mono, fontSize: 12, color: color.inkFaint, marginTop: 2 },
});
