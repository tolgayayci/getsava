import { color, font, radius, space, type } from '@getsava/ui';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLira, formatUsdc, useTranslation } from '../../i18n';
import { usdcToTry } from '../../lib/fx';
import { goalProgress, goalValue, useGoalsStore } from '../../lib/goals-store';
import { useVault } from '../../lib/useVault';
import { useNav } from '../../nav';
import { Button, Icon, NavHeader } from '../../ui';
import { GoalRow } from '../../ui/goal-bits';

/** Full goals list (YK savings goals). Empty → centered prompt; populated →
 * "Total saved" summary + goal cards, with a sticky "New goal" dock. */
export function GoalsScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const goals = useGoalsStore((s) => s.goals);
  const { vault } = useVault();
  const vy = vault?.yieldUsdc ?? 0;

  const totalValue = goals.reduce((sum, g) => sum + goalValue(g, goals, vy), 0);

  return (
    <>
      <NavHeader title={t('goals.title')} onBack={nav.back} />

      {goals.length === 0 ? (
        <View style={[styles.empty, { paddingBottom: insets.bottom + space.s8 }]}>
          <View style={styles.emptyIc}>
            <Icon name="target" size={30} stroke={color.purple} />
          </View>
          <Text style={styles.emptyTitle}>{t('goals.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('goals.emptyBody')}</Text>
          <View style={styles.emptyCta}>
            <Button
              label={t('goals.new')}
              iconName="plus"
              onPress={() => nav.openSheet('createGoal')}
            />
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 96 }]}
          >
            <View style={styles.summary}>
              <Text style={styles.sumLabel}>{t('goals.totalSaved')}</Text>
              <Text style={styles.sumValue}>{formatUsdc(totalValue, locale)}</Text>
              <Text style={styles.sumSub}>{formatLira(usdcToTry(totalValue), locale)}</Text>
            </View>

            <View style={styles.list}>
              {goals.map((g) => {
                const value = goalValue(g, goals, vy);
                return (
                  <GoalRow
                    key={g.id}
                    goal={g}
                    valueUsdc={value}
                    pct={goalProgress(value, g.target)}
                    locale={locale}
                    onPress={() => nav.push('goalDetail', { id: g.id })}
                  />
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.dock, { paddingBottom: insets.bottom + space.s3 }]}>
            <Pressable style={styles.newBtn} onPress={() => nav.openSheet('createGoal')}>
              <Icon name="plus" size={18} stroke={color.purpleInk} />
              <Text style={styles.newBtnText}>{t('goals.new')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter, paddingTop: space.s2 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.s8,
  },
  emptyIc: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: color.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s5,
  },
  emptyTitle: { ...type.h2, fontSize: 20, color: color.ink, textAlign: 'center' },
  emptyBody: {
    ...type.body,
    color: color.inkDim,
    textAlign: 'center',
    marginTop: space.s2,
    lineHeight: 21,
  },
  emptyCta: { alignSelf: 'stretch', marginTop: space.s6 },

  summary: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.lg,
    padding: space.s5,
    marginBottom: space.s5,
  },
  sumLabel: {
    ...type.label,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  sumValue: {
    fontFamily: font.extraBold,
    fontSize: 30,
    color: color.ink,
    letterSpacing: -0.5,
    marginTop: 6,
  },
  sumSub: { fontFamily: font.mono, fontSize: 13, color: color.inkFaint, marginTop: 4 },

  list: { gap: space.s3 },

  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    backgroundColor: color.bg,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
  },
  newBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: color.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  newBtnText: { fontFamily: font.bold, fontSize: 15.5, color: color.purpleInk },
});
