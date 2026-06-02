import { color } from '@getsava/ui';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/i18n';
import { PrivyAppProvider } from './src/providers/PrivyAppProvider';
import { AuthFlow } from './src/screens/auth/AuthFlow';
import { useAppFonts } from './src/ui';

export function App() {
  const fontsLoaded = useAppFonts();

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
