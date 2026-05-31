import { UI_PACKAGE } from '@getsava/ui';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sava</Text>
      <Text style={styles.subtitle}>Monorepo scaffold · YK-486</Text>
      <Text style={styles.meta}>linked workspace package: {UI_PACKAGE}</Text>
      <StatusBar style="auto" />
    </View>
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
  meta: {
    marginTop: 16,
    fontSize: 12,
    opacity: 0.5,
  },
});
