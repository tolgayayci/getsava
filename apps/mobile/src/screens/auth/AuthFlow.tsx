import { color } from '@getsava/ui';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  useAuth,
  useOnboardingAck,
  usePrivy,
  useProvisioning,
  useWalletHydrated,
  useWalletStore,
} from '../../auth';
import { stubBackendClient } from '../../backend/client';
import { MainApp } from '../main/MainApp';
import { LoginScreen } from './LoginScreen';
import { OnboardingGate } from './OnboardingGate';
import { OtpScreen } from './OtpScreen';
import { ProvisioningScreen } from './ProvisioningScreen';

type SignInStep = 'login' | 'otp';

/**
 * Top-level auth flow (T1.D1). Routing order:
 *   1. Wait for Privy to restore the session AND the persisted onboarding flag.
 *   2. Returning, logged-in user → straight to provisioning/Home (skip onboarding).
 *   3. New user → onboarding gate → sign-in (email/OTP or social) → provisioning → Home.
 *
 * Both the Privy session and the onboarding acknowledgement are persisted, so a
 * reload restores the user to where they were rather than back to onboarding.
 */
export function AuthFlow() {
  const [signInStep, setSignInStep] = useState<SignInStep>('login');
  const [email, setEmail] = useState('');

  const auth = useAuth();
  const { user, isReady: privyReady } = usePrivy();
  const { acknowledged, acknowledge } = useOnboardingAck();
  const walletHydrated = useWalletHydrated();
  const isReady = useWalletStore((s) => s.isReady);
  const provisioning = useWalletStore((s) => s.provisioning);

  // Provisioning runs once a Privy user exists; backend bind is stubbed (D6).
  const { retry } = useProvisioning(stubBackendClient);

  // Hold on a splash until Privy has restored its session, the persisted wallet
  // state has rehydrated, and the onboarding flag has loaded — so a returning
  // provisioned user lands directly on Home with no onboarding/provisioning flash.
  if (!privyReady || !walletHydrated || acknowledged === null) {
    return <Splash />;
  }

  // Logged-in (returning) user: never show onboarding again — go to wallet/Home.
  if (user) {
    if (!isReady) {
      return <ProvisioningScreen state={provisioning} onRetry={retry} />;
    }
    return <MainApp />;
  }

  // Not logged in: show onboarding first (once), then sign-in.
  if (!acknowledged) {
    return <OnboardingGate onAccept={acknowledge} />;
  }

  if (signInStep === 'otp') {
    return <OtpScreen auth={auth} email={email} onBack={() => setSignInStep('login')} />;
  }
  return (
    <LoginScreen
      auth={auth}
      onCodeSent={(e) => {
        setEmail(e);
        setSignInStep('otp');
      }}
    />
  );
}

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator color={color.purple} />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg },
});
