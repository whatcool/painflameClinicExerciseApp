import React, { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { ExerciseDoodle } from '../components/ExerciseDoodle';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { LockScreen } from '../screens/auth/LockScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { LinkAccountScreen } from '../screens/auth/LinkAccountScreen';
import { AddReportScreen } from '../screens/main/AddReportScreen';
import { CounttillScreen } from '../screens/main/CounttillScreen';
import { SessionCompleteScreen } from '../screens/main/SessionCompleteScreen';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { ExerciseListScreen } from '../screens/main/ExerciseListScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { ReportsScreen } from '../screens/main/ReportsScreen';
import { TrackingScreen } from '../screens/main/TrackingScreen';
import { font } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { BottomNavBar } from './BottomNavBar';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const fadeNoHeader: NativeStackNavigationOptions = { headerShown: false, animation: 'fade' };

// Screens drawn on the page background (no indigo header) need dark status-bar icons.
const SCREENS_WITHOUT_HEADER = new Set<keyof RootStackParamList>([
  'Login',
  'LinkAccount',
  'Lock',
  'Dashboard',
  'Counttill',
  'SessionComplete',
]);

// The exercise session is distraction-free: no navbar.
const SCREENS_WITHOUT_NAVBAR = new Set<keyof RootStackParamList>(['Counttill']);

export function RootNavigator() {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const { status } = useAuth();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.header,
    },
  };
  const [currentScreen, setCurrentScreen] =
    useState<keyof RootStackParamList>();
  const trackScreen = () =>
    setCurrentScreen(navigationRef.getCurrentRoute()?.name);

  if (status === 'loading') {
    return (
      // Same background as the splash screen, so the hand-over is seamless.
      <View style={styles.loading}>
        <Logo width={240} />
        <View style={styles.spinner}>
          <ExerciseDoodle message="Getting things ready…" />
        </View>
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={trackScreen}
      onStateChange={trackScreen}
    >
      <StatusBar
        barStyle={
          isDark || (currentScreen && !SCREENS_WITHOUT_HEADER.has(currentScreen))
            ? 'light-content'
            : 'dark-content'
        }
      />
      <View style={styles.flex}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.header },
            headerTintColor: colors.white,
            headerTitleStyle: { fontSize: font.large, fontWeight: '700' },
            // Smooth sliding page transitions; screens that replace each other fade.
            animation: 'ios_from_right',
            animationTypeForReplace: 'push',
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {status === 'signedOut' && (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={fadeNoHeader}
              />
            </>
          )}
          {status === 'needsLink' && (
            <Stack.Screen
              name="LinkAccount"
              component={LinkAccountScreen}
              options={fadeNoHeader}
            />
          )}
          {status === 'locked' && (
            <Stack.Screen
              name="Lock"
              component={LockScreen}
              options={fadeNoHeader}
            />
          )}
          {status === 'signedIn' && (
            <>
              <Stack.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={fadeNoHeader}
              />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="Tracking" component={TrackingScreen} />
              <Stack.Screen
                name="ExerciseList"
                component={ExerciseListScreen}
                options={{ title: 'Exercise List' }}
              />
              <Stack.Screen name="Reports" component={ReportsScreen} />
              <Stack.Screen
                name="AddReport"
                component={AddReportScreen}
                options={{ title: 'Add document' }}
              />
              <Stack.Screen
                name="Counttill"
                component={CounttillScreen}
                options={{
                  headerShown: false,
                  gestureEnabled: false,
                  animation: 'fade_from_bottom',
                }}
              />
              <Stack.Screen
                name="SessionComplete"
                component={SessionCompleteScreen}
                options={fadeNoHeader}
              />
            </>
          )}
        </Stack.Navigator>
        {status === 'signedIn' &&
          !(currentScreen && SCREENS_WITHOUT_NAVBAR.has(currentScreen)) && (
            <BottomNavBar currentScreen={currentScreen} />
          )}
      </View>
    </NavigationContainer>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    flex: { flex: 1 },
    spinner: { marginTop: 32 },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
  }),
);
