import { color, font, space, type } from '@getsava/ui';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatPct, useTranslation } from '../../i18n';
import { NETWORK } from '../../lib/network';
import { useVault } from '../../lib/useVault';
import { useNav } from '../../nav';
import { Button, Icon, NavHeader, Notice, UsdcMark } from '../../ui';
import {
  BreakdownBar,
  LearnCard,
  LearnSheet,
  PoolStats,
  RateChart,
  StatusPill,
  Vpos,
} from '../../ui/vault-bits';

/**
 * Blend v2 USDC pool contract — the vault Sava supplies into. Public, well-known
 * testnet/mainnet contract address (not a secret); used only to build the read-only
 * Stellar Expert explorer link for the pool.
 */
const POOL = 'CAPBMXIQTICKWFPWFDJWMAKBXBPJZUKLNONQH3MLPLLBKQ643CYN5PRW';

function stellarExpertPoolUrl(): string {
  return `https://stellar.expert/explorer/${NETWORK}/contract/${POOL}`;
}

/**
 * Synthesize a gentle illustrative APY series around the live rate. There is no
 * history API yet, so this is purely a visual hint of stability (the rate is
 * always qualified as variable).
 */
function apySeries(apy: number): number[] {
  const wobble = [-0.04, 0.03, -0.02, 0.05, -0.01, 0.04, -0.03, 0.06, 0.0, 0.05];
  return wobble.map((d) => Math.max(0, apy + d));
}

export function VaultDetailScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { vault } = useVault();

  const [learnOpen, setLearnOpen] = useState(false);

  if (vault === null) {
    return (
      <>
        <NavHeader title="" onBack={() => nav.back()} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.purple} />
        </View>
      </>
    );
  }

  const values = apySeries(vault.apy);

  return (
    <>
      <NavHeader title="" onBack={() => nav.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s8 }]}
      >
        {/* Identity */}
        <View style={styles.head}>
          <UsdcMark size={40} />
          <View style={styles.headText}>
            <Text style={styles.name}>{vault.name}</Text>
            <View style={styles.vetted}>
              <Icon name="shield" size={12} stroke={color.green} />
              <Text style={styles.vettedText}>{t('vault.vetted')}</Text>
            </View>
          </View>
          <StatusPill status={vault.status} />
        </View>

        {/* Supply APY hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t('vault.supplyApy')}</Text>
          <Text style={styles.heroRate}>{formatPct(vault.apy, locale)}</Text>
          <View style={styles.heroQual}>
            <Icon name="info" size={12} stroke={color.amber} />
            <Text style={styles.heroQualText}>{t('risk.variableFull')}</Text>
          </View>
        </View>

        {/* Illustrative rate chart */}
        <View style={styles.chart}>
          <RateChart values={values} up height={120} />
          <Text style={styles.chartNote}>{t('vault.past30')}</Text>
        </View>

        {/* APY composition */}
        <BreakdownBar basePct={vault.apy} rewardsPct={0} />
        <Text style={styles.bdNote}>{t('activity.variableNote')}</Text>

        {/* Paused */}
        {vault.paused ? (
          <View style={styles.block}>
            <Notice
              tone="amber"
              icon="lock"
              title={t('earn.pausedTitle')}
              body={t('earn.pausedBody')}
            />
          </View>
        ) : null}

        {/* Your position */}
        {vault.supplied ? (
          <>
            <Text style={styles.secLabel}>{t('vault.yourPosition')}</Text>
            <Vpos valueUsdc={vault.suppliedUsdc} yieldUsdc={vault.yieldUsdc} apy={vault.apy} />
          </>
        ) : null}

        {/* Before you supply */}
        <View style={styles.block}>
          <LearnCard onPress={() => setLearnOpen(true)} />
        </View>

        {/* Pool stats */}
        <Text style={styles.secLabel}>{t('vault.poolStats')}</Text>
        <PoolStats
          poolSizeUsdc={vault.tvlUsdc}
          utilization={vault.utilization}
          supplyApy={vault.apy}
          borrowApy={vault.apr}
          status={vault.status}
          onExplorer={() => WebBrowser.openBrowserAsync(stellarExpertPoolUrl())}
        />
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
        {vault.supplied ? (
          <View style={styles.rowBtns}>
            <View style={styles.flex}>
              <Button
                variant="ghost"
                label={t('vault.withdraw')}
                onPress={() => nav.push('vaultWithdraw')}
              />
            </View>
            <View style={styles.flex}>
              <Button
                iconName="earn"
                label={t('vault.supply')}
                disabled={vault.paused}
                onPress={() => nav.push('supply')}
              />
            </View>
          </View>
        ) : (
          <Button
            iconName="earn"
            label={t('vault.supply')}
            disabled={vault.paused}
            onPress={() => nav.push('supply')}
          />
        )}
      </View>

      <LearnSheet
        visible={learnOpen}
        onClose={() => setLearnOpen(false)}
        onSupply={() => {
          setLearnOpen(false);
          nav.push('supply');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingTop: space.s2,
    paddingBottom: space.s4,
  },
  headText: { flex: 1 },
  name: { ...type.h2, fontSize: 20, color: color.ink },
  vetted: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginTop: 3 },
  vettedText: { ...type.caption, color: color.inkDim },
  hero: { alignItems: 'center', paddingTop: space.s5, paddingBottom: space.s4 },
  heroLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  heroRate: {
    fontFamily: font.extraBold,
    fontSize: 52,
    color: color.green,
    letterSpacing: -1.5,
    marginTop: space.s2,
  },
  heroQual: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginTop: space.s2 },
  heroQualText: { ...type.caption, color: color.amber },
  chart: { marginBottom: space.s5 },
  chartNote: {
    ...type.caption,
    color: color.inkFaint,
    textAlign: 'center',
    marginTop: space.s2,
  },
  bdNote: {
    ...type.caption,
    color: color.inkFaint,
    marginTop: space.s3,
    lineHeight: 18,
  },
  block: { marginTop: space.s4 },
  secLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginTop: space.s6,
    marginBottom: space.s3,
  },
  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
  },
  rowBtns: { flexDirection: 'row', gap: space.s3 },
  flex: { flex: 1 },
});
