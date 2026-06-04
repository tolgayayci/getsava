import { color, radius, space, type } from '@getsava/ui';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n';
import { useVaultStore } from '../../lib/vault-store';
import { useNav } from '../../nav';
import { Icon, NavHeader } from '../../ui';
import { ActivityList } from '../../ui/ActivityList';

export function ActivityScreen() {
  const { t } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const activity = useVaultStore((s) => s.activity);

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
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter, paddingTop: space.s2 },
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
