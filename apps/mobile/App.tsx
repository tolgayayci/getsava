import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { PrivyStatus } from './src/components/PrivyStatus';
import { PrivyAppProvider } from './src/providers/PrivyAppProvider';

export function App() {
  return (
    <PrivyAppProvider>
      <View style={styles.container}>
        <Text style={styles.title}>Sava</Text>
        <Text style={styles.subtitle}>Privy integration</Text>
        <PrivyStatus />
        <StatusBar style="auto" />
      </View>
    </PrivyAppProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
  },
});
