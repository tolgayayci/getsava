import { color, font, radius, space, type } from '@getsava/ui';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWalletStore } from '../../auth';
import { useTranslation } from '../../i18n';
import { useNav } from '../../nav';
import { Button, Icon, type IconName, NavHeader, QrCode, UsdcMark } from '../../ui';

/**
 * Receive USDC (YK-570). Two steps: a warning gate, then the address + QR.
 * No MEMO — each user has a dedicated Privy Stellar account, so the address
 * alone routes funds (see the handoff README "MEMO note").
 */
export function ReceiveScreen() {
  const { t } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const address = useWalletStore((s) => s.address) ?? '';
  const [step, setStep] = useState<'warn' | 'address'>('warn');
  const [ack, setAck] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    nav.toast(t('receive.addrCopied'));
    setTimeout(() => setCopied(false), 1600);
  };

  const warnings: Array<{ icon: IconName; title: string; body: string }> = [
    { icon: 'alert', title: t('receive.w1Title'), body: t('receive.w1Body') },
    { icon: 'spark', title: t('receive.w2Title'), body: t('receive.w2Body') },
    { icon: 'lock', title: t('receive.w3Title'), body: t('receive.w3Body') },
  ];

  if (step === 'warn') {
    return (
      <>
        <NavHeader title={t('receive.title')} onBack={nav.back} leading={<UsdcMark size={22} />} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.body, styles.warnCenter, { paddingBottom: space.s4 }]}
        >
          <View style={styles.warnHero}>
            <View style={styles.warnIc}>
              <Icon name="alert" size={30} stroke={color.red} />
            </View>
            <Text style={styles.warnTitle}>{t('receive.warnTitle')}</Text>
            <Text style={styles.warnLead}>{t('receive.warnLead')}</Text>
          </View>
          <View style={styles.warnList}>
            {warnings.map((w) => (
              <View key={w.title} style={styles.wrow}>
                <View style={styles.wrowIc}>
                  <Icon name={w.icon} size={17} stroke={color.red} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.wrowTitle}>{w.title}</Text>
                  <Text style={styles.wrowBody}>{w.body}</Text>
                </View>
              </View>
            ))}
          </View>
          <Pressable
            style={[styles.ackBox, ack && styles.ackBoxOn]}
            onPress={() => setAck((v) => !v)}
          >
            <View style={[styles.checkbox, ack && styles.checkboxOn]}>
              {ack ? <Icon name="check" size={14} stroke="#fff" /> : null}
            </View>
            <Text style={styles.ackText}>{t('receive.ack')}</Text>
          </Pressable>
        </ScrollView>
        <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
          <Button label={t('receive.show')} disabled={!ack} onPress={() => setStep('address')} />
        </View>
      </>
    );
  }

  return (
    <>
      <NavHeader
        title={t('receive.title')}
        onBack={() => setStep('warn')}
        leading={<UsdcMark size={22} />}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: space.s4 }]}
      >
        <View style={styles.qrWrap}>
          <QrCode value={address} size={176} />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldKey}>{t('receive.addr')}</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.addr} selectable>
              <Text style={styles.addrHl}>{address.slice(0, 6)}</Text>
              {address.slice(6, -6)}
              <Text style={styles.addrHl}>{address.slice(-6)}</Text>
            </Text>
            <Pressable style={[styles.copyBtn, copied && styles.copyBtnOn]} onPress={copy}>
              <Icon
                name={copied ? 'check' : 'copy'}
                size={17}
                stroke={copied ? color.purple : color.inkDim}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.meta}>
          <MetaRow k={t('receive.net')} v={t('receive.netValue')} dot />
          <MetaRow k={t('receive.asset')} v="USDC" />
          <MetaRow k={t('receive.min')} v={t('receive.minValue')} />
          <MetaRow k={t('receive.time')} v={t('receive.timeValue')} dim last />
        </View>
      </ScrollView>
      <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
        <Button iconName="copy" label={t('receive.copyAddr')} onPress={copy} />
      </View>
    </>
  );
}

function MetaRow({
  k,
  v,
  dot,
  dim,
  last,
}: {
  k: string;
  v: string;
  dot?: boolean;
  dim?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.metaRow, !last && styles.metaBorder]}>
      <Text style={styles.metaK}>{k}</Text>
      <View style={styles.metaVWrap}>
        {dot ? <View style={styles.greenDot} /> : null}
        <Text style={[styles.metaV, dim && styles.metaVDim]}>{v}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter },
  warnCenter: { flexGrow: 1, justifyContent: 'center' },
  flex: { flex: 1 },

  warnHero: { alignItems: 'center', paddingTop: space.s4, paddingBottom: space.s1 },
  warnIc: {
    width: 64,
    height: 64,
    borderRadius: 19,
    backgroundColor: color.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s4,
  },
  warnTitle: { ...type.h2, fontSize: 22, color: color.ink, textAlign: 'center' },
  warnLead: {
    ...type.body,
    color: color.inkDim,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 300,
  },
  warnList: { marginTop: space.s6 },
  wrow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: color.hairSoft,
  },
  wrowIc: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: color.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrowTitle: { ...type.bodyStrong, fontSize: 14.5, color: color.ink },
  wrowBody: { ...type.caption, color: color.inkDim, marginTop: 3, lineHeight: 18 },
  ackBox: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    padding: 16,
    marginTop: space.s5,
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

  qrWrap: { alignItems: 'center', marginTop: space.s2, marginBottom: space.s5 },
  field: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: color.hair },
  fieldKey: {
    ...type.label,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginBottom: 8,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addr: { flex: 1, fontFamily: font.mono, fontSize: 15, color: color.ink, lineHeight: 22 },
  addrHl: { color: color.purple, fontFamily: font.monoMedium },
  copyBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBtnOn: { borderColor: color.purple },
  meta: { paddingTop: 6 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  metaBorder: { borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  metaK: { ...type.body, color: color.inkDim },
  metaVWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaV: { ...type.bodyStrong, fontSize: 14, color: color.ink },
  metaVDim: { fontFamily: font.regular, color: color.inkDim },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.green },
  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
  },
});
