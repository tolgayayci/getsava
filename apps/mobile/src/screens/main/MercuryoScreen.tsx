import { color, font, radius, space, type } from '@getsava/ui';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { stubBackendClient } from '../../backend/client';
import { formatLira, formatUsdc, useTranslation } from '../../i18n';
import { useNav } from '../../nav';
import { Button, Icon, NavHeader } from '../../ui';

/**
 * Mercuryo payment step. In production this hosts Mercuryo's own widget (a
 * WebView to the signed URL) — Sava never sees card data. Until the D6 backend
 * signs URLs and Mercuryo creds exist, it's a placeholder with a demo "pay".
 */
export function MercuryoScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const params = nav.stackTop?.params ?? {};
  const orderId = String(params.orderId ?? '');
  const amountTry = Number(params.amountTry ?? 0);
  const expectedUsdc = Number(params.expectedUsdc ?? 0);

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
        <View style={styles.embed}>
          <Text style={styles.wm}>
            mercuryo<Text style={styles.wmDot}>.</Text>
          </Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{t('mercuryo.embedded')}</Text>
          </View>
          <Text style={styles.desc}>{t('mercuryo.embeddedDesc')}</Text>
          <View style={styles.quote}>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteK}>{t('mercuryo.youPay')}</Text>
              <Text style={styles.quoteV}>{formatLira(amountTry, locale)}</Text>
            </View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteK}>{t('mercuryo.youGet')}</Text>
              <Text style={styles.quoteV}>≈ {formatUsdc(expectedUsdc, locale)}</Text>
            </View>
          </View>
          <View style={styles.foot}>
            <Icon name="locksmall" size={11} stroke={color.inkFaint} />
            <Text style={styles.footText}>{t('mercuryo.footer')}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
        <Button label={t('mercuryo.simulate')} onPress={onPay} loading={busy} />
        <Text style={styles.powered}>{t('mercuryo.powered')}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space.s4 },
  embed: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.hair,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.s6,
  },
  wm: { ...type.h2, color: color.ink },
  wmDot: { color: color.purple },
  tag: {
    marginTop: space.s4,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontFamily: font.mono, fontSize: 10.5, color: color.inkFaint },
  desc: {
    ...type.caption,
    color: color.inkDim,
    textAlign: 'center',
    marginTop: space.s4,
    lineHeight: 18,
  },
  quote: {
    alignSelf: 'stretch',
    marginTop: space.s5,
    backgroundColor: color.bg2,
    borderRadius: radius.md,
    padding: space.s4,
    gap: space.s2,
  },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteK: { ...type.caption, color: color.inkDim },
  quoteV: { ...type.bodyStrong, color: color.ink },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.s5 },
  footText: { fontFamily: font.mono, fontSize: 11, color: color.inkFaint },
  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
    gap: space.s2,
  },
  powered: { ...type.bodyStrong, fontSize: 12, color: color.inkFaint, textAlign: 'center' },
});
