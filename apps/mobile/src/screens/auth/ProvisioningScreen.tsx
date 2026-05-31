import type { ProvisioningState } from '@getsava/sdk-stellar';
import { color, radius, space, type } from '@getsava/ui';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from '../../i18n';
import { Button, Icon } from '../../ui';

const RING_R = 47;
const RING_C = 2 * Math.PI * RING_R;

/** Maps the provisioning state machine to a 0..3 step index for the checklist. */
function stepIndex(state: ProvisioningState): number {
  switch (state) {
    case 'pending':
      return 0;
    case 'funding':
    case 'funded':
      return 1;
    case 'trustline_pending':
      return 2;
    case 'ready':
      return 3;
    default:
      return 0;
  }
}

/**
 * Provisioning screen (T1.D1.S4 / YK-458). Shows the funded-account + USDC
 * trustline setup driven by the provisioning state machine, then routes Home.
 * The failure path never silently advances — it offers an explicit retry.
 */
export function ProvisioningScreen({
  state,
  onRetry,
}: {
  state: ProvisioningState;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const failed = state === 'failed';
  const ix = stepIndex(state);
  const done = ix >= 3;
  const progress = Math.min(ix, 3) / 3;

  const steps = [t('provisioning.s1'), t('provisioning.s2'), t('provisioning.s3')];

  if (failed) {
    return (
      <View
        style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.s5 }]}
      >
        <View style={styles.center}>
          <View style={[styles.iconBubble, styles.iconBubbleError]}>
            <Icon name="alert" size={32} stroke={color.red} />
          </View>
          <Text style={styles.title}>{t('provisioning.failedTitle')}</Text>
          <Text style={styles.note}>{t('provisioning.failedNote')}</Text>
        </View>
        <View style={styles.dock}>
          <Button label={t('provisioning.retry')} onPress={onRetry} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>
          sa<Text style={styles.wordmarkV}>v</Text>a
        </Text>
      </View>
      <View style={styles.center}>
        <View style={styles.ring}>
          <Svg width={104} height={104} viewBox="0 0 104 104" style={styles.ringSvg}>
            <Circle
              cx={52}
              cy={52}
              r={RING_R}
              stroke={color.surface2}
              strokeWidth={6}
              fill="none"
            />
            <Circle
              cx={52}
              cy={52}
              r={RING_R}
              stroke={done ? color.green : color.purple}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - progress)}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Icon
              name={done ? 'check' : 'key'}
              size={done ? 34 : 32}
              stroke={done ? color.green : color.purple}
            />
          </View>
        </View>

        <Text style={styles.title}>{done ? t('provisioning.done') : t('provisioning.title')}</Text>
        <Text style={styles.note}>{t('provisioning.note')}</Text>

        <View style={styles.list}>
          {steps.map((label, i) => {
            const sDone = ix > i;
            const sActive = ix === i && !done;
            return (
              <View key={label} style={[styles.step, !sDone && !sActive && styles.stepPending]}>
                <View
                  style={[
                    styles.stepDot,
                    sDone && styles.stepDotDone,
                    sActive && styles.stepDotActive,
                  ]}
                >
                  {sDone ? (
                    <Icon name="check" size={14} stroke={color.greenInk} />
                  ) : sActive ? (
                    <ActivityIndicator size="small" color={color.purple} />
                  ) : null}
                </View>
                <Text style={styles.stepLabel}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: { height: 50, alignItems: 'center', justifyContent: 'center' },
  wordmark: { ...type.title, fontSize: 19, color: color.ink },
  wordmarkV: { color: color.purple },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.gutter,
    paddingBottom: 48,
  },
  ring: { width: 104, height: 104, marginBottom: 30 },
  ringSvg: { transform: [{ rotate: '-90deg' }] },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubble: {
    width: 66,
    height: 66,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s6,
  },
  iconBubbleError: { backgroundColor: color.redSoft },
  title: { ...type.h2, color: color.ink, textAlign: 'center' },
  note: {
    ...type.body,
    color: color.inkDim,
    textAlign: 'center',
    marginTop: space.s3,
    marginBottom: space.s6,
    maxWidth: 300,
  },
  list: { width: '100%', maxWidth: 300, gap: space.s1 },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: space.s3 },
  stepPending: { opacity: 0.4 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: color.green, borderColor: color.green },
  stepDotActive: { borderColor: color.purple },
  stepLabel: { ...type.bodyStrong, color: color.ink },
  dock: { paddingHorizontal: space.gutter },
});
