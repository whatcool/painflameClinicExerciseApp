import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { CommonActions, StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { font, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

type Tab = { label: string; icon: IconName; screen: 'Dashboard' | 'Profile' | 'Reports' };

const TABS: Tab[] = [
  { label: 'Home', icon: 'home', screen: 'Dashboard' },
  { label: 'Profile', icon: 'user', screen: 'Profile' },
  { label: 'Reports', icon: 'file', screen: 'Reports' },
];

// Which tab is highlighted for each screen.
const TAB_FOR_SCREEN: Partial<Record<keyof RootStackParamList, Tab['screen']>> = {
  Dashboard: 'Dashboard',
  Tracking: 'Dashboard',
  ExerciseList: 'Dashboard',
  Profile: 'Profile',
  Reports: 'Reports',
  AddReport: 'Reports',
  SessionComplete: 'Dashboard',
};

function goTo(screen: Tab['screen']) {
  if (!navigationRef.isReady()) {
    return;
  }
  if (screen === 'Dashboard') {
    navigationRef.dispatch(StackActions.popToTop());
    return;
  }
  // Keep the stack shallow: Home underneath, the chosen page on top,
  // so the Android back button always returns to Home.
  const state = navigationRef.getRootState();
  if (!state) {
    return;
  }
  navigationRef.dispatch(
    CommonActions.reset({
      ...state,
      index: 1,
      routes: [state.routes[0], { name: screen }],
    } as Parameters<typeof CommonActions.reset>[0]),
  );
}

/** Bottom navigation shown on every page after login. */
export function BottomNavBar({ currentScreen }: { currentScreen: keyof RootStackParamList | undefined }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Hide while typing so it doesn't sit on top of the keyboard.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardOpen) {
    return null;
  }

  const activeTab = currentScreen ? TAB_FOR_SCREEN[currentScreen] : 'Dashboard';

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {TABS.map(tab => {
        const active = tab.screen === activeTab;
        const color = active ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={tab.screen}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => {
              if (currentScreen !== tab.screen) {
                goTo(tab.screen);
              }
            }}
            style={styles.tab}>
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Icon name={tab.icon} size={24} color={color} strokeWidth={active ? 2.5 : 2} />
            </View>
            <Text style={[styles.label, { color }, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.xs,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
    iconWrap: { paddingHorizontal: spacing.md + 4, paddingVertical: 4, borderRadius: 16 },
    iconWrapActive: { backgroundColor: colors.primaryLight },
    label: { fontSize: font.small - 1, marginTop: 2 },
    labelActive: { fontWeight: '700' },
  }),
);
