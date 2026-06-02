import { color, type } from '@getsava/ui';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.purpleInk : color.ink} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            style={[styles.label, variant === 'primary' ? styles.labelPrimary : styles.labelInk]}
          >
            {label}
          </Text>
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
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { backgroundColor: color.purple },
  secondary: { backgroundColor: color.surface2, borderColor: color.hair },
  ghost: { backgroundColor: 'transparent', borderColor: color.hair },
  disabled: { opacity: 0.38 },
  pressed: { transform: [{ translateY: 1 }] },
  label: { ...type.button },
  labelPrimary: { color: color.purpleInk },
  labelInk: { color: color.ink },
});
