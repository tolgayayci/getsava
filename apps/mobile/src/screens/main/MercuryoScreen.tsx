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
import { FX_TRY_PER_USDC } from '../../lib/fx';
import { buildMercuryoPreviewUrl, mercuryoConfigured } from '../../lib/mercuryo';
import { useNav } from '../../nav';
import { AppleMark, Button, GoogleMark, Icon, NavHeader } from '../../ui';

function shortAddr(a: string): string {
  return a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;
}

/**
 * Mercuryo payment step.
 *
 * Real widget (EXPO_PUBLIC_MERCURYO_WIDGET_ID set): a WebView loads Mercuryo's
 * hosted widget. Otherwise — the D2 demo — a hosted-checkout-style mock, clearly
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

  // ---- Mock hosted checkout (D2 demo) ----
  return (
    <>
      <NavHeader title={t('mercuryo.title')} subtitle="Mercuryo" center onBack={nav.back} />
      <View style={styles.secureStrip}>
        <Icon name="locksmall" size={12} stroke={color.green} />
        <Text style={styles.secureStripText}>{t('mercuryo.secureCheckout')} · Mercuryo</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.testBanner}>
          <Icon name="info" size={15} stroke={color.amber} />
          <Text style={styles.testBannerText}>{t('mercuryo.testMode')}</Text>
        </View>

        {/* what you're buying */}
        <View style={styles.summary}>
          <Text style={styles.sumLabel}>{t('mercuryo.youGet')}</Text>
          <Text style={styles.sumAmount}>≈ {formatUsdc(Number(expectedUsdc), locale)}</Text>
          <Text style={styles.sumSub}>
            {t('mercuryo.forLabel')} {formatLira(amountTry, locale)}
          </Text>
        </View>

        {/* meta */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaK}>{t('mercuryo.rate')}</Text>
            <Text style={styles.metaV}>1 USDC ≈ {formatLira(FX_TRY_PER_USDC, locale)}</Text>
          </View>
          <View style={[styles.metaRow, styles.metaRowLast]}>
            <Text style={styles.metaK}>{t('mercuryo.toWallet')}</Text>
            <Text style={styles.metaVMono}>{shortAddr(address)}</Text>
          </View>
        </View>

        {/* payment method */}
        <Text style={styles.formLabel}>{t('mercuryo.payWith')}</Text>
        <View style={styles.methods}>
          <View style={[styles.method, styles.methodActive]}>
            <Icon name="card" size={20} stroke={color.purple} />
            <Text style={[styles.methodText, styles.methodTextActive]}>{t('mercuryo.card')}</Text>
          </View>
          <View style={[styles.method, styles.methodDim]}>
            <AppleMark size={18} fill={color.inkDim} />
            <Text style={styles.methodText}>Apple Pay</Text>
          </View>
          <View style={[styles.method, styles.methodDim]}>
            <GoogleMark size={16} />
            <Text style={styles.methodText}>Google Pay</Text>
          </View>
        </View>

        {/* card form */}
        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.fieldKey}>{t('mercuryo.cardNumber')}</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldVal}>4444 4444 4444 3333</Text>
              <View style={styles.brandChip}>
                <Text style={styles.brandText}>VISA</Text>
              </View>
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

  secureStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: color.bg2,
    borderBottomWidth: 1,
    borderBottomColor: color.hairSoft,
  },
  secureStripText: { ...type.caption, color: color.inkDim, fontFamily: font.semiBold },

  testBanner: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    backgroundColor: color.amberSoft,
    borderWidth: 1,
    borderColor: color.amberBd,
    borderRadius: radius.md,
    padding: space.s3,
    marginTop: space.s2,
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
    color: color.green,
    marginTop: space.s2,
    letterSpacing: -1,
  },
  sumSub: { ...type.body, color: color.inkDim, marginTop: space.s2 },

  metaCard: {
    marginTop: space.s5,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: color.hairSoft,
  },
  metaRowLast: { borderBottomWidth: 0 },
  metaK: { ...type.body, color: color.inkDim },
  metaV: { ...type.bodyStrong, fontSize: 14, color: color.ink },
  metaVMono: { fontFamily: font.mono, fontSize: 13, color: color.ink },

  formLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginTop: space.s6,
    marginBottom: space.s3,
  },
  methods: { flexDirection: 'row', gap: 8, marginBottom: space.s4 },
  method: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.hair,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  methodActive: { borderColor: color.purple, backgroundColor: color.purpleSoft },
  methodDim: { opacity: 0.5 },
  methodText: { ...type.micro, color: color.inkDim, fontFamily: font.semiBold },
  methodTextActive: { color: color.ink },

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
  brandChip: {
    backgroundColor: color.surface2,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  brandText: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1, color: color.inkDim },
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
