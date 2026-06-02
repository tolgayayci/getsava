import { color, space } from '@getsava/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from './Icon';

export type TabId = 'home' | 'earn' | 'settings';

const TABS: ReadonlyArray<{ id: TabId; icon: IconName }> = [
  { id: 'home', icon: 'home' },
  { id: 'earn', icon: 'earn' },
  { id: 'settings', icon: 'gear' },
];

interface TabBarProps {
  active: TabId;
  onChange: (id: TabId) => void;
  /** Extra bottom padding for the home-indicator safe area. */
  bottomInset?: number;
}

/** Minimal, borderless icons-only tab bar (Midas-style). */
export function TabBar({ active, onChange, bottomInset = 0 }: TabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: 16 + bottomInset }]}>
      {TABS.map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="button"
          accessibilityLabel={tab.id}
          accessibilityState={{ selected: active === tab.id }}
          style={styles.tab}
          onPress={() => onChange(tab.id)}
        >
          <Icon name={tab.icon} size={26} stroke={active === tab.id ? color.ink : color.inkFaint} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 12, paddingHorizontal: space.s7 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
