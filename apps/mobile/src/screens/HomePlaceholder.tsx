import { color, space, type } from '@getsava/ui';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '../auth';
import { useTranslation } from '../i18n';
import { Button } from '../ui';

/**
 * Minimal post-auth landing. The real Home screen + tab shell are T1.D7 (a
 * design-blocked story); this placeholder confirms the auth → provisioning →
 * Home flow completes and offers sign-out.
 */
export function HomePlaceholder({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const address = useWalletStore((s) => s.address);

  return (
    <View
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.s5 }]}
    >
      <View style={styles.center}>
        <Text style={styles.wordmark}>
          sa<Text style={styles.wordmarkV}>v</Text>a
        </Text>
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={styles.sub}>{t('home.subtitle')}</Text>
        {address ? <Text style={styles.addr}>{address}</Text> : null}
      </View>
      <View style={styles.dock}>
        <Button label={t('home.signOut')} variant="ghost" onPress={onSignOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.gutter,
  },
  wordmark: { ...type.h2, fontSize: 22, color: color.ink, marginBottom: space.s5 },
  wordmarkV: { color: color.purple },
  title: { ...type.h2, color: color.ink, textAlign: 'center' },
  sub: {
    ...type.body,
    color: color.inkDim,
    textAlign: 'center',
    marginTop: space.s3,
    maxWidth: 300,
  },
  addr: {
    ...type.mono,
    color: color.inkFaint,
    marginTop: space.s5,
    textAlign: 'center',
    paddingHorizontal: space.s4,
  },
  dock: { paddingHorizontal: space.gutter },
});
