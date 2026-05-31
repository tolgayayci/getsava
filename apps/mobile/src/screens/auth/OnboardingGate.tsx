import { color, radius, space, type } from '@getsava/ui';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../i18n';
import { Button, Icon, type IconName, Notice } from '../../ui';

/**
 * Onboarding disclaimer gate (T1.D1 onboarding + YK-495). First-launch risk
 * gate: the user must tick BOTH acknowledgements before continuing. The legal
 * record of informed consent (server-recorded acceptance + version is YK-495).
 */
export function OnboardingGate({
  onAccept,
  reaccept = false,
}: {
  onAccept: () => void;
  reaccept?: boolean;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [a1, setA1] = useState(false);
  const [a2, setA2] = useState(false);
  const both = a1 && a2;

  const points: { icon: IconName; title: string; body: string }[] = [
    { icon: 'bank', title: t('onboarding.p1'), body: t('onboarding.p1d') },
    { icon: 'earn', title: t('onboarding.p2'), body: t('onboarding.p2d') },
    { icon: 'alert', title: t('onboarding.p3'), body: t('onboarding.p3d') },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.wordmark}>
          sa<Text style={styles.wordmarkV}>v</Text>a
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.eyebrow}>{t('onboarding.eyebrow')}</Text>
        <Text style={styles.title}>{t('onboarding.title')}</Text>

        {reaccept && (
          <View style={{ marginTop: space.s5 }}>
            <Notice
              tone="blue"
              icon="doc"
              title={t('onboarding.reacceptTitle')}
              body={t('onboarding.reacceptBody')}
            />
          </View>
        )}

        <View style={styles.points}>
          {points.map((p, i) => (
            <View key={p.icon} style={[styles.point, i < 2 && styles.pointDivider]}>
              <View style={styles.pointIcon}>
                <Icon name={p.icon} size={19} stroke={color.inkDim} />
              </View>
              <View style={styles.pointText}>
                <Text style={styles.pointTitle}>{p.title}</Text>
                <Text style={styles.pointBody}>{p.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.acks}>
          <AckRow checked={a1} label={t('onboarding.ack1')} onToggle={() => setA1((v) => !v)} />
          <AckRow checked={a2} label={t('onboarding.ack2')} onToggle={() => setA2((v) => !v)} />
        </View>

        <View style={styles.legalRow}>
          <Text style={styles.legalLink}>{t('onboarding.terms')}</Text>
          <Text style={styles.legalLink}>{t('onboarding.privacy')}</Text>
        </View>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + 8 }]}>
        <Button
          label={
            reaccept
              ? t('onboarding.reacceptCta')
              : both
                ? t('onboarding.cta')
                : t('onboarding.ctaWait')
          }
          onPress={onAccept}
          disabled={!reaccept && !both}
        />
      </View>
    </View>
  );
}

function AckRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.ack}
    >
      <View style={[styles.ackBox, checked && styles.ackBoxOn]}>
        {checked && <Icon name="check" size={14} stroke={color.greenInk} />}
      </View>
      <Text style={styles.ackText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: { paddingHorizontal: space.gutter, paddingBottom: space.s2 },
  wordmark: { ...type.title, fontSize: 19, color: color.ink },
  wordmarkV: { color: color.purple },
  body: { paddingHorizontal: space.gutter, paddingBottom: space.s6 },
  eyebrow: {
    ...type.label,
    color: color.inkFaint,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: space.s2,
  },
  title: { ...type.h1, color: color.ink, marginTop: space.s3 },
  points: { marginTop: space.s5 },
  point: { flexDirection: 'row', gap: 14, paddingVertical: 14 },
  pointDivider: { borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  pointIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { flex: 1 },
  pointTitle: { ...type.bodyStrong, color: color.ink, marginBottom: 3 },
  pointBody: { ...type.caption, color: color.inkDim, lineHeight: 20 },
  acks: {
    marginTop: space.s4,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    borderRadius: radius.md,
    paddingHorizontal: space.s4,
  },
  ack: { flexDirection: 'row', gap: space.s3, paddingVertical: space.s4, alignItems: 'flex-start' },
  ackBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  ackBoxOn: { backgroundColor: color.green, borderColor: color.green },
  ackText: { ...type.caption, flex: 1, color: color.ink, lineHeight: 20 },
  legalRow: { flexDirection: 'row', gap: space.s5, justifyContent: 'center', marginTop: space.s4 },
  legalLink: { ...type.caption, color: color.inkDim },
  dock: {
    paddingHorizontal: space.gutter,
    paddingTop: 14,
    backgroundColor: color.bg,
    borderTopWidth: 1,
    borderTopColor: color.hairSoft,
  },
});
