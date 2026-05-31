import { color, radius, type } from '@getsava/ui';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';

type Tone = 'amber' | 'blue' | 'red';

const TONE: Record<Tone, { bg: string; border: string; fg: string }> = {
  amber: { bg: color.amberSoft, border: color.amberBd, fg: color.amber },
  blue: { bg: color.blueSoft, border: color.blueBd, fg: color.blue },
  red: { bg: color.redSoft, border: color.redBd, fg: color.red },
};

interface NoticeProps {
  tone?: Tone;
  icon?: IconName;
  title: string;
  body: string;
}

export function Notice({ tone = 'amber', icon = 'locksmall', title, body }: NoticeProps) {
  const t = TONE[tone];
  return (
    <View style={[styles.wrap, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={[styles.icon, { backgroundColor: t.bg }]}>
        <Icon name={icon} size={18} stroke={t.fg} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: t.fg }]}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.md, borderWidth: 1 },
  icon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  title: { ...type.bodyStrong, marginBottom: 3 },
  body: { ...type.caption, color: color.inkDim },
});
