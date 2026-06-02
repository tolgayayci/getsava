import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const ACK_KEY = 'sava.onboarding.acknowledged';

export interface UseOnboardingAck {
  /** null while loading from storage, then the persisted boolean. */
  acknowledged: boolean | null;
  acknowledge: () => void;
}

/**
 * Persists whether the user has accepted the onboarding disclaimer gate, so a
 * returning user never sees it again. (Server-recorded acceptance + version is
 * the full YK-495 story; this is the local gate.)
 */
export function useOnboardingAck(): UseOnboardingAck {
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ACK_KEY)
      .then((v) => setAcknowledged(v === 'true'))
      .catch(() => setAcknowledged(false));
  }, []);

  const acknowledge = useCallback(() => {
    setAcknowledged(true);
    AsyncStorage.setItem(ACK_KEY, 'true').catch(() => {});
  }, []);

  return { acknowledged, acknowledge };
}
