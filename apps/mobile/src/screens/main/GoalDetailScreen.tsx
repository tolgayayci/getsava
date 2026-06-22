import { color, font, radius, space, type } from '@getsava/ui';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDate, formatLira, formatUsdc, useTranslation } from '../../i18n';
import { usdcToTry } from '../../lib/fx';
import { fireMilestoneNotification } from '../../lib/goal-notify';
import { goalProgress, goalValue, goalYield, useGoalsStore } from '../../lib/goals-store';
import { useVault } from '../../lib/useVault';
import { useNav } from '../../nav';
import { Icon, NavHeader } from '../../ui';
import { GOAL_TINT, GoalBar } from '../../ui/goal-bits';

export function GoalDetailScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const goals = useGoalsStore((s) => s.goals);
  const toggleNotify = useGoalsStore((s) => s.toggleNotify);
  const removeGoal = useGoalsStore((s) => s.removeGoal);
  const { vault } = useVault();

  const id = nav.stackTop?.params?.id as string | undefined;
  const goal = goals.find((g) => g.id === id);
  const [preview, setPreview] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (previewTimer.current) {
        clearTimeout(previewTimer.current);
      }
    },
    [],
  );

  if (!goal) {
    return <NavHeader title={t('goals.title')} onBack={nav.back} />;
  }

  // null → 0 for the bar (never inflate progress with unprovable yield); the
  // yield-boost callout shows "—" when yield is N/A.
  const yieldNA = vault?.yieldUsdc === null;
  const vy = vault?.yieldUsdc ?? 0;
  const yieldShare = goalYield(goal, goals, vy);
  const value = goalValue(goal, goals, vy);
  const pct = goalProgress(value, goal.target);
  const reached = pct >= 1;
  const remaining = Math.max(0, goal.target - value);
  const tint = GOAL_TINT[goal.color];

  const showPreview = () => {
    // Fire a REAL OS notification (the actual milestone alert) + the in-app card.
    const ms = reached ? 100 : ([75, 50, 25].find((m) => pct * 100 >= m) ?? 25);
    void fireMilestoneNotification(
      reached ? t('goals.pushReached') : t('goals.pushMilestone'),
      reached
        ? t('goals.pushReachedBody', { name: goal.name })
        : t('goals.pushMilestoneBody', { pct: String(ms), name: goal.name }),
    );
    setPreview(true);
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
    }
    previewTimer.current = setTimeout(() => setPreview(false), 3200);
  };

  const confirmRemove = () => {
    Alert.alert(t('goals.removeQ'), t('goals.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('goals.remove'),
        style: 'destructive',
        onPress: () => {
          nav.back();
          removeGoal(goal.id);
          nav.toast(t('goals.remove'));
        },
      },
    ]);
  };

  const previewMs = reached ? 100 : ([75, 50, 25].find((m) => pct * 100 >= m) ?? 25);
  const dateFmt = (ts: number) =>
    formatDate(new Date(ts), locale, { day: 'numeric', month: 'short' });

  return (
    <>
      <NavHeader title={goal.name} onBack={nav.back} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 96 }]}
      >
        {/* hero */}
        <View style={[styles.hero, { borderColor: reached ? color.greenSoft : color.purpleBd }]}>
          <View style={styles.heroTop}>
            <Text style={[styles.heroPct, reached && { color: color.green }]}>
              {Math.round(pct * 100)}%
            </Text>
            <View style={[styles.heroIc, { backgroundColor: tint.soft }]}>
              <Icon name={goal.icon} size={22} stroke={tint.fg} />
            </View>
          </View>
          <Text style={styles.heroState}>{reached ? t('goals.reached') : t('goals.complete')}</Text>
          <View style={styles.heroBar}>
            <GoalBar pct={pct} height={12} />
          </View>
          <View style={styles.heroAmts}>
            <Text style={styles.heroVal}>
              {formatUsdc(value, locale)}
              <Text style={styles.heroOf}>
                {'  '}
                {t('goals.of')} {formatUsdc(goal.target, locale)}
              </Text>
            </Text>
          </View>
          <View style={styles.heroFoot}>
            <Text style={styles.heroTry}>{formatLira(usdcToTry(value), locale)}</Text>
            {reached ? null : (
              <Text style={styles.heroLeft}>
                {t('goals.left', { amount: formatUsdc(remaining, locale) })}
              </Text>
            )}
          </View>
        </View>

        {/* yield-share callout */}
        <View style={styles.boost}>
          <View style={styles.boostHead}>
            <View style={styles.boostIc}>
              <Icon name="earn" size={17} stroke={color.green} />
            </View>
            <Text style={styles.boostT}>{t('goals.yieldBoost')}</Text>
            <Text style={styles.boostAmt}>
              {yieldNA ? '—' : `+${formatUsdc(yieldShare, locale)}`}
            </Text>
          </View>
          <Text style={styles.boostNote}>{t('goals.splitNote')}</Text>
        </View>

        {/* details */}
        <Text style={styles.secLabel}>{t('goals.details')}</Text>
        <View style={styles.card}>
          <View style={styles.dRow}>
            <View style={styles.dLeft}>
              <Text style={styles.dKey}>{t('goals.tracking')}</Text>
              <Text style={styles.dSub}>{t('goals.trackingSub')}</Text>
            </View>
            <Text style={styles.dVal}>{vault?.name ?? t('home.suppliedVaultName')}</Text>
          </View>
          {goal.desc ? (
            <View style={[styles.dRow, styles.dRowLast]}>
              <Text style={styles.dKey}>{t('goals.note')}</Text>
              <Text style={[styles.dVal, styles.dNote]} numberOfLines={3}>
                {goal.desc}
              </Text>
            </View>
          ) : null}
        </View>

        {/* milestone alerts */}
        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.dRow}>
            <View style={styles.dLeft}>
              <Text style={styles.dKey}>{t('goals.milestones')}</Text>
              <Text style={styles.dSub}>{t('goals.milestonesSub')}</Text>
            </View>
            <Switch
              value={goal.notify}
              onValueChange={() => toggleNotify(goal.id)}
              trackColor={{ false: color.surface2, true: color.purple }}
              thumbColor={color.ink}
              ios_backgroundColor={color.surface2}
            />
          </View>
          <Pressable style={styles.previewBtn} onPress={showPreview}>
            <Icon name="bank" size={15} stroke={color.purple} />
            <Text style={styles.previewTx}>{t('goals.preview')}</Text>
          </Pressable>
        </View>

        {/* contributions */}
        {(!yieldNA && yieldShare > 0.005) || goal.contribs.length > 0 ? (
          <>
            <Text style={styles.secLabel}>{t('goals.contributions')}</Text>
            <View style={styles.card}>
              {!yieldNA && yieldShare > 0.005 ? (
                <View style={styles.cRow}>
                  <View style={[styles.cIc, { backgroundColor: color.greenSoft }]}>
                    <Icon name="earn" size={15} stroke={color.green} />
                  </View>
                  <Text style={styles.cName}>{t('goals.ctYield')}</Text>
                  <Text style={styles.cAmtG}>+{formatUsdc(yieldShare, locale)}</Text>
                </View>
              ) : null}
              {goal.contribs.map((c, i) => (
                <View
                  key={c.ts}
                  style={[styles.cRow, i === goal.contribs.length - 1 && styles.cRowLast]}
                >
                  <View style={[styles.cIc, { backgroundColor: color.purpleSoft }]}>
                    <Icon name="plus" size={15} stroke={color.purple} />
                  </View>
                  <View style={styles.cMid}>
                    <Text style={styles.cName}>{t('goals.ctAdded')}</Text>
                    <Text style={styles.cDate}>{dateFmt(c.ts)}</Text>
                  </View>
                  <Text style={styles.cAmt}>+{formatUsdc(c.usdc, locale)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Pressable style={styles.remove} onPress={confirmRemove}>
          <Text style={styles.removeTx}>{t('goals.remove')}</Text>
        </Pressable>
      </ScrollView>

      {/* push preview overlay */}
      {preview ? (
        <View style={[styles.pushWrap, { top: insets.top + space.s2 }]} pointerEvents="none">
          <View style={styles.push}>
            <View style={styles.pushHead}>
              <View style={styles.pushBadge}>
                <Text style={styles.pushBadgeTx}>S</Text>
              </View>
              <Text style={styles.pushApp}>{t('goals.pushApp')}</Text>
              <Text style={styles.pushNow}>{t('goals.pushNow')}</Text>
            </View>
            <Text style={styles.pushTitle}>
              {reached ? t('goals.pushReached') : t('goals.pushMilestone')}
            </Text>
            <Text style={styles.pushBody}>
              {reached
                ? t('goals.pushReachedBody', { name: goal.name })
                : t('goals.pushMilestoneBody', { pct: String(previewMs), name: goal.name })}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.s3 }]}>
        <Pressable
          style={styles.addBtn}
          onPress={() => nav.openSheet('addToGoal', { id: goal.id })}
        >
          <Icon name="plus" size={18} stroke={color.purpleInk} />
          <Text style={styles.addBtnText}>{t('goals.addTo')}</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter, paddingTop: space.s2 },

  hero: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.s5,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroPct: { fontFamily: font.extraBold, fontSize: 44, color: color.ink, letterSpacing: -1.5 },
  heroIc: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroState: {
    ...type.label,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginTop: -2,
  },
  heroBar: { marginTop: space.s4 },
  heroAmts: { marginTop: space.s3 },
  heroVal: { fontFamily: font.bold, fontSize: 17, color: color.ink },
  heroOf: { fontFamily: font.mono, fontSize: 13, color: color.inkFaint },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.s1,
  },
  heroTry: { fontFamily: font.mono, fontSize: 12.5, color: color.inkFaint },
  heroLeft: { fontFamily: font.semiBold, fontSize: 12.5, color: color.purple },

  boost: {
    backgroundColor: color.greenSoft,
    borderRadius: radius.md,
    padding: space.s4,
    marginTop: space.s4,
  },
  boostHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boostIc: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(88, 218, 152, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostT: { flex: 1, fontFamily: font.semiBold, fontSize: 14, color: color.ink },
  boostAmt: { fontFamily: font.bold, fontSize: 14.5, color: color.green },
  boostNote: { ...type.caption, color: color.greenDim, marginTop: 8, lineHeight: 17 },

  secLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginTop: space.s6,
    marginBottom: space.s3,
  },
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
  },
  cardGap: { marginTop: space.s3 },
  dRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: space.s4,
    borderBottomWidth: 1,
    borderBottomColor: color.hairSoft,
  },
  dRowLast: { borderBottomWidth: 0 },
  dLeft: { flex: 1 },
  dKey: { fontFamily: font.semiBold, fontSize: 14.5, color: color.ink },
  dSub: { ...type.caption, color: color.inkFaint, marginTop: 2 },
  dVal: {
    fontFamily: font.semiBold,
    fontSize: 14,
    color: color.inkDim,
    flexShrink: 1,
    textAlign: 'right',
  },
  dNote: { fontFamily: font.regular, color: color.inkDim },

  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: space.s3,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
  },
  previewTx: { fontFamily: font.semiBold, fontSize: 13.5, color: color.purple },

  cRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: space.s3,
    borderBottomWidth: 1,
    borderBottomColor: color.hairSoft,
  },
  cRowLast: { borderBottomWidth: 0 },
  cIc: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cMid: { flex: 1 },
  cName: { flex: 1, fontFamily: font.semiBold, fontSize: 14, color: color.ink },
  cDate: { ...type.caption, color: color.inkFaint, marginTop: 1 },
  cAmt: { fontFamily: font.mono, fontSize: 13, color: color.inkDim },
  cAmtG: { fontFamily: font.mono, fontSize: 13, color: color.green },

  remove: { alignSelf: 'center', paddingVertical: space.s5, marginTop: space.s2 },
  removeTx: { fontFamily: font.semiBold, fontSize: 14, color: color.red },

  pushWrap: { position: 'absolute', left: space.gutter, right: space.gutter, zIndex: 80 },
  push: {
    backgroundColor: 'rgba(40,44,46,0.96)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  pushHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pushBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushBadgeTx: { fontFamily: font.extraBold, fontSize: 13, color: color.purpleInk },
  pushApp: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: color.ink,
  },
  pushNow: { ...type.caption, color: color.inkFaint },
  pushTitle: { fontFamily: font.bold, fontSize: 15, color: color.ink },
  pushBody: { ...type.body, fontSize: 13.5, color: color.inkDim, marginTop: 3, lineHeight: 19 },

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
  addBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: color.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: { fontFamily: font.bold, fontSize: 15.5, color: color.purpleInk },
});
