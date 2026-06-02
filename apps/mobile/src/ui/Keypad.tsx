import { color, type } from '@getsava/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';

export type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'del'
  | 'clear'
  | 'decimal';

interface KeypadProps {
  onKey: (key: KeypadKey) => void;
  /** integer → [del · 0 · clear]; decimal → [. · 0 · del]. */
  variant?: 'integer' | 'decimal';
  /** Text for the integer-variant clear key (e.g. "Cancel"). */
  clearLabel?: string;
  /** Decimal separator glyph shown on the decimal key (',' or '.'). */
  decimalLabel?: string;
}

const DIGITS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function Keypad({
  onKey,
  variant = 'integer',
  clearLabel = '',
  decimalLabel = '.',
}: KeypadProps) {
  const Digit = ({ k }: { k: KeypadKey }) => (
    <Pressable style={styles.key} onPress={() => onKey(k)} accessibilityRole="button">
      <Text style={styles.digit}>{k}</Text>
    </Pressable>
  );
  const Del = () => (
    <Pressable style={styles.key} onPress={() => onKey('del')} accessibilityLabel="delete">
      <Icon name="back" size={24} />
    </Pressable>
  );

  return (
    <View style={styles.pad}>
      {DIGITS.map((d) => (
        <Digit key={d} k={d} />
      ))}
      {variant === 'integer' ? (
        <>
          <Del />
          <Digit k="0" />
          <Pressable style={styles.key} onPress={() => onKey('clear')} accessibilityLabel="clear">
            <Text style={styles.clear}>{clearLabel}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable
            style={styles.key}
            onPress={() => onKey('decimal')}
            accessibilityLabel="decimal"
          >
            <Text style={[styles.digit, styles.decimal]}>{decimalLabel}</Text>
          </Pressable>
          <Digit k="0" />
          <Del />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { flexDirection: 'row', flexWrap: 'wrap' },
  key: {
    width: '33.333%',
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  digit: { fontFamily: type.h2.fontFamily, fontSize: 24, color: color.ink },
  decimal: { fontSize: 28 },
  clear: { ...type.body, color: color.inkFaint },
});
