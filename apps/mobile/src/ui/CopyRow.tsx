import { color, font, radius, space, type } from '@getsava/ui';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';

interface CopyRowProps {
  label: string;
  value: string;
  /** Copies this string instead of `value` (e.g. the full address vs a short display). */
  copyValue?: string;
  /** Fired after a successful copy (usually to raise a toast). */
  onCopy?: () => void;
}

/** A bordered row showing a label + value with a copy-to-clipboard button. */
export function CopyRow({ label, value, copyValue, onCopy }: CopyRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(copyValue ?? value);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Pressable style={styles.row} onPress={handleCopy} accessibilityRole="button">
      <View style={styles.left}>
        <Text style={styles.key}>{label}</Text>
        <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
          {value}
        </Text>
      </View>
      <View style={styles.btn}>
        <Icon
          name={copied ? 'check' : 'copy'}
          size={16}
          stroke={copied ? color.green : color.inkDim}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
  },
  left: { flex: 1, minWidth: 0 },
  key: { ...type.micro, color: color.inkFaint, marginBottom: 3 },
  value: { fontFamily: font.mono, fontSize: 13, color: color.ink },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
