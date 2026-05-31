import { color, radius, space, type } from '@getsava/ui';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UseAuthResult } from '../../auth';
import { useTranslation } from '../../i18n';
import { Icon } from '../../ui';

const CELLS = [0, 1, 2, 3, 4, 5];
const RESEND_SECONDS = 28;

/**
 * OTP / 2FA screen (T1.D1.S3 / YK-457). 6-digit entry with a resend countdown.
 * On a complete code it calls the auth engine; a successful Privy login flips
 * the parent to provisioning.
 */
export function OtpScreen({
  auth,
  email,
  onBack,
}: {
  auth: UseAuthResult;
  email: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const otpError = auth.error === 'errors.invalidCode' || auth.error === 'auth.netError';
  const verifying = auth.step === 'verifying';

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const onChange = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 6);
    setCode(v);
    if (v.length === 6) {
      void auth.verifyEmailCode(v).then(() => setCode(''));
    }
  };

  const resend = async () => {
    const ok = await auth.sendEmailCode(email);
    if (ok) {
      setResendIn(RESEND_SECONDS);
      setResent(true);
      setTimeout(() => setResent(false), 1800);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={onBack}
        style={styles.back}
      >
        <Icon name="back" size={22} />
      </Pressable>

      <Pressable style={styles.body} onPress={() => inputRef.current?.focus()}>
        <View style={styles.iconBubble}>
          <Icon name="locksmall" size={30} stroke={color.purple} />
        </View>
        <Text style={styles.title}>{t('otp.title')}</Text>
        <Text style={styles.sub}>{t('otp.sentTo', { email })}</Text>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          editable={!verifying}
          style={styles.hiddenInput}
        />

        <View style={styles.cells}>
          {CELLS.map((i) => {
            const filled = Boolean(code[i]);
            const active = code.length === i && !otpError;
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  filled && styles.cellFilled,
                  active && styles.cellActive,
                  otpError && styles.cellError,
                ]}
              >
                <Text style={styles.cellText}>{code[i] ?? ''}</Text>
              </View>
            );
          })}
        </View>

        {otpError && (
          <View style={styles.errorRow}>
            <Icon name="alert" size={13} stroke={color.red} />
            <Text style={styles.errorText}>{t('otp.error')}</Text>
          </View>
        )}

        <View style={styles.resend}>
          {resent ? (
            <View style={styles.resentRow}>
              <Icon name="check" size={14} stroke={color.green} />
              <Text style={styles.resentText}>{t('otp.resent')}</Text>
            </View>
          ) : resendIn > 0 ? (
            <Text style={styles.resendMuted}>
              {t('otp.resendIn', { seconds: `0:${String(resendIn).padStart(2, '0')}` })}
            </Text>
          ) : (
            <Pressable accessibilityRole="button" onPress={resend}>
              <Text style={styles.resendLink}>{t('otp.resend')}</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  back: {
    width: 38,
    height: 38,
    marginLeft: space.s3,
    marginTop: space.s2,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.gutter,
    paddingBottom: 48,
  },
  iconBubble: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: color.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s6,
  },
  title: { ...type.h2, color: color.ink, textAlign: 'center' },
  sub: { ...type.body, color: color.inkDim, marginTop: space.s2, textAlign: 'center' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  cells: { flexDirection: 'row', gap: 10, marginTop: 30 },
  cell: {
    width: 46,
    height: 58,
    borderRadius: 12,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFilled: { borderColor: 'rgba(255,255,255,0.25)' },
  cellActive: { borderColor: color.purple },
  cellError: { borderColor: color.red },
  cellText: { fontFamily: type.h2.fontFamily, fontSize: 26, color: color.ink },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 },
  errorText: { ...type.caption, color: color.red },
  resend: { marginTop: space.s6 },
  resendMuted: { ...type.caption, color: color.inkFaint },
  resendLink: { ...type.bodyStrong, color: color.purple },
  resentRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resentText: { ...type.caption, color: color.green },
});
