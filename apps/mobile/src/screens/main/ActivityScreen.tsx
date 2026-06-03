import { stellarExpertTxUrl } from '@getsava/sdk-stellar';
import { color, font, radius, space, type } from '@getsava/ui';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Locale } from '../../i18n';
import { formatLira, formatUsdc, useTranslation } from '../../i18n';
import { NETWORK } from '../../lib/network';
import type { ActivityRecord, ActivityType } from '../../lib/vault-store';
import { useVaultStore } from '../../lib/vault-store';
import { useNav } from '../../nav';
import { Icon, type IconName, NavHeader } from '../../ui';

/** Visual + sign treatment per money-event kind. */
const TYPE_META: Record<ActivityType, { icon: IconName; positive: boolean; brand: boolean }> = {
  supplied: { icon: 'arrowUp', positive: false, brand: true },
  added: { icon: 'plus', positive: false, brand: false },
  withdrew: { icon: 'arrowDown', positive: false, brand: false },
  yield: { icon: 'spark', positive: true, brand: false },
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

export function ActivityScreen() {
  const { t, locale } = useTranslation();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const activity = useVaultStore((s) => s.activity);

  const groups = groupByDay(activity, locale, t);

  return (
    <>
      <NavHeader title={t('activity.title')} onBack={() => nav.back()} />
      {activity.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="list" size={26} stroke={color.inkFaint} />
          </View>
          <Text style={styles.emptyTitle}>{t('activity.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('activity.emptyBody')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.s6 }]}
        >
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={styles.dayLabel}>{group.label}</Text>
              <View style={styles.list}>
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
        </ScrollView>
      )}
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
  const meta = TYPE_META[record.type];
  const sub = record.type === 'yield' ? variableNote : clockTime(record.ts, locale);
  const amountStyle = meta.positive ? [styles.amount, styles.amountG] : styles.amount;
  const sign = meta.positive ? '+' : '−';

  const content = (
    <>
      <View style={[styles.rowIc, meta.brand && styles.rowIcBrand, meta.positive && styles.rowIcG]}>
        <Icon
          name={meta.icon}
          size={17}
          stroke={meta.brand ? color.purple : meta.positive ? color.green : color.inkDim}
        />
      </View>
      <View style={styles.rowMid}>
        <Text style={styles.rowName}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={amountStyle}>
          {sign}
          {formatUsdc(record.usdc, locale, false)}
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
  scroll: { flex: 1 },
  body: { paddingHorizontal: space.gutter, paddingTop: space.s2 },
  group: { marginTop: space.s4 },
  dayLabel: {
    ...type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.inkFaint,
    marginBottom: space.s1,
  },
  list: {},
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.s6,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s4,
  },
  emptyTitle: { ...type.h2, fontSize: 17, color: color.ink, textAlign: 'center' },
  emptyBody: {
    ...type.body,
    color: color.inkDim,
    textAlign: 'center',
    marginTop: space.s2,
    maxWidth: 260,
  },
});
