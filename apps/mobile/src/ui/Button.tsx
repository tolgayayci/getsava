import { color, type } from '@getsava/ui';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Pre-rendered icon node (takes precedence over `iconName`). */
  icon?: ReactNode;
  /** Named icon from the shared set, tinted to match the variant. */
  iconName?: IconName;
}

const LABEL_COLOR: Record<Variant, string> = {
  primary: color.purpleInk,
  secondary: color.ink,
  ghost: color.ink,
  danger: color.red,
  quiet: color.purple,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  iconName,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const fg = LABEL_COLOR[variant];
  const iconNode = icon ?? (iconName ? <Icon name={iconName} size={18} stroke={fg} /> : null);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'quiet' && styles.quietBase,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {iconNode}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  quietBase: { height: undefined, paddingVertical: 4, borderWidth: 0 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { backgroundColor: color.purple },
  secondary: { backgroundColor: color.surface2, borderColor: color.hair },
  ghost: { backgroundColor: 'transparent', borderColor: color.hair },
  danger: { backgroundColor: color.redSoft, borderColor: color.redBd },
  quiet: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.38 },
  pressed: { transform: [{ translateY: 1 }] },
  label: { ...type.button },
});
