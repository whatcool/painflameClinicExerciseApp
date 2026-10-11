import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { DashboardCarousel } from '../../components/DashboardCarousel';
import { DoctorCard } from '../../components/DoctorCard';
import { DoctorLibraryModal } from '../../components/DoctorLibraryModal';
import { Icon } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { StreakBadge } from '../../components/StreakBadge';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import {
  useClinicSession,
  useTherapistGate,
} from '../../context/TherapistGate';
import { getDoctor, type Doctor } from '../../db/doctors';
import { getExerciseList, type PatientExercise } from '../../db/exerciseList';
import {
  currentStreak,
  getExercisedDays,
  getMonthStatuses,
  signupDayOf,
  summariseMonth,
  type DotColor,
} from '../../db/tracking';
import { setPatientDoctor } from '../../services/api';
import type { ScreenProps } from '../../navigation/types';
import { font, radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { toDayKey } from '../../utils/date';
import { firstName } from '../../utils/validation';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export function DashboardScreen({ navigation }: ScreenProps<'Dashboard'>) {
  const styles = useStyles();
  const { colors, isDark, setDark } = useTheme();
  const user = useCurrentUser();
  const { logout, refreshUser, sync } = useAuth();
  const requireTherapist = useTherapistGate();
  const { clinic, setClinic, endClinic } = useClinicSession();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [doctor, setDoctorState] = useState<Doctor | null>(null);
  const [exercises, setExercises] = useState<PatientExercise[]>([]);
  const [streak, setStreak] = useState(0);
  const [month, setMonth] = useState<{
    year: number;
    monthIndex: number;
    dots: Map<string, DotColor>;
    today: string;
  } | null>(null);

  // Whenever the dashboard comes back into view: re-read the cache, then fetch updates.
  useFocusEffect(
    useCallback(() => {
      refreshUser();
      sync();
    }, [refreshUser, sync]),
  );

  // Recompute from the cache whenever the user data changes (after a sync or an edit).
  useEffect(() => {
    const now = new Date();
    const today = toDayKey(now);
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    setExercises(getExerciseList(user.id));
    setStreak(currentStreak(getExercisedDays(user.id), today));
    const { dots } = summariseMonth(
      year,
      monthIndex,
      getMonthStatuses(user.id, year, monthIndex),
      signupDayOf(user.createdAt),
      today,
    );
    setMonth({ year, monthIndex, dots, today });
    setDoctorState(user.doctorId !== null ? getDoctor(user.doctorId) : null);
  }, [user]);

  const closeLibrary = () => {
    setLibraryOpen(false);
    endClinic();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <Logo width={140} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            onPress={() => setMenuOpen(true)}
            hitSlop={12}
            style={styles.menuButton}
          >
            <Icon
              name="menu"
              size={30}
              color={colors.primary}
              strokeWidth={2.5}
            />
          </Pressable>
        </View>

        <View style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name} numberOfLines={1}>
              {firstName(user.fullName)}
            </Text>
          </View>
          <StreakBadge days={streak} />
        </View>

        <DoctorCard
          doctor={doctor}
          onChange={() =>
            requireTherapist(session => {
              setClinic(session);
              setLibraryOpen(true);
            })
          }
        />

        <Button
          title="START"
          large
          style={styles.start}
          onPress={() => {
            if (exercises.length === 0) {
              Alert.alert(
                'No exercises yet',
                'Add exercises to your list before starting.',
                [
                  { text: 'Not now', style: 'cancel' },
                  {
                    text: 'Create list',
                    onPress: () =>
                      navigation.navigate('ExerciseList', { edit: true }),
                  },
                ],
              );
              return;
            }
            navigation.navigate('Counttill');
          }}
        />

        {month && (
          <DashboardCarousel
            exercises={exercises}
            month={month}
            onEditExercises={() =>
              navigation.navigate('ExerciseList', { edit: true })
            }
            onOpenStreak={() => navigation.navigate('Tracking')}
          />
        )}
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View
            style={[
              styles.menu,
              { marginTop: insets.top + spacing.xl + spacing.md },
            ]}
          >
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: isDark }}
              accessibilityLabel="Dark theme"
              onPress={() => setDark(!isDark)}
              style={({ pressed }) => [
                styles.themeRow,
                pressed && styles.menuItemPressed,
              ]}
            >
              <Icon name="moon" size={22} color={colors.text} />
              <Text style={styles.themeText}>Dark theme</Text>
              <Switch
                value={isDark}
                onValueChange={setDark}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.white}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Logout"
              onPress={() => {
                setMenuOpen(false);
                logout();
              }}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.menuItemPressed,
              ]}
            >
              <Text style={styles.logoutText}>Logout</Text>
              <Icon name="logout" size={22} color={colors.danger} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <DoctorLibraryModal
        visible={libraryOpen}
        title="Choose doctor"
        selectedId={user.doctorId}
        clinic={clinic?.client ?? null}
        onClose={closeLibrary}
        onSelect={async selected => {
          if (!clinic) {
            return;
          }
          try {
            await setPatientDoctor(clinic.client, user.id, selected.id);
            closeLibrary();
            refreshUser();
          } catch {
            Alert.alert(
              'Could not change doctor',
              'Please check the internet connection.',
            );
          }
        }}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    menuButton: { padding: spacing.sm },
    greetingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    greetingText: { flex: 1 },
    greeting: { fontSize: font.body, color: colors.textMuted },
    name: { fontSize: font.hero, fontWeight: '700', color: colors.primary },
    start: { marginVertical: spacing.md },
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'flex-end',
    },
    menu: {
      marginRight: spacing.md,
      minWidth: 240,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingVertical: spacing.xs,
      elevation: 6,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingLeft: spacing.lg,
      paddingRight: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    themeText: { flex: 1, fontSize: font.large, color: colors.text },
    menuItem: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    menuItemPressed: { backgroundColor: colors.primaryLight },
    logoutText: {
      fontSize: font.large,
      color: colors.danger,
      fontWeight: '600',
    },
  }),
);
