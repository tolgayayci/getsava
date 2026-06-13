import { stellarExpertTxUrl } from '@getsava/sdk-stellar';
import { color, font, radius, space, type } from '@getsava/ui';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLira, formatPct, formatUsdc, useTranslation } from '../../i18n';
import { useCircuit } from '../../lib/circuit';
import { usdcToTry } from '../../lib/fx';
import { NETWORK } from '../../lib/network';
import { useBalances } from '../../lib/useBalances';
import { useVault } from '../../lib/useVault';
import { useNav } from '../../nav';
import { Button, CopyRow, Icon, Keypad, type KeypadKey, NavHeader, Notice, VarTag } from '../../ui';
import { VaultSummary } from '../../ui/vault-bits';

type Step = 'amount' | 'disclosure' | 'confirm' | 'submitting' | 'success' | 'failed';

/**
 * Supply USDC to the Blend pool (YK earn flow). A single pushed route that runs
 * the whole flow with internal step state: type the amount → acknowledge the
 * disclosures → review & sign → submit → success / failed. All Blend access goes
 * through `useVault()` (supply-only); the real on-chain tx hash is shown on success.
 */
export function SupplyScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { vault, supply } = useVault();
  const { balances, refresh } = useBalances();
  const circuit = useCircuit();
  const avail = Number.parseFloat(balances.usdc || '0');

  const [step, setStep] = useState<Step>('amount');
  const [raw, setRaw] = useState('');
  const [acks, setAcks] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [hash, setHash] = useState('');

  const amt = Number.parseFloat(raw || '0') || 0;
  const over = amt > avail + 1e-7;
  const valid = amt > 0 && !over;
  const allAck = acks.every(Boolean);
  const dispAmt = raw === '' ? '0' : locale === 'tr' ? raw.replace('.', ',') : raw;

  const press = (k: KeypadKey) => {
    setRaw((r) => {
      if (k === 'del') return r.slice(0, -1);
      if (k === 'decimal') return r.includes('.') ? r : r === '' ? '0.' : `${r}.`;
      if (k === 'clear') return '';
      if (r.includes('.') && (r.split('.')[1]?.length ?? 0) >= 2) return r;
      if (r.replace('.', '').length >= 9) return r;
      return r === '0' ? k : r + k;
    });
  };

  const toggleAck = (i: number) => {
    setAcks((a) => a.map((v, j) => (j === i ? !v : v)) as [boolean, boolean, boolean]);
  };

  const onSupply = async () => {
    setStep('submitting');
    try {
      const txHash = await supply(amt);
      setHash(txHash);
      setStep('success');
    } catch {
      setStep('failed');
    }
  };

  const onDone = () => {
    void refresh();
    nav.go('home');
  };

  const rateLabel = vault ? formatPct(vault.apy, locale) : '—';

  // ---- amount -------------------------------------------------------------
  if (step === 'amount') {
    return (
      <>
        <NavHeader title={t('supplyFlow.title')} onBack={nav.back} />
        <View style={styles.body}>
          {circuit.tripped ? (
            <View style={styles.haltNotice}>
              <Notice
                tone="red"
                icon="alert"
                title={t('circuit.haltedTitle')}
                body={t('circuit.haltedBody')}
              />
            </View>
          ) : null}
          {vault ? <VaultSummary name={vault.name} apy={vault.apy} mode="supply" /> : null}
          <View style={styles.amount}>
            <Text style={styles.amtLabel}>{t('supplyFlow.amountLabel')}</Text>
            <View style={styles.amtLine}>
              <Text style={[styles.val, amt === 0 && styles.valPh]}>{dispAmt}</Text>
              <Text style={styles.cur}>USDC</Text>
            </View>
            <Text style={[styles.eq, over && styles.eqOver]}>
              {over ? t('supplyFlow.over') : `≈ ${formatLira(usdcToTry(amt), locale)}`}
            </Text>
            <View style={styles.avail}>
              <Text style={styles.availText}>
                {formatUsdc(avail, locale, false)} USDC {t('supplyFlow.available')}
              </Text>
              <Text style={styles.maxBtn} onPress={() => setRaw(String(Number(avail.toFixed(2))))}>
                {t('common.max')}
              </Text>
            </View>
          </View>
          <Keypad onKey={press} variant="decimal" decimalLabel={locale === 'tr' ? ',' : '.'} />
        </View>
        <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
          <Button
            label={circuit.tripped ? t('circuit.depositsPaused') : t('supplyFlow.review')}
            disabled={!valid || circuit.tripped}
            onPress={() => setStep('disclosure')}
          />
        </View>
      </>
    );
  }

  // ---- disclosure ---------------------------------------------------------
  if (step === 'disclosure') {
    const ackKeys = ['supplyFlow.ack1', 'supplyFlow.ack2', 'supplyFlow.ack3'] as const;
    return (
      <>
        <NavHeader title={t('supplyFlow.disclosureTitle')} onBack={() => setStep('amount')} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollBody, { paddingBottom: space.s4 }]}
        >
          <View style={styles.ackList}>
            {ackKeys.map((key, i) => (
              <Pressable
                key={key}
                style={[styles.ackBox, acks[i] && styles.ackBoxOn]}
                onPress={() => toggleAck(i)}
              >
                <View style={[styles.checkbox, acks[i] && styles.checkboxOn]}>
                  {acks[i] ? <Icon name="check" size={14} stroke={color.purpleInk} /> : null}
                </View>
                <Text style={styles.ackText}>{t(key)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
          <Button
            label={t('common.continue')}
            disabled={!allAck}
            onPress={() => setStep('confirm')}
          />
        </View>
      </>
    );
  }

  // ---- confirm / submitting ----------------------------------------------
  if (step === 'confirm' || step === 'submitting') {
    const busy = step === 'submitting';
    return (
      <>
        <NavHeader
          title={t('supplyFlow.authTitle')}
          {...(busy ? {} : { onBack: () => setStep('disclosure') })}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollBody, { paddingBottom: space.s4 }]}
        >
          <View style={styles.sum}>
            <SumRow k={t('supplyFlow.action')} v={vault ? vault.name : 'USDC'} />
            <SumRow
              k={t('supplyFlow.amountLabel')}
              v={`${formatUsdc(amt, locale)} · ${formatLira(usdcToTry(amt), locale)}`}
            />
            <SumRow k={t('supplyFlow.rateNow')} v={rateLabel} tag />
            <SumRow k={t('supplyFlow.fromWallet')} v={t('common.appName')} last />
          </View>
          <View style={styles.note}>
            <Icon name="key" size={13} stroke={color.inkFaint} />
            <Text style={styles.noteText}>{t('risk.variableFull')}</Text>
          </View>
        </ScrollView>
        <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
          <Button label={t('supplyFlow.sign')} loading={busy} onPress={onSupply} />
        </View>
      </>
    );
  }

  // ---- failed -------------------------------------------------------------
  if (step === 'failed') {
    return (
      <>
        <NavHeader title={t('supplyFlow.title')} onBack={nav.back} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollBody, { paddingBottom: space.s4 }]}
        >
          <View style={styles.failHero}>
            <Notice
              tone="red"
              icon="alert"
              title={t('supplyFlow.title')}
              body={t('supplyFlow.failed')}
            />
          </View>
        </ScrollView>
        <View style={[styles.dock, styles.dockRow, { paddingBottom: insets.bottom + space.s2 }]}>
          <View style={styles.flex}>
            <Button variant="ghost" label={t('common.close')} onPress={() => nav.back()} />
          </View>
          <View style={styles.flex}>
            <Button label={t('common.retry')} onPress={() => setStep('amount')} />
          </View>
        </View>
      </>
    );
  }

  // ---- success ------------------------------------------------------------
  return (
    <>
      <NavHeader title={t('supplyFlow.title')} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollBody, { paddingBottom: space.s4 }]}
      >
        <View style={styles.successHero}>
          <View style={styles.successIc}>
            <Icon name="check" size={34} stroke={color.green} />
          </View>
          <Text style={styles.successTitle}>{t('supplyFlow.successTitle')}</Text>
          <Text style={styles.successBody}>{t('supplyFlow.successBody')}</Text>
        </View>
        {hash ? (
          <>
            <CopyRow
              label={t('order.tx')}
              value={`${hash.slice(0, 6)}…${hash.slice(-6)}`}
              copyValue={hash}
              onCopy={() => nav.toast(t('common.copied'))}
            />
            <View style={styles.explorer}>
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
        <Button label={t('common.done')} onPress={onDone} />
      </View>
    </>
  );
}

function SumRow({
  k,
  v,
  mono,
  tag,
  last,
}: {
  k: string;
  v: string;
  mono?: boolean;
  tag?: boolean;
  last?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.sr, !last && styles.srBorder]}>
      <Text style={styles.srK}>{k}</Text>
      <View style={styles.srVWrap}>
        <Text style={[styles.srV, mono && styles.srMono]}>{v}</Text>
        {tag ? <VarTag label={t('common.variable')} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space.s2 },
  haltNotice: { marginBottom: space.s3 },
  scroll: { flex: 1 },
  scrollBody: { paddingHorizontal: space.gutter, paddingTop: space.s4 },
  flex: { flex: 1 },

  amount: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  amtLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginBottom: space.s4,
  },
  amtLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 12 },
  val: { fontFamily: font.extraBold, fontSize: 46, color: color.ink, letterSpacing: -1.4 },
  valPh: { color: color.inkFaint },
  cur: { fontFamily: font.bold, fontSize: 19, color: color.inkFaint },
  eq: { ...type.body, color: color.inkDim, marginTop: 12 },
  eqOver: { color: color.red },
  avail: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  availText: { ...type.caption, color: color.inkFaint },
  maxBtn: {
    ...type.caption,
    color: color.purple,
    fontFamily: font.bold,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
  },

  ackList: { gap: space.s3 },
  ackBox: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    padding: 16,
  },
  ackBoxOn: { borderColor: color.purpleBd },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: color.purple, borderColor: color.purple },
  ackText: {
    ...type.caption,
    fontFamily: font.semiBold,
    color: color.ink,
    flex: 1,
    lineHeight: 19,
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
    gap: space.s3,
  },
  srBorder: { borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  srK: { ...type.caption, color: color.inkDim },
  srVWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  srV: { ...type.bodyStrong, fontSize: 13.5, color: color.ink, textAlign: 'right', flexShrink: 1 },
  srMono: { fontFamily: font.mono },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: space.s3,
  },
  noteText: { ...type.micro, color: color.inkFaint, lineHeight: 16, flex: 1 },

  successHero: { alignItems: 'center', paddingTop: space.s4, paddingBottom: space.s5 },
  successIc: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: color.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s4,
  },
  successTitle: { ...type.h2, fontSize: 22, color: color.ink },
  successBody: {
    ...type.body,
    color: color.inkDim,
    textAlign: 'center',
    marginTop: space.s2,
    maxWidth: 280,
  },
  explorer: { marginTop: space.s3 },

  failHero: { paddingTop: space.s5 },

  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
  },
  dockRow: { flexDirection: 'row', gap: space.s3 },
});
