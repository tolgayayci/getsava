import { assertPoolWhitelisted, blendConfig } from '@getsava/sdk-blend';
import { color } from '@getsava/ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/i18n';
import { NETWORK } from './src/lib/network';
import { registerForCircuitPush } from './src/lib/push';
import { PrivyAppProvider } from './src/providers/PrivyAppProvider';
import { AuthFlow } from './src/screens/auth/AuthFlow';
import { useAppFonts } from './src/ui';

export function App() {
  const fontsLoaded = useAppFonts();

  // D1 layer 1: refuse to operate against a non-whitelisted pool. The hard gate
  // is in useVault.supply() (deposits are blocked), this surfaces misconfig early.
  useEffect(() => {
    try {
      assertPoolWhitelisted(blendConfig(NETWORK).poolId, NETWORK);
    } catch (e) {
      console.error('[Sava] pool whitelist check failed at startup:', e);
    }
    // Register this device for circuit-trip push (no-op on web / without permission).
    void registerForCircuitPush();
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        {fontsLoaded ? (
          <I18nProvider>
            <PrivyAppProvider>
              <AuthFlow />
            </PrivyAppProvider>
          </I18nProvider>
        ) : null}
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}
