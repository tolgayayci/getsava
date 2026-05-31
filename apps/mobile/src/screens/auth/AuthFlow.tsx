import { useState } from 'react';
import { useAuth, usePrivy, useProvisioning, useSession, useWalletStore } from '../../auth';
import { stubBackendClient } from '../../backend/client';
import { HomePlaceholder } from '../HomePlaceholder';
import { LoginScreen } from './LoginScreen';
import { OnboardingGate } from './OnboardingGate';
import { OtpScreen } from './OtpScreen';
import { ProvisioningScreen } from './ProvisioningScreen';

type SignInStep = 'login' | 'otp';

/**
 * Top-level auth flow (T1.D1). Sequences: onboarding gate → sign-in (email/OTP
 * or social) → wallet provisioning → Home. Persisted disclaimer acceptance and
 * the full routing-guard/tab shell are later stories (YK-495 / YK-497); this
 * keeps acceptance in local state for now.
 */
export function AuthFlow() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [signInStep, setSignInStep] = useState<SignInStep>('login');
  const [email, setEmail] = useState('');

  const auth = useAuth();
  const session = useSession();
  const { user } = usePrivy();
  const provisioning = useWalletStore((s) => s.provisioning);
  const isReady = useWalletStore((s) => s.isReady);

  // Provisioning runs once a Privy user exists; backend bind is stubbed (D6).
  const { retry } = useProvisioning(stubBackendClient);

  if (!acknowledged) {
    return <OnboardingGate onAccept={() => setAcknowledged(true)} />;
  }

  if (!user) {
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

  if (!isReady) {
    return <ProvisioningScreen state={provisioning} onRetry={retry} />;
  }

  return <HomePlaceholder onSignOut={session.signOut} />;
}
