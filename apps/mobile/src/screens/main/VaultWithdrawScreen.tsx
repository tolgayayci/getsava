import type { WithdrawMode } from '@getsava/sdk-blend';
import { stellarExpertTxUrl } from '@getsava/sdk-stellar';
import { color, font, radius, space, type } from '@getsava/ui';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLira, formatUsdc, useTranslation } from '../../i18n';
import { usdcToTry } from '../../lib/fx';
import { NETWORK } from '../../lib/network';
import { useVault } from '../../lib/useVault';
import { useNav } from '../../nav';
import { Button, CopyRow, Icon, Keypad, type KeypadKey, NavHeader, Sheet } from '../../ui';
import { VaultSummary } from '../../ui/vault-bits';

type Step = 'amount' | 'confirm' | 'submitting' | 'success' | 'failed';

/** Liquidity-shortfall errors get a friendlier, actionable message. */
function isLiquidityError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes('liquidity') || msg.includes('insufficient') || msg.includes('balance');
}

export function VaultWithdrawScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { vault, withdraw } = useVault();

  const supplied = vault?.suppliedUsdc ?? 0;

  const [raw, setRaw] = useState('');
  const [isMax, setIsMax] = useState(false);
  const [step, setStep] = useState<Step>('amount');
  const [hash, setHash] = useState('');
  const [liquidity, setLiquidity] = useState(false);

  const amt = Number.parseFloat(raw || '0') || 0;
  const over = amt > supplied + 1e-7;
  const valid = amt > 0 && !over;
  const remaining = Math.max(0, supplied - amt);
  const dispAmt = raw === '' ? '0' : locale === 'tr' ? raw.replace('.', ',') : raw;

  const press = (k: KeypadKey) => {
    setIsMax(false);
    setRaw((r) => {
      if (k === 'del') return r.slice(0, -1);
      if (k === 'decimal') return r.includes('.') ? r : r === '' ? '0.' : `${r}.`;
      if (k === 'clear') return '';
      if (r.includes('.') && (r.split('.')[1]?.length ?? 0) >= 2) return r;
      if (r.replace('.', '').length >= 9) return r;
      return r === '0' ? k : r + k;
    });
  };

  const onMax = () => {
    setRaw(String(Number(supplied.toFixed(2))));
    setIsMax(true);
  };

  const onSubmit = async () => {
    if (!vault) return;
    setStep('submitting');
    setLiquidity(false);
    try {
      const mode: WithdrawMode = isMax ? { kind: 'all' } : { kind: 'partial', humanUsdc: amt };
      const txHash = await withdraw(mode, isMax ? supplied : amt);
      setHash(txHash);
      setStep('success');
    } catch (err) {
      setLiquidity(isLiquidityError(err));
      setStep('failed');
    }
  };

  const onDone = () => {
    setStep('amount');
    nav.go('home');
  };

  return (
    <>
      <NavHeader title={t('vaultWithdraw.title')} onBack={nav.back} />
      <View style={styles.body}>
        {vault ? (
          <VaultSummary
            name={vault.name}
            apy={vault.apy}
            mode="withdraw"
            suppliedUsdc={vault.suppliedUsdc}
            yieldUsdc={vault.yieldUsdc}
          />
        ) : null}

        <View style={styles.amount}>
          <Text style={styles.amtLabel}>{t('vaultWithdraw.amountLabel')}</Text>
          <View style={styles.amtLine}>
            <Text style={[styles.val, amt === 0 && styles.valPh]}>{dispAmt}</Text>
            <Text style={styles.cur}>USDC</Text>
          </View>
          <Text style={[styles.eq, over && styles.eqOver]}>
            {over ? t('vaultWithdraw.over') : `≈ ${formatLira(usdcToTry(amt), locale)}`}
          </Text>
          <View style={styles.avail}>
            <Text style={styles.availText}>
              {formatUsdc(supplied, locale, false)} USDC {t('vaultWithdraw.inPosition')}
            </Text>
            <Text style={styles.maxBtn} onPress={onMax}>
              {t('common.max')}
            </Text>
          </View>
        </View>

        <View style={styles.dest}>
          <Icon name="wallet" size={13} stroke={color.green} />
          <Text style={styles.destText}>{t('vaultWithdraw.dest')}</Text>
        </View>

        <Keypad onKey={press} variant="decimal" decimalLabel={locale === 'tr' ? ',' : '.'} />
      </View>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
        <Button
          label={t('vaultWithdraw.review')}
          disabled={!valid}
          onPress={() => setStep('confirm')}
        />
      </View>

      <Sheet
        visible={step === 'confirm' || step === 'submitting'}
        onClose={step === 'submitting' ? undefined : () => setStep('amount')}
        title={t('vaultWithdraw.authTitle')}
        dock={
          <Button
            label={t('vaultWithdraw.cta')}
            loading={step === 'submitting'}
            onPress={onSubmit}
          />
        }
      >
        <View style={styles.sum}>
          <SumRow k={t('vaultWithdraw.action')} v={vault?.name ?? 'USDC'} />
          <SumRow
            k={t('vaultWithdraw.amountLabel')}
            v={`${formatUsdc(amt, locale)} · ${formatLira(usdcToTry(amt), locale)}`}
          />
          <SumRow k={t('vaultWithdraw.toWallet')} v={t('vaultWithdraw.dest')} />
          <SumRow k={t('vaultWithdraw.remaining')} v={formatUsdc(remaining, locale)} last />
        </View>
        <Text style={styles.note}>{t('vaultWithdraw.note')}</Text>
      </Sheet>

      <Sheet
        visible={step === 'success'}
        onClose={onDone}
        dock={<Button label={t('common.done')} onPress={onDone} />}
      >
        <View style={styles.successHero}>
          <View style={styles.successIc}>
            <Icon name="check" size={34} stroke={color.green} />
          </View>
          <Text style={styles.successTitle}>{t('vaultWithdraw.successTitle')}</Text>
          <Text style={styles.successBody}>{t('vaultWithdraw.successBody')}</Text>
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
      </Sheet>

      <Sheet
        visible={step === 'failed'}
        onClose={() => setStep('amount')}
        dock={
          <Button
            label={t('common.retry')}
            iconName="refresh"
            variant="secondary"
            onPress={() => setStep('confirm')}
          />
        }
      >
        <View style={styles.successHero}>
          <View style={styles.failIc}>
            <Icon name="alert" size={32} stroke={color.red} />
          </View>
          <Text style={styles.successTitle}>{t('vaultWithdraw.title')}</Text>
          <Text style={styles.successBody}>
            {liquidity ? t('vaultWithdraw.liquidity') : t('supplyFlow.failed')}
          </Text>
        </View>
      </Sheet>
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
  body: { flex: 1, paddingHorizontal: space.gutter },
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
  dest: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: space.s2,
    marginBottom: space.s4,
  },
  destText: { ...type.micro, color: color.green, fontFamily: font.semiBold, lineHeight: 15 },
  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
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
    gap: space.s4,
  },
  srBorder: { borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  srK: { ...type.caption, color: color.inkDim },
  srV: { ...type.bodyStrong, fontSize: 13.5, color: color.ink, flexShrink: 1, textAlign: 'right' },
  srMono: { fontFamily: font.mono },
  note: { ...type.micro, color: color.inkFaint, marginTop: space.s3, lineHeight: 16 },
  explorer: { marginTop: space.s3 },
  successHero: { alignItems: 'center', paddingTop: space.s3, paddingBottom: space.s4 },
  successIc: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: color.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s4,
  },
  failIc: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: color.redSoft,
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
});
