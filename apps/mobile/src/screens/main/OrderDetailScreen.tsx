import { stellarExpertTxUrl } from '@getsava/sdk-stellar';
import { color, font, radius, space, type } from '@getsava/ui';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type DepositState, type OrderStatus, stubBackendClient } from '../../backend/client';
import { formatLira, formatUsdc, useTranslation } from '../../i18n';
import { NETWORK } from '../../lib/network';
import { useNav } from '../../nav';
import { Button, CopyRow, Icon, NavHeader, Notice } from '../../ui';

type Phase = 'settling' | 'arrived' | 'failed';

function phaseOf(state: DepositState): Phase {
  if (state === 'settled') return 'arrived';
  if (state === 'failed') return 'failed';
  return 'settling';
}

function isTerminal(state: DepositState): boolean {
  return state === 'settled' || state === 'failed';
}

export function OrderDetailScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const orderId = String(nav.stackTop?.params?.orderId ?? '');

  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const s = await stubBackendClient.getOrder(orderId);
    if (s) {
      setStatus(s);
      if (isTerminal(s.state) && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    }
  }, [orderId]);

  useEffect(() => {
    void poll();
    timer.current = setInterval(poll, 1500);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [poll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await poll();
    setRefreshing(false);
  };

  const state = status?.state ?? 'paid';
  const phase = phaseOf(state);
  const settled = phase === 'arrived';
  const amountTry = Number(status?.amountTry ?? 0);
  const expectedUsdc = Number(status?.expectedUsdc ?? 0);
  const hash = status?.stellarTxHash;

  const hero =
    phase === 'arrived'
      ? { title: t('order.arrivedTitle'), body: t('order.arrivedBody') }
      : phase === 'failed'
        ? { title: t('order.failedTitle'), body: t('order.failedBody') }
        : { title: t('order.settlingTitle'), body: t('order.settlingBody') };

  const steps: Array<{ key: 'paid' | 'settling' | 'arrived'; label: string }> = [
    { key: 'paid', label: t('order.stepPaid') },
    { key: 'settling', label: t('order.stepSettle') },
    { key: 'arrived', label: t('order.stepArrived') },
  ];
  const stepStatus = (key: string): 'done' | 'active' | 'pending' => {
    if (phase === 'arrived') return 'done';
    if (key === 'paid') return 'done';
    if (key === 'settling') return 'active';
    return 'pending';
  };

  return (
    <>
      <NavHeader title={t('order.title')} onBack={() => nav.go('home')} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s6 }]}
      >
        <View style={styles.statusHero}>
          <View
            style={[
              styles.statusIcon,
              phase === 'arrived' && styles.statusIconOk,
              phase === 'failed' && styles.statusIconBad,
            ]}
          >
            {phase === 'settling' ? <ActivityIndicator color={color.green} /> : null}
            {phase === 'arrived' ? <Icon name="check" size={34} stroke={color.green} /> : null}
            {phase === 'failed' ? <Icon name="x" size={34} stroke={color.red} /> : null}
          </View>
          <Text style={styles.statusTitle}>{hero.title}</Text>
          {settled ? (
            <Text style={styles.received}>+{formatUsdc(expectedUsdc, locale)}</Text>
          ) : null}
          <Text style={styles.statusBody}>{hero.body}</Text>
        </View>

        {phase !== 'failed' ? (
          <View style={styles.track}>
            {steps.map((step, i) => {
              const st = stepStatus(step.key);
              return (
                <View key={step.key} style={styles.tstep}>
                  <View style={styles.dotCol}>
                    <View
                      style={[
                        styles.tdot,
                        st === 'done' && styles.tdotDone,
                        st === 'active' && styles.tdotActive,
                      ]}
                    >
                      {st === 'done' ? (
                        <Icon name="check" size={12} stroke={color.greenInk} />
                      ) : null}
                      {st === 'active' ? <View style={styles.pulse} /> : null}
                    </View>
                    {i < steps.length - 1 ? (
                      <View style={[styles.tline, st === 'done' && styles.tlineDone]} />
                    ) : null}
                  </View>
                  <View style={styles.tstepText}>
                    <Text style={[styles.tlabel, st === 'pending' && styles.tlabelPending]}>
                      {step.label}
                    </Text>
                    {st === 'active' ? (
                      <Text style={styles.tsub}>{t('order.inProgress')}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Notice
            tone="red"
            icon="alert"
            title={t('order.failedTitle')}
            body={t('order.failedBody')}
          />
        )}

        <View style={styles.sec}>
          <Text style={styles.secLabel}>{t('order.summary')}</Text>
        </View>
        <View style={styles.sum}>
          <SumRow k={t('order.amount')} v={formatLira(amountTry, locale)} />
          <SumRow
            k={settled ? t('order.receive') : t('order.receiveEst')}
            v={`${settled ? '' : '≈ '}${formatUsdc(expectedUsdc, locale)}`}
          />
          <SumRow k={t('order.savaRef')} v={orderId.slice(0, 8)} mono last />
        </View>

        {settled && hash ? (
          <>
            <View style={styles.sec}>
              <Text style={styles.secLabel}>{t('order.tx')}</Text>
            </View>
            <CopyRow
              label={t('order.tx')}
              value={`${hash.slice(0, 6)}…${hash.slice(-6)}`}
              copyValue={hash}
              onCopy={() => nav.toast(t('common.copied'))}
            />
            <View style={{ marginTop: space.s3 }}>
              <Button
                variant="ghost"
                iconName="external"
                label={t('order.viewTx')}
                onPress={() => WebBrowser.openBrowserAsync(stellarExpertTxUrl(NETWORK, hash))}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
        {phase === 'arrived' ? (
          <Button iconName="earn" label={t('order.supplyNow')} onPress={() => nav.go('earn')} />
        ) : phase === 'failed' ? (
          <View style={styles.rowBtns}>
            <View style={styles.flex}>
              <Button variant="ghost" label={t('common.close')} onPress={() => nav.go('home')} />
            </View>
            <View style={styles.flex}>
              <Button
                iconName="help"
                label={t('order.help')}
                onPress={() => nav.toast(t('order.help'))}
              />
            </View>
          </View>
        ) : (
          <Button
            variant="secondary"
            iconName="refresh"
            label={t('order.refresh')}
            loading={refreshing}
            onPress={onRefresh}
          />
        )}
      </View>
    </>
  );
}

function SumRow({ k, v, mono, last }: { k: string; v: string; mono?: boolean; last?: boolean }) {
  return (
    <View style={[styles.sr, !last && styles.srBorder]}>
      <Text style={styles.srK}>{k}</Text>
      <Text style={[styles.srV, mono && styles.srMono]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter },
  statusHero: { alignItems: 'center', paddingTop: space.s6, paddingBottom: space.s4 },
  statusIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s4,
  },
  statusIconOk: { backgroundColor: color.greenSoft },
  statusIconBad: { backgroundColor: color.redSoft },
  statusTitle: { ...type.h2, fontSize: 22, color: color.ink, textAlign: 'center' },
  received: {
    fontFamily: font.extraBold,
    fontSize: 30,
    color: color.green,
    letterSpacing: -0.5,
    marginTop: space.s3,
  },
  statusBody: {
    ...type.body,
    color: color.inkDim,
    textAlign: 'center',
    marginTop: space.s2,
    maxWidth: 280,
  },
  track: { paddingLeft: space.s2, marginTop: space.s2 },
  tstep: { flexDirection: 'row', gap: space.s4 },
  dotCol: { alignItems: 'center' },
  tdot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: color.hair,
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tdotDone: { backgroundColor: color.green, borderColor: color.green },
  tdotActive: { borderColor: color.green },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.green },
  tline: { width: 2, flex: 1, minHeight: 20, backgroundColor: color.hair, marginVertical: 3 },
  tlineDone: { backgroundColor: color.green },
  tstepText: { paddingTop: 1, paddingBottom: space.s6 },
  tlabel: { ...type.bodyStrong, fontSize: 15, color: color.ink },
  tlabelPending: { color: color.inkFaint },
  tsub: { ...type.caption, color: color.inkFaint },
  sec: { marginTop: space.s5, marginBottom: space.s3 },
  secLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  sum: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
  },
  sr: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.s3,
  },
  srBorder: { borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  srK: { ...type.caption, color: color.inkDim },
  srV: { ...type.bodyStrong, fontSize: 13.5, color: color.ink },
  srMono: { fontFamily: font.mono },
  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
  },
  rowBtns: { flexDirection: 'row', gap: space.s3 },
  flex: { flex: 1 },
});
