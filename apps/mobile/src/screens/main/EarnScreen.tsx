import { color, font, radius, space, type } from '@getsava/ui';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLira, formatPct, useTranslation } from '../../i18n';
import { usdcToTry } from '../../lib/fx';
import { useVault } from '../../lib/useVault';
import { useNav } from '../../nav';
import { Icon, Notice } from '../../ui';
import { Vrow } from '../../ui/vault-bits';

/**
 * Earn tab (YK-571). A tab root — no NavHeader/back; starts with an app title
 * row like HomeScreen. Lists the single USDC vault: a "Total earning" hero when
 * the user holds a position, then "Your vaults" and "Explore vaults" sections.
 */
export function EarnScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { vault, loading, error, refresh } = useVault();

  const held = vault?.supplied ?? false;
  const openVault = () => nav.push('vault');

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{t('earn.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s6 }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={color.inkDim} />
        }
      >
        {error ? (
          <View style={styles.errWrap}>
            <Notice tone="red" icon="alert" title={t('earn.errTitle')} body={t('earn.errBody')} />
          </View>
        ) : !vault && loading ? (
          <View style={styles.loadWrap}>
            <ActivityIndicator color={color.inkDim} />
          </View>
        ) : vault ? (
          <>
            {held ? (
              <View style={styles.hero}>
                <Text style={styles.heroValue}>
                  {formatLira(usdcToTry(vault.suppliedUsdc), locale)}
                </Text>
                <View style={styles.heroSub}>
                  <View style={styles.greenDot} />
                  <Text style={styles.heroYield}>
                    +{formatLira(usdcToTry(vault.yieldUsdc), locale)}
                  </Text>
                  <Text style={styles.heroDot}>·</Text>
                  <Text style={styles.heroApy}>
                    ~{formatPct(vault.apy, locale)} {t('earn.avgVariable')}
                  </Text>
                </View>
              </View>
            ) : null}

            {vault.paused ? (
              <View style={held ? styles.noticeAfterHero : styles.noticeTop}>
                <Notice
                  tone="amber"
                  icon="lock"
                  title={t('earn.pausedTitle')}
                  body={t('earn.pausedBody')}
                />
              </View>
            ) : null}

            {/* Yield-calculator entry */}
            <Pressable style={styles.calcBanner} onPress={() => nav.push('calculator')}>
              <View style={styles.calcIc}>
                <Icon name="calc" size={20} stroke={color.purpleInk} />
              </View>
              <View style={styles.calcTx}>
                <Text style={styles.calcT}>{t('calc.bannerT')}</Text>
                <Text style={styles.calcD}>{t('calc.bannerD')}</Text>
              </View>
              <Icon name="chevR" size={18} stroke={color.purple} />
            </Pressable>

            {held ? (
              <>
                <View style={styles.sec}>
                  <Text style={styles.secLabel}>{t('earn.yourVaults')}</Text>
                </View>
                <Vrow
                  name={vault.name}
                  apy={vault.apy}
                  risk={vault.risk}
                  poolSizeUsdc={vault.tvlUsdc}
                  onPress={openVault}
                  held
                  yourValueUsdc={vault.suppliedUsdc}
                  paused={vault.paused}
                />
              </>
            ) : null}

            {held ? null : (
              <>
                <View style={styles.sec}>
                  <Text style={styles.secLabel}>{t('earn.explore')}</Text>
                </View>
                <Text style={styles.exploreSub}>{t('earn.exploreSub')}</Text>
                <Vrow
                  name={vault.name}
                  apy={vault.apy}
                  risk={vault.risk}
                  poolSizeUsdc={vault.tvlUsdc}
                  onPress={openVault}
                  held={false}
                />
              </>
            )}

            <View style={styles.footNote}>
              <Icon name="info" size={12} stroke={color.inkFaint} />
              <Text style={styles.footText}>{t('earn.todayNote')}</Text>
            </View>
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
    height: 42,
    paddingHorizontal: space.gutter,
  },
  title: { ...type.h2, fontSize: 17, color: color.ink },
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter, paddingTop: space.s1 },

  loadWrap: { paddingTop: space.s8, alignItems: 'center' },
  errWrap: { marginTop: space.s2 },

  hero: { marginTop: 0 },
  heroValue: {
    fontFamily: font.extraBold,
    fontSize: 36,
    color: color.ink,
    letterSpacing: -0.5,
  },
  heroSub: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.green },
  heroYield: { fontFamily: font.bold, fontSize: 13.5, color: color.green },
  heroDot: { ...type.body, color: color.inkFaint },
  heroApy: { fontFamily: font.medium, fontSize: 13, color: color.inkDim },

  noticeTop: { marginTop: space.s2 },
  noticeAfterHero: { marginTop: space.s4 },

  calcBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    backgroundColor: color.purpleSoft,
    borderWidth: 1,
    borderColor: color.purpleBd,
    borderRadius: radius.md,
    padding: space.s3,
    marginTop: space.s4,
  },
  calcIc: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcTx: { flex: 1 },
  calcT: { ...type.bodyStrong, fontSize: 14.5, color: color.ink },
  calcD: { ...type.caption, color: color.inkDim, marginTop: 2 },

  sec: { marginTop: space.s6, marginBottom: space.s3 },
  secLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  exploreSub: {
    ...type.caption,
    color: color.inkFaint,
    lineHeight: 18,
    marginTop: -space.s1,
    marginBottom: space.s3,
  },

  footNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.s4 },
  footText: { ...type.caption, color: color.inkFaint },
});
