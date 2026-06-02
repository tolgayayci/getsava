import { color, radius, space, type } from '@getsava/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UseAuthResult } from '../../auth';
import { useTranslation } from '../../i18n';
import { AppleMark, Button, GoogleMark, Icon } from '../../ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login screen (T1.D1.S3 / YK-457). Email entry + Google/Apple (equal standing,
 * App Store Guideline 4.8). Drives the {@link UseAuthResult} engine; on a sent
 * code the parent advances to the OTP screen.
 */
export function LoginScreen({
  auth,
  onCodeSent,
}: {
  auth: UseAuthResult;
  onCodeSent: (email: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState(false);

  const submitEmail = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setLocalError(true);
      return;
    }
    setLocalError(false);
    const ok = await auth.sendEmailCode(email.trim());
    if (ok) {
      onCodeSent(email.trim());
    }
  };

  const showEmailError = localError || auth.error === 'auth.emailError';
  const sending = auth.step === 'sending-code';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>
          sa<Text style={styles.wordmarkV}>v</Text>a
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{t('auth.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('auth.emailLabel')}</Text>
          <TextInput
            style={[styles.input, showEmailError && styles.inputError]}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={color.inkFaint}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setLocalError(false);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            inputMode="email"
            returnKeyType="send"
            onSubmitEditing={submitEmail}
            editable={!sending}
          />
          {showEmailError && (
            <View style={styles.errorRow}>
              <Icon name="alert" size={13} stroke={color.red} />
              <Text style={styles.errorText}>{t('auth.emailError')}</Text>
            </View>
          )}
          {auth.error === 'auth.netError' && (
            <View style={styles.errorRow}>
              <Icon name="alert" size={13} stroke={color.red} />
              <Text style={styles.errorText}>{t('auth.netError')}</Text>
            </View>
          )}
          {auth.error !== null &&
            auth.error !== 'auth.netError' &&
            auth.error !== 'auth.emailError' && (
              <View style={styles.errorRow}>
                <Icon name="alert" size={13} stroke={color.red} />
                <Text style={styles.errorText}>{auth.error}</Text>
              </View>
            )}
        </View>

        <View style={{ marginTop: space.s4 }}>
          <Button label={t('auth.continueEmail')} onPress={submitEmail} loading={sending} />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>{t('auth.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={{ gap: space.s3 }}>
          <SocialButton label={t('auth.google')} onPress={auth.loginWithGoogle}>
            <GoogleMark size={20} />
          </SocialButton>
          {auth.isAppleSignInAvailable && (
            <SocialButton label={t('auth.apple')} onPress={auth.loginWithApple}>
              <AppleMark size={20} />
            </SocialButton>
          )}
        </View>

        <View style={styles.spacer} />
        <Text style={styles.legal}>{t('auth.legal')}</Text>
      </View>
    </View>
  );
}

function SocialButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.social, pressed && styles.socialPressed]}
    >
      {children}
      <Text style={styles.socialLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: { height: 50, justifyContent: 'center', paddingHorizontal: space.gutter },
  wordmark: { ...type.title, fontSize: 19, color: color.ink },
  wordmarkV: { color: color.purple },
  body: { flex: 1, paddingHorizontal: space.gutter },
  title: { ...type.h1, color: color.ink, marginTop: 14 },
  subtitle: { ...type.body, color: color.inkDim, marginTop: space.s3 },
  field: { marginTop: space.s7 },
  fieldLabel: { ...type.caption, color: color.inkDim, marginBottom: space.s2 },
  input: {
    height: 56,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
    fontFamily: type.body.fontFamily,
    fontSize: 16,
    color: color.ink,
  },
  inputError: { borderColor: color.red },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.s2 },
  errorText: { ...type.caption, color: color.red },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.s3, marginVertical: space.s5 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: color.hair },
  dividerLabel: { ...type.caption, color: color.inkFaint },
  social: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
  },
  socialPressed: { backgroundColor: color.surface2 },
  socialLabel: { ...type.bodyStrong, color: color.ink },
  spacer: { flex: 1 },
  legal: {
    ...type.micro,
    color: color.inkFaint,
    textAlign: 'center',
    paddingTop: space.s5,
    paddingBottom: space.s2,
    lineHeight: 16,
  },
});
