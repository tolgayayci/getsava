import { color, font, space, type } from '@getsava/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { stubBackendClient } from '../../backend/client';
import { formatLira, formatUsdc, useTranslation } from '../../i18n';
import { FX_TRY_PER_USDC } from '../../lib/fx';
import { useNav } from '../../nav';
import { Button, Icon, Keypad, type KeypadKey, NavHeader, Notice } from '../../ui';

const MIN_TRY = 100;
const MAX_TRY = 200000;
const KYC_TRY = 25164; // ≈ €699
const QUICKS = [500, 1000, 2500, 5000];

const groupTry = (n: number) => new Intl.NumberFormat('de-DE').format(n);

export function AddLiraScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [val, setVal] = useState(0);
  const [busy, setBusy] = useState(false);

  const recv = val / FX_TRY_PER_USDC;
  const below = val > 0 && val < MIN_TRY;
  const above = val > MAX_TRY;
  const kyc = val >= KYC_TRY && val <= MAX_TRY;
  const valid = val >= MIN_TRY && val <= MAX_TRY;
  const symPre = locale !== 'tr';
  const display = val === 0 ? '0' : groupTry(val);

  const press = (k: KeypadKey) => {
    if (k === 'del') {
      setVal((v) => Math.floor(v / 10));
    } else if (k === 'clear') {
      setVal(0);
    } else if (k !== 'decimal') {
      setVal((v) => {
        const next = v * 10 + Number(k);
        return next > 99_999_999 ? v : next;
      });
    }
  };

  const onContinue = async () => {
    setBusy(true);
    try {
      const order = await stubBackendClient.createDepositOrder({ amountTry: String(val) });
      nav.push('mercuryo', {
        orderId: order.orderId,
        amountTry: String(val),
        expectedUsdc: order.expectedUsdc,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <NavHeader title={t('addLira.title')} onBack={nav.back} />
      <View style={styles.body}>
        <View style={styles.amount}>
          <Text style={styles.payLabel}>{t('addLira.youPay')}</Text>
          <View style={styles.amtLine}>
            {symPre ? <Text style={styles.sym}>₺</Text> : null}
            <Text style={[styles.val, val === 0 && styles.valPh]}>{display}</Text>
            {!symPre ? <Text style={[styles.sym, styles.symSuf]}>₺</Text> : null}
          </View>
          <Text style={styles.receive}>
            {t('addLira.receive')}{' '}
            <Text style={styles.receiveMono}>≈ {formatUsdc(recv, locale)}</Text>
          </Text>

          <View style={styles.quick}>
            {QUICKS.map((q) => (
              <Pressable
                key={q}
                style={styles.chip}
                onPress={() => setVal(q)}
                accessibilityRole="button"
              >
                <Text style={styles.chipText}>₺{groupTry(q)}</Text>
              </Pressable>
            ))}
          </View>

          {below ? (
            <View style={styles.errRow}>
              <Icon name="alert" size={13} stroke={color.red} />
              <Text style={styles.errText}>
                {t('addLira.below')} · {formatLira(MIN_TRY, locale)}
              </Text>
            </View>
          ) : null}
          {above ? (
            <View style={styles.errRow}>
              <Icon name="alert" size={13} stroke={color.red} />
              <Text style={styles.errText}>
                {t('addLira.above')} · {formatLira(MAX_TRY, locale)}
              </Text>
            </View>
          ) : null}
          {kyc ? (
            <View style={styles.kyc}>
              <Notice
                tone="blue"
                icon="shieldPlain"
                title={t('addLira.kycTitle')}
                body={t('addLira.kycBody')}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.note}>
          <Icon name="spark" size={13} stroke={color.green} />
          <Text style={styles.noteText}>{t('addLira.buying')}</Text>
        </View>

        <Keypad onKey={press} variant="integer" clearLabel={t('common.cancel')} />
      </View>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.s2 }]}>
        <View style={styles.partner}>
          <Icon name="shieldPlain" size={15} stroke={color.inkFaint} />
          <Text style={styles.partnerText}>{t('addLira.partner')}</Text>
        </View>
        <Button label={t('addLira.cta')} onPress={onContinue} loading={busy} disabled={!valid} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: space.gutter },
  amount: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  payLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  amtLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.s4 },
  sym: { fontFamily: font.semiBold, fontSize: 34, color: color.inkDim },
  symSuf: { marginLeft: 6 },
  val: { fontFamily: font.extraBold, fontSize: 58, color: color.ink, letterSpacing: -1.5 },
  valPh: { color: color.inkFaint },
  receive: { ...type.body, color: color.inkDim, marginTop: space.s4 },
  receiveMono: { fontFamily: font.mono, color: color.ink },
  quick: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: space.s5,
  },
  chip: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  chipText: { fontFamily: font.mono, fontSize: 13, color: color.ink },
  errRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: space.s4,
  },
  errText: { ...type.caption, color: color.red },
  kyc: { marginTop: space.s5, alignSelf: 'stretch' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: space.s4,
    maxWidth: 320,
    alignSelf: 'center',
  },
  noteText: {
    ...type.micro,
    color: color.inkFaint,
    lineHeight: 16,
    textAlign: 'center',
    flexShrink: 1,
  },
  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
    gap: space.s3,
  },
  partner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  partnerText: { ...type.micro, color: color.inkFaint, flex: 1, lineHeight: 16 },
});
