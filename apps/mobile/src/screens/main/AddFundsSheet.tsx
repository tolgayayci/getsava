import { color, font, radius, space, type } from '@getsava/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../i18n';
import { useNav } from '../../nav';
import { Icon, Sheet } from '../../ui';

/** "Add Funds" hub: pick card on-ramp (→ Add Lira) or receive USDC (→ Receive). */
export function AddFundsSheet() {
  const { t } = useTranslation();
  const nav = useNav();
  const visible = nav.sheet?.id === 'addFunds';

  return (
    <Sheet visible={visible} onClose={nav.closeSheet} title={t('addFunds.title')}>
      <Text style={styles.sub}>{t('addFunds.sub')}</Text>

      <Method
        tone="card"
        icon="card"
        title={t('addFunds.cardTitle')}
        tag={t('addFunds.cardTag')}
        desc={t('addFunds.cardDesc')}
        onPress={() => nav.push('addLira')}
      />
      <Method
        tone="recv"
        icon="arrowDown"
        title={t('addFunds.recvTitle')}
        tag={t('addFunds.recvTag')}
        desc={t('addFunds.recvDesc')}
        onPress={() => nav.push('receive')}
      />

      <View style={styles.note}>
        <Icon name="key" size={12} stroke={color.inkFaint} />
        <Text style={styles.noteText}>{t('settings.nonCustodial')}</Text>
      </View>
    </Sheet>
  );
}

function Method({
  tone,
  icon,
  title,
  tag,
  desc,
  onPress,
}: {
  tone: 'card' | 'recv';
  icon: 'card' | 'arrowDown';
  title: string;
  tag: string;
  desc: string;
  onPress: () => void;
}) {
  const tint = tone === 'card' ? color.purple : color.green;
  const bg = tone === 'card' ? color.purpleSoft : color.greenSoft;
  return (
    <Pressable style={styles.method} onPress={onPress} accessibilityRole="button">
      <View style={[styles.methodIc, { backgroundColor: bg }]}>
        <Icon name={icon} size={22} stroke={tint} />
      </View>
      <View style={styles.methodMid}>
        <View style={styles.methodTop}>
          <Text style={styles.methodTitle}>{title}</Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        </View>
        <Text style={styles.methodDesc}>{desc}</Text>
      </View>
      <Icon name="chevR" size={18} stroke={color.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sub: { ...type.body, color: color.inkDim, marginTop: -2, marginBottom: space.s4 },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 10,
  },
  methodIc: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodMid: { flex: 1 },
  methodTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  methodTitle: { ...type.bodyStrong, color: color.ink },
  tag: {
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { fontFamily: font.mono, fontSize: 10, color: color.inkFaint },
  methodDesc: { ...type.caption, color: color.inkDim, marginTop: 4 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.s4,
  },
  noteText: { ...type.micro, color: color.inkFaint },
});
