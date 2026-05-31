import { StyleSheet, Text } from 'react-native';
import { isPrivyConfigured, usePrivyClient } from '../providers/PrivyAppProvider';

/**
 * Smoke component (YK-456 acceptance): proves `usePrivy()` returns a defined
 * client when Privy is configured. Only mounted under a real PrivyProvider.
 */
function PrivyStatusActive() {
  const client = usePrivyClient();
  return <Text style={styles.ok}>Privy client ready: {String(client.isReady)}</Text>;
}

export function PrivyStatus() {
  if (isPrivyConfigured) {
    return <PrivyStatusActive />;
  }
  return <Text style={styles.demo}>Privy: demo mode (Expo Go or no credentials)</Text>;
}

const styles = StyleSheet.create({
  ok: {
    marginTop: 12,
    fontSize: 13,
    color: '#16a34a',
  },
  demo: {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.6,
  },
});
