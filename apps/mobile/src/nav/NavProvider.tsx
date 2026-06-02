import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabId } from '../ui';
import { Toast } from '../ui';

/** Full-screen routes pushed above the tab shell. */
export type StackRoute = 'addLira' | 'mercuryo' | 'order' | 'receive' | 'send' | 'activity';
/** Bottom-sheet overlays. */
export type SheetId = 'addFunds';
/** Home balance display currency. */
export type DisplayCurrency = 'try' | 'usd';

export type NavParams = Record<string, unknown>;

interface StackEntry {
  route: StackRoute;
  params?: NavParams | undefined;
}

export interface Nav {
  tab: TabId;
  stackTop: StackEntry | null;
  sheet: { id: SheetId; params?: NavParams | undefined } | null;
  cur: DisplayCurrency;
  /** Switch tab and clear the pushed stack. */
  go: (tab: TabId) => void;
  push: (route: StackRoute, params?: NavParams) => void;
  /** Replace the top of the stack (used for widget → order detail). */
  replace: (route: StackRoute, params?: NavParams) => void;
  back: () => void;
  /** Pop the whole pushed stack back to the tab shell. */
  popToRoot: () => void;
  openSheet: (id: SheetId, params?: NavParams) => void;
  closeSheet: () => void;
  toast: (message: string) => void;
  setCur: (cur: DisplayCurrency) => void;
}

const NavContext = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabId>('home');
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [sheet, setSheet] = useState<{ id: SheetId; params?: NavParams | undefined } | null>(null);
  const [cur, setCur] = useState<DisplayCurrency>('try');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback((next: TabId) => {
    setStack([]);
    setSheet(null);
    setTab(next);
  }, []);
  const push = useCallback((route: StackRoute, params?: NavParams) => {
    setSheet(null);
    setStack((s) => [...s, { route, params }]);
  }, []);
  const replace = useCallback((route: StackRoute, params?: NavParams) => {
    setStack((s) => [...s.slice(0, -1), { route, params }]);
  }, []);
  const back = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const popToRoot = useCallback(() => setStack([]), []);
  const openSheet = useCallback((id: SheetId, params?: NavParams) => setSheet({ id, params }), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const setCurCb = useCallback((next: DisplayCurrency) => setCur(next), []);

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToastMsg(null), 1700);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    [],
  );

  // Android hardware back: close sheet → pop stack → let the OS handle it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) {
        setSheet(null);
        return true;
      }
      if (stack.length > 0) {
        setStack((s) => s.slice(0, -1));
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [sheet, stack.length]);

  const value = useMemo<Nav>(
    () => ({
      tab,
      stackTop: stack.length > 0 ? (stack[stack.length - 1] ?? null) : null,
      sheet,
      cur,
      go,
      push,
      replace,
      back,
      popToRoot,
      openSheet,
      closeSheet,
      toast,
      setCur: setCurCb,
    }),
    [
      tab,
      stack,
      sheet,
      cur,
      go,
      push,
      replace,
      back,
      popToRoot,
      openSheet,
      closeSheet,
      toast,
      setCurCb,
    ],
  );

  return (
    <NavContext.Provider value={value}>
      {children}
      {toastMsg ? (
        <View style={[styles.toastWrap, { bottom: insets.bottom + 30 }]} pointerEvents="none">
          <Toast text={toastMsg} />
        </View>
      ) : null}
    </NavContext.Provider>
  );
}

export function useNav(): Nav {
  const ctx = useContext(NavContext);
  if (ctx === null) {
    throw new Error('useNav must be used within <NavProvider>');
  }
  return ctx;
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 60 },
});
