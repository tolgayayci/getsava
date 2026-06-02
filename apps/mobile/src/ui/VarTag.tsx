import { color, font } from '@getsava/ui';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';

/** The amber "variable / not guaranteed" compliance qualifier pill. */
export function VarTag({ label }: { label: string }) {
  return (
    <View style={styles.wrap}>
      <Icon name="info" size={11} stroke={color.amber} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: color.amberSoft,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  label: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: color.amber,
  },
});
