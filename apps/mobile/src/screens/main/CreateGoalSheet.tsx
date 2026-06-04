import { color, font, radius, space, type } from '@getsava/ui';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from '../../i18n';
import { FX_TRY_PER_USDC } from '../../lib/fx';
import { type GoalColor, type GoalIcon, useGoalsStore } from '../../lib/goals-store';
import { useNav } from '../../nav';
import { Button, Icon, Sheet } from '../../ui';
import { GOAL_TINT } from '../../ui/goal-bits';

const ICONS: { icon: GoalIcon; color: GoalColor }[] = [
  { icon: 'plane', color: 'purple' },
  { icon: 'home', color: 'green' },
  { icon: 'shield', color: 'blue' },
  { icon: 'gift', color: 'amber' },
  { icon: 'earn', color: 'green' },
  { icon: 'globe', color: 'purple' },
];
const TARGET_CHIPS = [250, 500, 1000, 5000];
const MIN_TARGET = 10;

/** Bottom sheet to create a savings goal. Mounted in the shell; shows when the
 * nav sheet id is "createGoal". */
export function CreateGoalSheet() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const addGoal = useGoalsStore((s) => s.addGoal);
  const visible = nav.sheet?.id === 'createGoal';

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [pick, setPick] = useState(0);
  const [notify, setNotify] = useState(true);

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setName('');
      setDesc('');
      setTargetStr('');
      setPick(0);
      setNotify(true);
    }
  }, [visible]);

  const target = Number.parseFloat(targetStr) || 0;
  const valid = name.trim().length > 0 && target >= MIN_TARGET;
  const tryVal = Math.round(target * FX_TRY_PER_USDC).toLocaleString(
    locale === 'tr' ? 'tr-TR' : 'en-US',
  );

  const create = () => {
    if (!valid) {
      return;
    }
    const chosen: { icon: GoalIcon; color: GoalColor } = ICONS[pick] ?? {
      icon: 'plane',
      color: 'purple',
    };
    const d = desc.trim();
    const id = addGoal({
      name: name.trim(),
      icon: chosen.icon,
      color: chosen.color,
      target,
      notify,
      ...(d ? { desc: d } : {}),
    });
    nav.closeSheet();
    nav.toast(t('goals.created'));
    nav.push('goalDetail', { id });
  };

  return (
    <Sheet
      visible={visible}
      onClose={nav.closeSheet}
      title={t('goals.createTitle')}
      dock={<Button label={t('goals.create')} onPress={create} disabled={!valid} iconName="flag" />}
    >
      <View style={styles.field}>
        <Text style={styles.label}>{t('goals.nameLabel')}</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('goals.namePh')}
            placeholderTextColor={color.inkFaint}
            maxLength={40}
            returnKeyType="next"
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('goals.descLabel')}</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={desc}
            onChangeText={setDesc}
            placeholder={t('goals.descPh')}
            placeholderTextColor={color.inkFaint}
            maxLength={60}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('goals.targetLabel')}</Text>
        <View style={styles.amountWrap}>
          <Text style={styles.amountSym}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={targetStr}
            onChangeText={(v) => setTargetStr(v.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            placeholderTextColor={color.inkFaint}
            keyboardType="decimal-pad"
          />
          <Text style={styles.amountSuf}>USDC</Text>
        </View>
        <Text style={styles.tryHint}>≈ ₺{tryVal}</Text>
        <View style={styles.chips}>
          {TARGET_CHIPS.map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, target === c && styles.chipOn]}
              onPress={() => setTargetStr(String(c))}
            >
              <Text style={[styles.chipTx, target === c && styles.chipTxOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('goals.iconLabel')}</Text>
        <View style={styles.iconGrid}>
          {ICONS.map((o, i) => {
            const tint = GOAL_TINT[o.color];
            const on = pick === i;
            return (
              <Pressable
                key={o.icon}
                style={[
                  styles.iconBtn,
                  { backgroundColor: tint.soft },
                  on && { borderColor: tint.fg },
                ]}
                onPress={() => setPick(i)}
              >
                <Icon name={o.icon} size={22} stroke={tint.fg} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.notifyRow}>
        <View style={styles.notifyMid}>
          <Text style={styles.label}>{t('goals.notifyLabel')}</Text>
          <Text style={styles.notifySub}>{t('goals.notifySub')}</Text>
        </View>
        <Switch
          value={notify}
          onValueChange={setNotify}
          trackColor={{ false: color.surface2, true: color.purple }}
          thumbColor={color.ink}
          ios_backgroundColor={color.surface2}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: space.s5 },
  label: { ...type.label, fontSize: 12.5, color: color.inkDim, marginBottom: space.s2 },
  inputWrap: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
    height: 52,
    justifyContent: 'center',
  },
  input: { fontFamily: font.semiBold, fontSize: 16, color: color.ink, padding: 0 },

  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
    height: 56,
  },
  amountSym: { fontFamily: font.bold, fontSize: 20, color: color.inkFaint, marginRight: 8 },
  amountInput: { flex: 1, fontFamily: font.extraBold, fontSize: 22, color: color.ink, padding: 0 },
  amountSuf: { fontFamily: font.semiBold, fontSize: 14, color: color.inkFaint },
  tryHint: { fontFamily: font.mono, fontSize: 12.5, color: color.inkFaint, marginTop: 8 },

  chips: { flexDirection: 'row', gap: 8, marginTop: space.s3 },
  chip: {
    flex: 1,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: color.purpleSoft, borderColor: color.purpleBd },
  chipTx: { fontFamily: font.semiBold, fontSize: 13.5, color: color.inkDim },
  chipTxOn: { color: color.purple },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },

  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: space.s2,
  },
  notifyMid: { flex: 1 },
  notifySub: { ...type.caption, color: color.inkFaint, marginTop: 2 },
});
