import { color, font, radius, space, type } from '@getsava/ui';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from '../../i18n';
import { CircuitTrippedError } from '../../lib/circuit';
import { useGoalsStore } from '../../lib/goals-store';
import { useVault } from '../../lib/useVault';
import { useNav } from '../../nav';
import { Button, Icon, Sheet } from '../../ui';

const CHIPS = [25, 50, 100, 250];

/** Bottom sheet to add USDC toward a goal. Performs a REAL on-chain supply
 * (circuit-guarded) and attributes the confirmed principal to the goal, so the
 * progress bar moves only after the deposit confirms. Shows when the nav sheet
 * id is "addToGoal" (params.id selects the goal). */
export function AddToGoalSheet() {
  const { t } = useTranslation();
  const nav = useNav();
  const goals = useGoalsStore((s) => s.goals);
  const addToGoal = useGoalsStore((s) => s.addToGoal);
  const { supply } = useVault();

  const visible = nav.sheet?.id === 'addToGoal';
  const id = nav.sheet?.params?.id as string | undefined;
  const goal = goals.find((g) => g.id === id);
  const name = goal?.name ?? '';

  const [amountStr, setAmountStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmountStr('');
      setSubmitting(false);
    }
  }, [visible]);

  const amount = Number.parseFloat(amountStr) || 0;
  const valid = amount > 0 && goal !== undefined && !submitting;

  const submit = async () => {
    if (!valid || !goal) {
      return;
    }
    setSubmitting(true);
    try {
      const hash = await supply(amount); // real on-chain supply; throws if halted
      addToGoal(goal.id, amount, hash);
      nav.closeSheet();
      nav.toast(t('goals.added', { name }));
    } catch (e) {
      nav.toast(
        e instanceof CircuitTrippedError ? t('circuit.haltedTitle') : t('goals.fundFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={nav.closeSheet}
      title={t('goals.addTitle')}
      dock={
        <Button
          label={submitting ? t('goals.funding') : t('goals.addCta')}
          onPress={submit}
          disabled={!valid}
          iconName="plus"
        />
      }
    >
      <Text style={styles.sub}>{t('goals.addSub', { name })}</Text>

      <Text style={styles.label}>{t('goals.addAmount')}</Text>
      <View style={styles.amountWrap}>
        <Text style={styles.amountSym}>$</Text>
        <TextInput
          style={styles.amountInput}
          value={amountStr}
          onChangeText={(v) => setAmountStr(v.replace(/[^0-9.]/g, ''))}
          placeholder="0"
          placeholderTextColor={color.inkFaint}
          keyboardType="decimal-pad"
          autoFocus
        />
        <Text style={styles.amountSuf}>USDC</Text>
      </View>

      <View style={styles.chips}>
        {CHIPS.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, amount === c && styles.chipOn]}
            onPress={() => setAmountStr(String(c))}
          >
            <Text style={[styles.chipTx, amount === c && styles.chipTxOn]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.fundNote}>
        <Icon name="shield" size={13} stroke={color.inkFaint} />
        <Text style={styles.fundNoteTx}>{t('goals.fundNote')}</Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sub: { ...type.body, color: color.inkDim, marginBottom: space.s5, lineHeight: 20 },
  label: { ...type.label, fontSize: 12.5, color: color.inkDim, marginBottom: space.s2 },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
    height: 60,
  },
  amountSym: { fontFamily: font.bold, fontSize: 22, color: color.inkFaint, marginRight: 8 },
  amountInput: { flex: 1, fontFamily: font.extraBold, fontSize: 26, color: color.ink, padding: 0 },
  amountSuf: { fontFamily: font.semiBold, fontSize: 15, color: color.inkFaint },
  chips: { flexDirection: 'row', gap: 8, marginTop: space.s4, marginBottom: space.s2 },
  fundNote: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: space.s3 },
  fundNoteTx: { ...type.micro, color: color.inkFaint, flex: 1, lineHeight: 15 },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: color.purpleSoft, borderColor: color.purpleBd },
  chipTx: { fontFamily: font.semiBold, fontSize: 14, color: color.inkDim },
  chipTxOn: { color: color.purple },
});
