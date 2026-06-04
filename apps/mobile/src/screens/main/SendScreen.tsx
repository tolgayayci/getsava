import {
  buildUsdcPaymentXdr,
  fetchAccount,
  signTransaction,
  stellarExpertTxUrl,
  submitTransaction,
} from '@getsava/sdk-stellar';
import { color, font, radius, space, type } from '@getsava/ui';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '../../auth';
import { useSignRawHash } from '../../auth/privy-hooks';
import { formatLira, formatUsdc, useTranslation } from '../../i18n';
import { usdcToTry } from '../../lib/fx';
import { NETWORK } from '../../lib/network';
import { useBalances } from '../../lib/useBalances';
import { useVaultStore } from '../../lib/vault-store';
import { useNav } from '../../nav';
import { Button, CopyRow, Icon, Keypad, type KeypadKey, NavHeader, Sheet } from '../../ui';

const ADDR_RE = /^G[A-Z2-7]{55}$/;

function shortAddr(a: string): string {
  return a.length > 18 ? `${a.slice(0, 9)}…${a.slice(-6)}` : a;
}

export function SendScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const from = useWalletStore((s) => s.address) ?? '';
  const { signRawHash } = useSignRawHash();
  const { balances, refresh } = useBalances();
  const addSend = useVaultStore((s) => s.addSend);
  const avail = Number.parseFloat(balances.usdc || '0');

  const [raw, setRaw] = useState('');
  const [addr, setAddr] = useState('');
  const [sheet, setSheet] = useState<null | 'confirm' | 'success'>(null);
  const [sending, setSending] = useState(false);
  const [hash, setHash] = useState('');

  const amt = Number.parseFloat(raw || '0') || 0;
  const validAddr = ADDR_RE.test(addr.trim());
  const over = amt > avail + 1e-7;
  const valid = amt > 0 && !over && validAddr;
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

  const paste = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) {
      setAddr(text);
    }
  };

  const onSend = async () => {
    setSending(true);
    try {
      const account = await fetchAccount(NETWORK, from);
      if (account === null) {
        throw new Error('source account not found');
      }
      const xdr = buildUsdcPaymentXdr(NETWORK, from, account.sequence, addr.trim(), amt.toFixed(7));
      const signed = await signTransaction(NETWORK, xdr, from, signRawHash);
      const txHash = await submitTransaction(NETWORK, signed);
      setHash(txHash);
      addSend(amt, usdcToTry(amt), txHash, Date.now());
      setSheet('success');
    } catch {
      setSheet(null);
      nav.toast(t('send.failed'));
    } finally {
      setSending(false);
    }
  };

  const onDone = () => {
    setSheet(null);
    void refresh();
    nav.go('home');
  };

  return (
    <>
      <NavHeader title={t('send.title')} subtitle={t('send.network')} center onBack={nav.back} />
      <View style={styles.body}>
        <View style={styles.amount}>
          <Text style={styles.amtLabel}>{t('send.amount')}</Text>
          <View style={styles.amtLine}>
            <Text style={[styles.val, amt === 0 && styles.valPh]}>{dispAmt}</Text>
            <Text style={styles.cur}>USDC</Text>
          </View>
          <Text style={[styles.eq, over && styles.eqOver]}>
            {over ? t('send.more') : `≈ ${formatLira(usdcToTry(amt), locale)}`}
          </Text>
          <View style={styles.avail}>
            <Text style={styles.availText}>
              {formatUsdc(avail, locale, false)} USDC {t('send.available')}
            </Text>
            <Text style={styles.maxBtn} onPress={() => setRaw(String(Number(avail.toFixed(2))))}>
              {t('common.max')}
            </Text>
          </View>
        </View>

        <View style={[styles.addrField, addr.length > 0 && !validAddr && styles.addrFieldErr]}>
          <TextInput
            style={styles.addrInput}
            value={addr}
            onChangeText={setAddr}
            placeholder={t('send.addrPh')}
            placeholderTextColor={color.inkFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
          />
          <Text style={styles.pasteBtn} onPress={paste}>
            {t('send.paste')}
          </Text>
        </View>
        <View style={styles.warn}>
          <Icon name="alert" size={13} stroke={color.red} />
          <Text style={styles.warnText}>{t('send.reminder')}</Text>
        </View>

        <Keypad onKey={press} variant="decimal" decimalLabel={locale === 'tr' ? ',' : '.'} />
      </View>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
        <Button label={t('send.review')} disabled={!valid} onPress={() => setSheet('confirm')} />
      </View>

      <Sheet
        visible={sheet === 'confirm'}
        onClose={sending ? undefined : () => setSheet(null)}
        title={t('send.authAction')}
        dock={<Button label={t('send.cta')} loading={sending} onPress={onSend} />}
      >
        <View style={styles.sum}>
          <SumRow k={t('send.amount')} v={formatUsdc(amt, locale)} />
          <SumRow k={t('send.toAddr')} v={shortAddr(addr.trim())} mono />
          <SumRow k={t('send.networkLabel')} v="Stellar" last />
        </View>
        <Text style={styles.netNote}>{t('send.netNote')}</Text>
      </Sheet>

      <Sheet
        visible={sheet === 'success'}
        onClose={onDone}
        dock={<Button label={t('common.done')} onPress={onDone} />}
      >
        <View style={styles.successHero}>
          <View style={styles.successIc}>
            <Icon name="check" size={34} stroke={color.green} />
          </View>
          <Text style={styles.successTitle}>{t('send.successTitle')}</Text>
          <Text style={styles.successBody}>{t('send.successBody')}</Text>
        </View>
        {hash ? (
          <>
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
                label={t('send.viewTx')}
                onPress={() => WebBrowser.openBrowserAsync(stellarExpertTxUrl(NETWORK, hash))}
              />
            </View>
          </>
        ) : null}
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
  addrField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingLeft: space.s4,
    paddingRight: space.s2,
    height: 56,
    marginTop: space.s6,
  },
  addrFieldErr: { borderColor: color.red },
  addrInput: { flex: 1, ...type.bodyStrong, fontFamily: font.mono, fontSize: 13, color: color.ink },
  pasteBtn: {
    ...type.caption,
    color: color.purple,
    fontFamily: font.bold,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: space.s3,
    marginBottom: space.s4,
  },
  warnText: { ...type.micro, color: color.red, fontFamily: font.semiBold, lineHeight: 15 },
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
  },
  srBorder: { borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  srK: { ...type.caption, color: color.inkDim },
  srV: { ...type.bodyStrong, fontSize: 13.5, color: color.ink },
  srMono: { fontFamily: font.mono },
  netNote: { ...type.micro, color: color.red, marginTop: space.s3, lineHeight: 16 },
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
  successTitle: { ...type.h2, fontSize: 22, color: color.ink },
  successBody: {
    ...type.body,
    color: color.inkDim,
    textAlign: 'center',
    marginTop: space.s2,
    maxWidth: 280,
  },
});
