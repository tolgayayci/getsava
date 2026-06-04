import { color, font, radius, space } from '@getsava/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatLira, formatUsdc, type Locale } from '../i18n';
import { usdcToTry } from '../lib/fx';
import type { Goal, GoalColor } from '../lib/goals-store';
import { Icon } from './Icon';

/** Goal accent → (foreground, soft background) token pair. */
export const GOAL_TINT: Record<GoalColor, { fg: string; soft: string }> = {
  purple: { fg: color.purple, soft: color.purpleSoft },
  green: { fg: color.green, soft: color.greenSoft },
  blue: { fg: color.blue, soft: color.blueSoft },
  amber: { fg: color.amber, soft: color.amberSoft },
};

/** Progress bar; turns green at 100% and marks the 25/50/75 milestones. */
export function GoalBar({
  pct,
  height = 8,
  ticks = true,
}: {
  pct: number;
  height?: number;
  ticks?: boolean;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  const fill = clamped >= 1 ? color.green : color.purple;
  return (
    <View style={[barStyles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          barStyles.fill,
          { width: `${clamped * 100}%`, backgroundColor: fill, borderRadius: height / 2 },
        ]}
      />
      {ticks
        ? [0.25, 0.5, 0.75].map((m) => (
            <View
              key={m}
              style={[
                barStyles.tick,
                {
                  left: `${m * 100}%`,
                  backgroundColor: clamped >= m ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.16)',
                },
              ]}
            />
          ))
        : null}
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: color.surface2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { height: '100%' },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 1.5, marginLeft: -0.75 },
});

/** Compact goal card for the list / Home preview. */
export function GoalRow({
  goal,
  valueUsdc,
  pct,
  locale,
  onPress,
}: {
  goal: Goal;
  valueUsdc: number;
  pct: number;
  locale: Locale;
  onPress: () => void;
}) {
  const tint = GOAL_TINT[goal.color];
  const reached = pct >= 1;
  return (
    <Pressable
      style={({ pressed }) => [rowStyles.row, pressed && rowStyles.pressed]}
      onPress={onPress}
    >
      <View style={[rowStyles.ic, { backgroundColor: tint.soft }]}>
        <Icon name={goal.icon} size={20} stroke={tint.fg} />
      </View>
      <View style={rowStyles.mid}>
        <View style={rowStyles.topline}>
          <Text style={rowStyles.name} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={[rowStyles.pct, reached && rowStyles.pctReached]}>
            {Math.round(pct * 100)}%
          </Text>
        </View>
        <GoalBar pct={pct} height={6} ticks={false} />
        <View style={rowStyles.botline}>
          <Text style={rowStyles.amt}>{formatUsdc(valueUsdc, locale)}</Text>
          <Text style={rowStyles.tgt}>{formatLira(usdcToTry(valueUsdc), locale)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    padding: space.s4,
  },
  pressed: { backgroundColor: color.surface2 },
  ic: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, gap: 7 },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontFamily: font.semiBold, fontSize: 15, color: color.ink, flex: 1, marginRight: 10 },
  pct: { fontFamily: font.bold, fontSize: 13, color: color.inkDim },
  pctReached: { color: color.green },
  botline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amt: { fontFamily: font.mono, fontSize: 12.5, color: color.inkDim },
  tgt: { fontFamily: font.mono, fontSize: 12, color: color.inkFaint },
});
