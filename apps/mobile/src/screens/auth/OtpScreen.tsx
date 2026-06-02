import { color, radius, space, type } from '@getsava/ui';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  type EmitterSubscription,
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UseAuthResult } from '../../auth';
import { useTranslation } from '../../i18n';
import { Icon } from '../../ui';

const CELLS = [0, 1, 2, 3, 4, 5];
const RESEND_SECONDS = 28;

/**
 * OTP / 2FA screen (T1.D1.S3 / YK-457). 6-digit entry, vertically centered in
 * the space above the keyboard (which opens automatically). The content is
 * shifted with the native driver, in sync with the keyboard's own animation, so
 * there is no lag. A wrong code shows an inline error and red cells; a correct
 * code lets Privy flip the session and the parent routes onward (no "success"
 * message here).
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
  const shift = useRef(new Animated.Value(0)).current;

  const otpError = auth.error !== null;
  const verifying = auth.step === 'verifying';

  // Shift the centered content up by half the keyboard height, matching the
  // keyboard's animation duration so it moves perfectly in sync (no lag).
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      Animated.timing(shift, {
        toValue: -e.endCoordinates.height / 2,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    };
    const onHide = (e: KeyboardEvent) => {
      Animated.timing(shift, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    };

    const subs: EmitterSubscription[] = [
      Keyboard.addListener(showEvent, onShow),
      Keyboard.addListener(hideEvent, onHide),
    ];
    return () => {
      for (const s of subs) {
        s.remove();
      }
    };
  }, [shift]);

  // Open the keyboard on mount.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const onChange = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 6);
    if (auth.error !== null) {
      auth.resetError();
    }
    setCode(v);
    if (v.length === 6) {
      // On success Privy flips usePrivy().user and the parent routes away; on a
      // wrong code verifyEmailCode sets auth.error → otpError shows below.
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
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          hitSlop={10}
          style={styles.back}
        >
          <Icon name="back" size={22} />
        </Pressable>
        <Text style={styles.wordmark}>
          sa<Text style={styles.wordmarkV}>v</Text>a
        </Text>
      </View>

      <Animated.View style={[styles.flex, { transform: [{ translateY: shift }] }]}>
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
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
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
              <Pressable accessibilityRole="button" onPress={resend} hitSlop={12}>
                <Text style={styles.resendLink}>{t('otp.resend')}</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  header: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    left: space.s3,
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { ...type.title, fontSize: 19, color: color.ink },
  wordmarkV: { color: color.purple },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.gutter,
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
