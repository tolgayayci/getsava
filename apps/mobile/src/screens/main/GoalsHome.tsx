import { color, font, radius, space, type } from '@getsava/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTranslation } from '../../i18n';
import { goalProgress, goalValue, useGoalsStore } from '../../lib/goals-store';
import { useVault } from '../../lib/useVault';
import { useNav } from '../../nav';
import { Icon } from '../../ui';
import { GoalRow } from '../../ui/goal-bits';

/** Goals entry on Home: a dashed "set your first goal" placeholder when empty,
 * else "Your goals" + the two nearest goals with a "See all" link. */
export function GoalsHome() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const goals = useGoalsStore((s) => s.goals);
  const { vault } = useVault();
  const vy = vault?.yieldUsdc ?? 0;
  const [box, setBox] = useState({ w: 0, h: 0 });

  const empty = goals.length === 0;
  const top = goals.slice(0, 2);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.secLabel}>{t('goals.homeTitle')}</Text>
        {empty ? null : (
          <Pressable onPress={() => nav.push('goals')} hitSlop={8}>
            <Text style={styles.seeAll}>{t('goals.seeAll')}</Text>
          </Pressable>
        )}
      </View>

      {empty ? (
        <Pressable
          style={styles.prompt}
          onPress={() => nav.openSheet('createGoal')}
          onLayout={(e) =>
            setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
          }
        >
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {box.w > 0 ? (
              <Svg width={box.w} height={box.h}>
                <Rect
                  x={0.9}
                  y={0.9}
                  width={box.w - 1.8}
                  height={box.h - 1.8}
                  rx={radius.lg}
                  ry={radius.lg}
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={1.6}
                  strokeDasharray="6 5"
                />
              </Svg>
            ) : null}
          </View>
          <View style={styles.promptIc}>
            <Icon name="target" size={22} stroke={color.purple} />
          </View>
          <View style={styles.promptMid}>
            <Text style={styles.promptT}>{t('goals.emptyTitle')}</Text>
            <Text style={styles.promptD}>{t('goals.emptyBody')}</Text>
          </View>
          <Icon name="chevR" size={18} stroke={color.purple} />
        </Pressable>
      ) : (
        <View style={styles.list}>
          {top.map((g) => {
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.s7 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.s3,
  },
  secLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
  },
  seeAll: { fontFamily: font.semiBold, fontSize: 13, color: color.purple },
  list: { gap: space.s3 },

  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.lg,
    paddingVertical: space.s4,
    paddingHorizontal: space.s4,
  },
  promptIc: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: color.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptMid: { flex: 1, gap: 3 },
  promptT: { fontFamily: font.bold, fontSize: 15.5, color: color.ink },
  promptD: { fontFamily: font.regular, fontSize: 13, color: color.inkDim, lineHeight: 18 },
});
