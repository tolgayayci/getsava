import { color, radius, type } from '@getsava/ui';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';

/** Transient confirmation pill. Positioning is handled by the caller. */
export function Toast({ text }: { text: string }) {
  return (
    <View style={styles.toast} pointerEvents="none">
      <Icon name="check" size={16} stroke={color.green} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.hair,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
  },
  text: { ...type.bodyStrong, fontSize: 13.5, color: color.ink },
});
