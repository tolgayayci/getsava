import { color, radius, space, type } from '@getsava/ui';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, useWalletStore } from '../../auth';
import { useTranslation } from '../../i18n';
import { useNav } from '../../nav';
import { Button, CopyRow, Icon, type IconName, Sheet } from '../../ui';

function short(addr: string): string {
  return addr.length > 16 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
}

export function SettingsScreen() {
  const { t, locale, setLocale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { signOut } = useSession();
  const address = useWalletStore((s) => s.address) ?? '';
  const email = useWalletStore((s) => s.email);
  const [sheet, setSheet] = useState<null | 'wallet' | 'signout'>(null);

  const legal: Array<{ key: string; label: string }> = [
    { key: 'terms', label: t('settings.terms') },
    { key: 'privacy', label: t('settings.privacy') },
    { key: 'tax', label: t('settings.tax') },
  ];

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.wm}>{t('settings.title')}</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s6 }]}
      >
        <Text style={styles.secLabel}>{t('settings.language')}</Text>
        <View style={styles.seg}>
          <Pressable
            style={[styles.segBtn, locale === 'en' && styles.segBtnOn]}
            onPress={() => setLocale('en')}
          >
            <Text style={[styles.segText, locale === 'en' && styles.segTextOn]}>English</Text>
          </Pressable>
          <Pressable
            style={[styles.segBtn, locale === 'tr' && styles.segBtnOn]}
            onPress={() => setLocale('tr')}
          >
            <Text style={[styles.segText, locale === 'tr' && styles.segTextOn]}>Türkçe</Text>
          </Pressable>
        </View>

        <Text style={[styles.secLabel, styles.secGap]}>{t('settings.account')}</Text>
        <View style={styles.group}>
          <Row icon="mail" title={t('settings.email')} sub={email ?? '—'} />
        </View>
        <View style={{ marginTop: space.s3 }}>
          <CopyRow
            label={t('settings.wallet')}
            value={short(address)}
            copyValue={address}
            onCopy={() => nav.toast(t('settings.addrCopied'))}
          />
        </View>
        <Button
          variant="quiet"
          iconName="info"
          label={t('settings.walletWhat')}
          onPress={() => setSheet('wallet')}
        />

        <Text style={[styles.secLabel, styles.secGap]}>{t('settings.legal')}</Text>
        <View style={styles.group}>
          {legal.map((l, i) => (
            <Pressable
              key={l.key}
              style={[styles.row, i < legal.length - 1 && styles.rowBorder]}
              onPress={() => nav.toast(l.label)}
            >
              <View style={styles.rowIc}>
                <Icon name="doc" size={17} stroke={color.inkDim} />
              </View>
              <Text style={styles.rowTitle}>{l.label}</Text>
              <Icon name="chevR" size={18} stroke={color.inkFaint} />
            </Pressable>
          ))}
        </View>
        <View style={styles.nonCustodial}>
          <Icon name="key" size={14} stroke={color.inkFaint} />
          <Text style={styles.nonCustodialText}>{t('settings.nonCustodial')}</Text>
        </View>

        <Text style={[styles.secLabel, styles.secGap]}>{t('settings.app')}</Text>
        <View style={styles.group}>
          <Pressable style={styles.row} onPress={() => setSheet('signout')}>
            <View style={[styles.rowIc, styles.rowIcDanger]}>
              <Icon name="signout" size={17} stroke={color.red} />
            </View>
            <Text style={[styles.rowTitle, { color: color.red }]}>{t('settings.signOut')}</Text>
          </Pressable>
        </View>
        <Text style={styles.version}>{t('settings.version')} 1.0.0 (1)</Text>
      </ScrollView>

      <Sheet
        visible={sheet === 'wallet'}
        onClose={() => setSheet(null)}
        title={t('settings.wallet')}
        dock={
          <Button variant="secondary" label={t('common.done')} onPress={() => setSheet(null)} />
        }
      >
        <CopyRow
          label={t('settings.wallet')}
          value={short(address)}
          copyValue={address}
          onCopy={() => nav.toast(t('settings.addrCopied'))}
        />
        <Text style={styles.sheetBody}>{t('settings.walletWhatBody')}</Text>
      </Sheet>

      <Sheet
        visible={sheet === 'signout'}
        onClose={() => setSheet(null)}
        title={t('settings.signOutQ')}
        dock={
          <View style={styles.rowBtns}>
            <View style={styles.flex}>
              <Button variant="ghost" label={t('common.cancel')} onPress={() => setSheet(null)} />
            </View>
            <View style={styles.flex}>
              <Button
                variant="danger"
                label={t('settings.signOut')}
                onPress={() => {
                  setSheet(null);
                  signOut();
                }}
              />
            </View>
          </View>
        }
      >
        <Text style={styles.sheetBody}>{t('settings.signOutBody')}</Text>
      </Sheet>
    </>
  );
}

function Row({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIc}>
        <Icon name={icon} size={17} stroke={color.inkDim} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 50, justifyContent: 'center', paddingHorizontal: space.gutter },
  wm: { ...type.title, color: color.ink },
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter, paddingTop: space.s1 },
  secLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginBottom: space.s3,
  },
  secGap: { marginTop: space.s6 },
  seg: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: 9,
    padding: 3,
  },
  segBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 7 },
  segBtnOn: { backgroundColor: color.ink },
  segText: { ...type.bodyStrong, fontSize: 13, color: color.inkDim },
  segTextOn: { color: '#000' },
  group: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s3, padding: space.s4 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  rowIc: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcDanger: { backgroundColor: color.redSoft },
  rowTitle: { ...type.bodyStrong, fontSize: 14.5, color: color.ink },
  rowSub: { ...type.caption, color: color.inkFaint, marginTop: 1 },
  flex: { flex: 1 },
  nonCustodial: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: space.s4 },
  nonCustodialText: { ...type.caption, color: color.inkFaint },
  version: { ...type.mono, color: color.inkFaint, textAlign: 'center', marginTop: space.s5 },
  sheetBody: { ...type.body, color: color.inkDim, marginTop: space.s4, lineHeight: 22 },
  rowBtns: { flexDirection: 'row', gap: space.s3 },
});
