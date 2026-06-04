import { color } from '@getsava/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n';
import { type Nav, NavProvider, type StackRoute, useNav } from '../../nav';
import { TabBar } from '../../ui';
import { ActivityScreen } from './ActivityScreen';
import { AddFundsSheet } from './AddFundsSheet';
import { AddLiraScreen } from './AddLiraScreen';
import { CalculatorScreen } from './CalculatorScreen';
import { EarnScreen } from './EarnScreen';
import { HomeScreen } from './HomeScreen';
import { MercuryoScreen } from './MercuryoScreen';
import { OrderDetailScreen } from './OrderDetailScreen';
import { Placeholder } from './Placeholder';
import { ReceiveScreen } from './ReceiveScreen';
import { SendScreen } from './SendScreen';
import { SettingsScreen } from './SettingsScreen';
import { SupplyScreen } from './SupplyScreen';
import { VaultDetailScreen } from './VaultDetailScreen';
import { VaultWithdrawScreen } from './VaultWithdrawScreen';

/** Title shown by the placeholder for a not-yet-built pushed route. */
const STACK_TITLE: Record<StackRoute, string> = {
  addLira: 'addLira.title',
  mercuryo: 'mercuryo.title',
  order: 'order.title',
  receive: 'receive.title',
  send: 'send.title',
  activity: 'activity.title',
  vault: 'earn.title',
  supply: 'supplyFlow.title',
  vaultWithdraw: 'vaultWithdraw.title',
  calculator: 'calc.title',
};

function ActiveScreen({ nav }: { nav: Nav }) {
  const { t } = useTranslation();
  const top = nav.stackTop;

  if (top) {
    if (top.route === 'addLira') {
      return <AddLiraScreen />;
    }
    if (top.route === 'mercuryo') {
      return <MercuryoScreen />;
    }
    if (top.route === 'order') {
      return <OrderDetailScreen />;
    }
    if (top.route === 'receive') {
      return <ReceiveScreen />;
    }
    if (top.route === 'send') {
      return <SendScreen />;
    }
    if (top.route === 'vault') {
      return <VaultDetailScreen />;
    }
    if (top.route === 'supply') {
      return <SupplyScreen />;
    }
    if (top.route === 'vaultWithdraw') {
      return <VaultWithdrawScreen />;
    }
    if (top.route === 'activity') {
      return <ActivityScreen />;
    }
    if (top.route === 'calculator') {
      return <CalculatorScreen />;
    }
    return (
      <Placeholder title={t(STACK_TITLE[top.route] as Parameters<typeof t>[0])} onBack={nav.back} />
    );
  }
  if (nav.tab === 'home') {
    return <HomeScreen />;
  }
  if (nav.tab === 'earn') {
    return <EarnScreen />;
  }
  if (nav.tab === 'settings') {
    return <SettingsScreen />;
  }
  return <Placeholder title={t('tabs.earn')} />;
}

function Shell() {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const isTab = nav.stackTop === null;

  return (
    <View style={styles.root}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ActiveScreen nav={nav} />
      </View>
      {isTab ? <TabBar active={nav.tab} onChange={nav.go} bottomInset={insets.bottom} /> : null}
      <AddFundsSheet />
    </View>
  );
}

/** Authenticated app shell: tab navigation + pushed screens + sheets (T1.D7). */
export function MainApp() {
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  screen: { flex: 1 },
});
