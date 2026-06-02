import { color, space, type } from '@getsava/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';

interface NavHeaderProps {
  title: string;
  onBack?: () => void;
  /** Optional right-side text action. */
  action?: string;
  onAction?: () => void;
  /** Small dimmed line under a centered title (e.g. "Mercuryo"). */
  subtitle?: string;
  /** Center the title (used by the payment/send chrome). */
  center?: boolean;
}

export function NavHeader({ title, onBack, action, onAction, subtitle, center }: NavHeaderProps) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.back} hitSlop={8}>
          <Icon name="back" size={22} />
        </Pressable>
      ) : (
        center && <View style={styles.back} />
      )}
      {center ? (
        <View style={styles.centerBox} pointerEvents="none">
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : (
        <Text style={styles.title}>{title}</Text>
      )}
      <View style={styles.spacer} />
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : center && onBack ? (
        <View style={styles.back} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    height: 54,
    paddingHorizontal: space.gutter,
  },
  back: {
    width: 38,
    height: 38,
    marginLeft: -8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.title, color: color.ink },
  centerBox: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  subtitle: { ...type.caption, color: color.inkFaint, marginTop: 1 },
  spacer: { flex: 1 },
  action: { ...type.bodyStrong, color: color.green },
});
