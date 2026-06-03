import { color, font, radius, space, type } from '@getsava/ui';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useWalletStore } from '../../auth';
import { useSignRawHash } from '../../auth/privy-hooks';
import { stubBackendClient } from '../../backend/client';
import { formatLira, formatUsdc, useTranslation } from '../../i18n';
import { bridgeEnabled, deliverDeposit } from '../../lib/bridge';
import { buildMercuryoPreviewUrl, mercuryoConfigured } from '../../lib/mercuryo';
import { useNav } from '../../nav';
import { Button, Icon, NavHeader } from '../../ui';

function shortAddr(a: string): string {
  return a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;
}

/**
 * Mercuryo payment step.
 *
 * Real widget (EXPO_PUBLIC_MERCURYO_WIDGET_ID set): a WebView loads Mercuryo's
 * hosted widget. Otherwise — the D2 demo — a mock card-checkout screen, clearly
 * marked TEST MODE. Either way "Pay" runs the testnet bridge (treasury buys USDC
 * with XLM on the DEX → user) so the deposit arrives on-chain with a real hash.
 */
export function MercuryoScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const address = useWalletStore((s) => s.address) ?? '';
  const { signRawHash } = useSignRawHash();
  const [busy, setBusy] = useState(false);
  const [failedWidget, setFailedWidget] = useState(false);

  const params = nav.stackTop?.params ?? {};
  const orderId = String(params.orderId ?? '');
  const amountTry = Number(params.amountTry ?? 0);
  const expectedUsdc = String(params.expectedUsdc ?? '0');

  const onPay = async () => {
    setBusy(true);
    try {
      if (bridgeEnabled() && address) {
        const hash = await deliverDeposit({
          userAddress: address,
          amountUsdc: expectedUsdc,
          signRawHash,
          orderId,
        });
        await stubBackendClient.settleOrder(orderId, hash);
      } else {
        await stubBackendClient.simulatePayment(orderId);
      }
      nav.replace('order', { orderId });
    } catch {
      await stubBackendClient.failOrder(orderId);
      nav.replace('order', { orderId });
    } finally {
      setBusy(false);
    }
  };

  const dock = (label: string) => (
    <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
      <Button label={label} onPress={onPay} loading={busy} />
      <View style={styles.poweredRow}>
        <Icon name="locksmall" size={11} stroke={color.inkFaint} />
        <Text style={styles.powered}>{t('mercuryo.powered')}</Text>
      </View>
    </View>
  );

  // ---- Real hosted widget ----
  if (mercuryoConfigured() && !failedWidget) {
    return (
      <>
        <NavHeader title={t('mercuryo.title')} subtitle="Mercuryo" center onBack={nav.back} />
        <View style={styles.webBody}>
          <WebView
            source={{ uri: buildMercuryoPreviewUrl({ amountTry: String(amountTry), orderId }) }}
            style={styles.web}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            onError={() => setFailedWidget(true)}
            onHttpError={(e) => {
              const { statusCode, url } = e.nativeEvent;
              if (statusCode >= 400 && /mrcr\.io|mercuryo/.test(url)) {
                setFailedWidget(true);
              }
            }}
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={color.purple} />
                <Text style={styles.loadingText}>{t('mercuryo.loading')}</Text>
              </View>
            )}
          />
        </View>
        {dock(t('mercuryo.simulate'))}
      </>
    );
  }

  if (busy) {
    return (
      <>
        <NavHeader title={t('mercuryo.title')} subtitle="Mercuryo" center onBack={nav.back} />
        <View style={styles.processing}>
          <ActivityIndicator color={color.purple} size="large" />
          <Text style={styles.processingTitle}>{t('mercuryo.processing')}</Text>
          <Text style={styles.processingSub}>{t('mercuryo.processingSub')}</Text>
        </View>
        {dock(`${t('mercuryo.pay')} ${formatLira(amountTry, locale)}`)}
      </>
    );
  }

  // ---- Mock card checkout (D2 demo) ----
  return (
    <>
      <NavHeader title={t('mercuryo.title')} subtitle="Mercuryo" center onBack={nav.back} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.testBanner}>
          <Icon name="info" size={15} stroke={color.amber} />
          <Text style={styles.testBannerText}>{t('mercuryo.testMode')}</Text>
        </View>

        <View style={styles.summary}>
          <Text style={styles.sumLabel}>{t('mercuryo.youPay')}</Text>
          <Text style={styles.sumAmount}>{formatLira(amountTry, locale)}</Text>
          <View style={styles.sumDivider} />
          <View style={styles.sumRow}>
            <Text style={styles.sumK}>{t('mercuryo.youGet')}</Text>
            <Text style={styles.sumVGreen}>≈ {formatUsdc(Number(expectedUsdc), locale)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.sumK}>{t('mercuryo.toWallet')}</Text>
            <Text style={styles.sumVMono}>{shortAddr(address)}</Text>
          </View>
        </View>

        <Text style={styles.formLabel}>{t('mercuryo.testCard')}</Text>
        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>{t('mercuryo.cardNumber')}</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldVal}>4444 4444 4444 3333</Text>
              <Icon name="card" size={20} stroke={color.inkDim} />
            </View>
          </View>
          <View style={styles.fieldSplit}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldKey}>{t('mercuryo.validThru')}</Text>
              <Text style={styles.fieldVal}>12 / 30</Text>
            </View>
            <View style={[styles.fieldHalf, styles.fieldHalfRight]}>
              <Text style={styles.fieldKey}>{t('mercuryo.cvc')}</Text>
              <Text style={styles.fieldVal}>•••</Text>
            </View>
          </View>
          <View style={[styles.field, styles.fieldLast]}>
            <Text style={styles.fieldKey}>{t('mercuryo.nameOnCard')}</Text>
            <Text style={styles.fieldVal}>{t('mercuryo.cardName')}</Text>
          </View>
        </View>

        <View style={styles.secure}>
          <Icon name="locksmall" size={13} stroke={color.inkFaint} />
          <Text style={styles.secureText}>{t('mercuryo.secure')}</Text>
        </View>
      </ScrollView>
      {dock(`${t('mercuryo.pay')} ${formatLira(amountTry, locale)}`)}
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, paddingTop: space.s4, paddingBottom: space.s4 },
  webBody: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: color.bg },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s3,
    backgroundColor: color.bg,
  },
  loadingText: { ...type.caption, color: color.inkDim },

  testBanner: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    backgroundColor: color.amberSoft,
    borderWidth: 1,
    borderColor: color.amberBd,
    borderRadius: radius.md,
    padding: space.s3,
  },
  testBannerText: { ...type.caption, color: color.amber, flex: 1, lineHeight: 17 },

  summary: { alignItems: 'center', marginTop: space.s6 },
  sumLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  sumAmount: {
    fontFamily: font.extraBold,
    fontSize: 40,
    color: color.ink,
    marginTop: space.s2,
    letterSpacing: -1,
  },
  sumDivider: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: color.hairSoft,
    marginTop: space.s5,
    marginBottom: space.s1,
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: space.s3,
  },
  sumK: { ...type.body, color: color.inkDim },
  sumVGreen: { ...type.bodyStrong, fontSize: 15, color: color.green },
  sumVMono: { fontFamily: font.mono, fontSize: 13, color: color.ink },

  formLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginTop: space.s6,
    marginBottom: space.s3,
  },
  formCard: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
  },
  field: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  fieldLast: { borderBottomWidth: 0 },
  fieldKey: {
    ...type.micro,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginBottom: 6,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldVal: { fontFamily: font.mono, fontSize: 15, color: color.ink, letterSpacing: 1 },
  fieldSplit: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  fieldHalf: { flex: 1, paddingVertical: 14 },
  fieldHalfRight: { borderLeftWidth: 1, borderLeftColor: color.hairSoft, paddingLeft: space.s4 },

  secure: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: space.s4 },
  secureText: { ...type.micro, color: color.inkFaint, flex: 1, lineHeight: 16 },

  processing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s4,
    padding: space.s6,
  },
  processingTitle: { ...type.h2, fontSize: 20, color: color.ink, marginTop: space.s2 },
  processingSub: { ...type.body, color: color.inkDim, textAlign: 'center' },

  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
    gap: space.s2,
  },
  poweredRow: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  powered: { ...type.bodyStrong, fontSize: 12, color: color.inkFaint },
});
