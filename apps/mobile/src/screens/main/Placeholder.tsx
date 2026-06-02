import { color, space, type } from '@getsava/ui';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../i18n';
import { Icon, NavHeader } from '../../ui';

/**
 * Neutral placeholder for screens that are designed/built later (Earn, Activity).
 * Tab screens pass no `onBack`; pushed screens pass `onBack` for a NavHeader.
 */
export function Placeholder({ title, onBack }: { title: string; onBack?: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      {onBack ? (
        <NavHeader title={title} onBack={onBack} />
      ) : (
        <View style={styles.header}>
          <Text style={styles.wm}>{title}</Text>
        </View>
      )}
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Icon name="spark" size={26} stroke={color.inkFaint} />
        </View>
        <Text style={styles.title}>{t('common.comingSoon')}</Text>
        <Text style={styles.body}>{t('common.comingSoonBody')}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: { height: 50, justifyContent: 'center', paddingHorizontal: space.gutter },
  wm: { ...type.title, color: color.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.s6 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s4,
  },
  title: { ...type.h2, fontSize: 16, color: color.ink, marginBottom: space.s1 },
  body: { ...type.body, color: color.inkDim, textAlign: 'center', maxWidth: 250 },
});
