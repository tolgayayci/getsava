import { color, space, type } from '@getsava/ui';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** How far the sheet bleeds below the screen edge (fills the device corners). */
const BLEED = 48;

interface SheetProps {
  visible: boolean;
  onClose?: (() => void) | undefined;
  title?: string;
  children?: ReactNode;
  /** Sticky bottom action area (buttons). */
  dock?: ReactNode;
}

/**
 * Bottom sheet. A full-screen scrim sits BEHIND the panel (so the panel's
 * rounded top corners render over a uniform dim, not the un-dimmed screen), and
 * the panel bleeds below the screen edge so the device's rounded bottom corners
 * fill with the sheet color. Tapping the scrim closes it (unless `onClose` is
 * omitted — e.g. during an in-flight submit).
 */
export function Sheet({ visible, onClose, title, children, dock }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={styles.fill} pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            { paddingBottom: space.s4 + insets.bottom + BLEED, marginBottom: -BLEED },
          ]}
        >
          <View style={styles.grab} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : null}
          {dock ? <View style={styles.dock}>{dock}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.bg2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.gutter,
    paddingTop: space.s3,
    maxHeight: '88%',
  },
  grab: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: space.s4,
  },
  title: { ...type.h2, fontSize: 19, color: color.ink, marginBottom: space.s2 },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: space.s3 },
  dock: { paddingTop: space.s3, borderTopWidth: 1, borderColor: color.hairSoft, gap: space.s3 },
});
