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

/**
 * Mercuryo payment step.
 *
 * Real widget (when EXPO_PUBLIC_MERCURYO_WIDGET_ID is set): a WebView loads the
 * hosted Mercuryo widget. Otherwise — the D2 demo — a MOCK card-payment screen
 * with a sandbox test card. Either way, "Pay" runs the TESTNET deposit bridge:
 * the Sava issuer mints USDC to the user's wallet (real Stellar tx hash) so the
 * deposit actually arrives on-chain (BRIDGE_TESTNET — removed at mainnet, where
 * Mercuryo settles real Circle USDC).
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
      <Text style={styles.powered}>{t('mercuryo.powered')}</Text>
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

  // ---- Mock card payment (D2 demo) ----
  return (
    <>
      <NavHeader title={t('mercuryo.title')} subtitle="Mercuryo" center onBack={nav.back} />
      <ScrollView contentContainerStyle={styles.body}>
        {busy ? (
          <View style={styles.processing}>
            <ActivityIndicator color={color.purple} size="large" />
            <Text style={styles.processingTitle}>{t('mercuryo.processing')}</Text>
            <Text style={styles.processingSub}>{t('mercuryo.processingSub')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTag}>{t('mercuryo.testCard')}</Text>
                <Icon name="card" size={22} stroke="rgba(255,255,255,0.8)" />
              </View>
              <Text style={styles.cardNumber}>4444 4444 4444 3333</Text>
              <View style={styles.cardBottomRow}>
                <View>
                  <Text style={styles.cardLabel}>{t('mercuryo.cardName')}</Text>
                </View>
                <View>
                  <Text style={styles.cardLabel}>{t('mercuryo.validThru')}</Text>
                  <Text style={styles.cardValue}>12/30</Text>
                </View>
                <View>
                  <Text style={styles.cardLabel}>{t('mercuryo.cvc')}</Text>
                  <Text style={styles.cardValue}>•••</Text>
                </View>
              </View>
            </View>

            <View style={styles.quote}>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteK}>{t('mercuryo.youPay')}</Text>
                <Text style={styles.quoteV}>{formatLira(amountTry, locale)}</Text>
              </View>
              <View style={[styles.quoteRow, styles.quoteRowLast]}>
                <Text style={styles.quoteK}>{t('mercuryo.youGet')}</Text>
                <Text style={styles.quoteVGet}>≈ {formatUsdc(Number(expectedUsdc), locale)}</Text>
              </View>
            </View>

            <View style={styles.note}>
              <Icon name="locksmall" size={13} stroke={color.inkFaint} />
              <Text style={styles.noteText}>{t('mercuryo.sandboxNote')}</Text>
            </View>
          </>
        )}
      </ScrollView>
      {dock(`${t('mercuryo.pay')} ${formatLira(amountTry, locale)}`)}
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, paddingTop: space.s5 },
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

  card: {
    backgroundColor: color.purple,
    borderRadius: radius.lg,
    padding: space.s5,
    gap: space.s5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTag: {
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
  },
  cardNumber: {
    fontFamily: font.mono,
    fontSize: 21,
    letterSpacing: 2,
    color: '#fff',
    marginTop: space.s2,
  },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardLabel: {
    fontFamily: font.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 3,
  },
  cardValue: { fontFamily: font.monoMedium, fontSize: 13, color: '#fff' },

  quote: {
    marginTop: space.s6,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: color.hairSoft,
  },
  quoteRowLast: { borderBottomWidth: 0 },
  quoteK: { ...type.body, color: color.inkDim },
  quoteV: { ...type.h2, fontSize: 18, color: color.ink },
  quoteVGet: { ...type.h2, fontSize: 18, color: color.green },

  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: space.s5 },
  noteText: { ...type.micro, color: color.inkFaint, flex: 1, lineHeight: 16 },

  processing: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.s8 * 2,
    gap: space.s4,
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
  powered: { ...type.bodyStrong, fontSize: 12, color: color.inkFaint, textAlign: 'center' },
});
