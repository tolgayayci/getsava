import { color, font, space, type } from '@getsava/ui';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { stubBackendClient } from '../../backend/client';
import { useTranslation } from '../../i18n';
import { buildMercuryoPreviewUrl } from '../../lib/mercuryo';
import { useNav } from '../../nav';
import { Button, Icon, NavHeader } from '../../ui';

/**
 * Mercuryo payment step. Loads the REAL hosted widget (react-native-webview) so
 * the UI is visible with the ₺ amount pre-filled. The widget renders unsigned
 * (no address ⇒ no signature ⇒ no secret in the client); completing a real card
 * payment needs a partner widget_id + backend-signed URL (YK-461 / D6). The demo
 * button drives the in-app order while that's pending.
 */
export function MercuryoScreen() {
  const { t } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const params = nav.stackTop?.params ?? {};
  const orderId = String(params.orderId ?? '');
  const amountTry = String(params.amountTry ?? '0');
  const widgetUrl = buildMercuryoPreviewUrl({ amountTry, orderId });

  const onPay = async () => {
    setBusy(true);
    try {
      await stubBackendClient.simulatePayment(orderId);
      nav.replace('order', { orderId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <NavHeader title={t('mercuryo.title')} subtitle="Mercuryo" center onBack={nav.back} />
      <View style={styles.body}>
        {failed ? (
          <View style={styles.fallback}>
            <View style={styles.fallbackIc}>
              <Icon name="card" size={26} stroke={color.inkDim} />
            </View>
            <Text style={styles.fallbackText}>{t('mercuryo.fallback')}</Text>
          </View>
        ) : (
          <WebView
            source={{ uri: widgetUrl }}
            style={styles.web}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            onError={() => setFailed(true)}
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={color.purple} />
                <Text style={styles.loadingText}>{t('mercuryo.loading')}</Text>
              </View>
            )}
          />
        )}
      </View>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
        <Button variant="secondary" label={t('mercuryo.simulate')} onPress={onPay} loading={busy} />
        <Text style={styles.powered}>{t('mercuryo.powered')}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, overflow: 'hidden' },
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
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.s6,
    gap: space.s4,
  },
  fallbackIc: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    ...type.body,
    color: color.inkDim,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
  },
  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
    gap: space.s2,
  },
  powered: { ...type.bodyStrong, fontSize: 12, color: color.inkFaint, textAlign: 'center' },
});
