import { stellarExpertTxUrl } from '@getsava/sdk-stellar';
import { color, font, space, type } from '@getsava/ui';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../i18n';
import { formatLira, formatUsdc, useTranslation } from '../i18n';
import { NETWORK } from '../lib/network';
import type { ActivityRecord, ActivityType } from '../lib/vault-store';
import { Icon, type IconName } from './Icon';

/** Incoming events render +/green; the rest are outgoing (−, neutral). */
const INCOMING = new Set<ActivityType>(['added', 'withdrew', 'yield']);

/** Base icon per event kind (Mercuryo deposits override to the card icon). */
const ICON: Record<ActivityType, IconName> = {
  supplied: 'arrowUp',
  withdrew: 'arrowDown',
  added: 'arrowDown',
  sent: 'arrowUp',
  yield: 'spark',
};

interface DayGroup {
  readonly key: string;
  readonly label: string;
  readonly items: ActivityRecord[];
}

/** Local midnight (epoch ms) for the day containing `ts`. */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(
  ts: number,
  todayStart: number,
  locale: Locale,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const dayStart = startOfDay(ts);
  const oneDay = 86_400_000;
  if (dayStart === todayStart) return t('activity.today');
  if (dayStart === todayStart - oneDay) return t('activity.yesterday');
  return new Date(ts).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'long',
  });
}

function groupByDay(
  records: ActivityRecord[],
  locale: Locale,
  t: ReturnType<typeof useTranslation>['t'],
): DayGroup[] {
  const todayStart = startOfDay(Date.now());
  const groups: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const rec of records) {
    const key = String(startOfDay(rec.ts));
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(rec.ts, todayStart, locale, t), items: [] };
      groups.push(current);
    }
    current.items.push(rec);
  }
  return groups;
}

function clockTime(ts: number, locale: Locale): string {
  return new Date(ts).toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Day-grouped money timeline. Used full on the Activity screen and filtered to a
 * single vault's supply/withdraw/yield on the vault-detail screen. Each row taps
 * out to Stellar Expert when it carries a tx hash.
 */
export function ActivityList({ records, max }: { records: ActivityRecord[]; max?: number }) {
  const { t, locale } = useTranslation();
  const shown = typeof max === 'number' ? records.slice(0, max) : records;
  const groups = groupByDay(shown, locale, t);

  return (
    <>
      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={styles.dayLabel}>{group.label}</Text>
          <View>
            {group.items.map((rec, i) => {
              const hash = rec.hash;
              return (
                <ActivityRow
                  key={rec.id}
                  record={rec}
                  locale={locale}
                  label={t(`activity.${rec.type}`)}
                  variableNote={t('activity.variableNote')}
                  last={i === group.items.length - 1}
                  {...(hash
                    ? {
                        onPress: () =>
                          void WebBrowser.openBrowserAsync(stellarExpertTxUrl(NETWORK, hash)),
                      }
                    : {})}
                />
              );
            })}
          </View>
        </View>
      ))}
    </>
  );
}

function ActivityRow({
  record,
  locale,
  label,
  variableNote,
  last,
  onPress,
}: {
  record: ActivityRecord;
  locale: Locale;
  label: string;
  variableNote: string;
  last: boolean;
  onPress?: () => void;
}) {
  const incoming = INCOMING.has(record.type);
  const mercuryo = record.source === 'mercuryo';
  const vaultAction = record.type === 'supplied' || record.type === 'withdrew';
  const badge: 'brand' | 'green' | 'neutral' =
    mercuryo || vaultAction ? 'brand' : incoming ? 'green' : 'neutral';
  const iconName: IconName = mercuryo ? 'card' : ICON[record.type];
  const iconStroke =
    badge === 'brand' ? color.purple : badge === 'green' ? color.green : color.inkDim;
  const sub =
    record.type === 'yield'
      ? variableNote
      : mercuryo
        ? `${clockTime(record.ts, locale)} · Mercuryo`
        : clockTime(record.ts, locale);

  const content = (
    <>
      <View
        style={[
          styles.rowIc,
          badge === 'brand' && styles.rowIcBrand,
          badge === 'green' && styles.rowIcG,
        ]}
      >
        <Icon name={iconName} size={17} stroke={iconStroke} />
      </View>
      <View style={styles.rowMid}>
        <Text style={styles.rowName}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.amount, incoming && styles.amountG]}>
          {incoming ? '+' : '−'}
          {formatUsdc(record.usdc, locale)}
        </Text>
        <Text style={styles.amountSub}>{formatLira(record.tryAtTx, locale)}</Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={[styles.row, !last && styles.rowBorder]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.row, !last && styles.rowBorder]}>{content}</View>;
}

const styles = StyleSheet.create({
  group: { marginTop: space.s4 },
  dayLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginBottom: space.s1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: color.hairSoft },
  rowIc: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface2,
  },
  rowIcBrand: { backgroundColor: color.purpleSoft },
  rowIcG: { backgroundColor: color.greenSoft },
  rowMid: { flex: 1 },
  rowName: { fontFamily: font.semiBold, fontSize: 15, color: color.ink },
  rowSub: { fontFamily: font.regular, fontSize: 12.5, color: color.inkFaint, marginTop: 3 },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  amount: { fontFamily: font.bold, fontSize: 15.5, color: color.ink },
  amountG: { color: color.green },
  amountSub: { fontFamily: font.mono, fontSize: 11.5, color: color.inkFaint },
});
