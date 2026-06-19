import { color, radius, space, type } from '@getsava/ui';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLira, useTranslation } from '../../i18n';
import { useFxStatus, useTryRate } from '../../lib/fx';
import { useVaultStore } from '../../lib/vault-store';
import { useNav } from '../../nav';
import { Icon, NavHeader } from '../../ui';
import { ActivityList } from '../../ui/ActivityList';

const FX_LABEL: Record<string, string> = { coingecko: 'CoinGecko', binance: 'Binance' };

export function ActivityScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const activity = useVaultStore((s) => s.activity);
  const rate = useTryRate();
  const { source, live } = useFxStatus();

  return (
    <>
      <NavHeader title={t('activity.title')} onBack={() => nav.back()} />
      {activity.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="list" size={26} stroke={color.inkFaint} />
          </View>
          <Text style={styles.emptyTitle}>{t('activity.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('activity.emptyBody')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s6 }]}
        >
          <ActivityList records={activity} />
          <View style={styles.fxNote}>
            <Icon name="info" size={13} stroke={color.inkFaint} />
            <Text style={styles.fxNoteTx}>
              {t('activity.fxNote')}
              {live
                ? ` · 1 USDC ≈ ${formatLira(rate, locale)} (${FX_LABEL[source] ?? source})`
                : ''}
            </Text>
          </View>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter, paddingTop: space.s2 },
  fxNote: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: space.s4 },
  fxNoteTx: { ...type.micro, color: color.inkFaint, flex: 1, lineHeight: 15 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.s6,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s4,
  },
  emptyTitle: { ...type.h2, fontSize: 17, color: color.ink, textAlign: 'center' },
  emptyBody: {
    ...type.body,
    color: color.inkDim,
    textAlign: 'center',
    marginTop: space.s2,
    maxWidth: 260,
  },
});
