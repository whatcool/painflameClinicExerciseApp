import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddExerciseModal } from '../../components/AddExerciseModal';
import { BusyOverlay } from '../../components/BusyOverlay';
import { Button } from '../../components/Button';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Icon } from '../../components/Icon';
import { Stepper } from '../../components/Stepper';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import {
  useClinicSession,
  useTherapistGate,
  type ClinicSession,
} from '../../context/TherapistGate';
import { getLibraryExercise } from '../../data/exerciseLibrary';
import {
  DEFAULT_HOLD_SECONDS,
  DEFAULT_REPS,
  getExerciseList,
  type PatientExercise,
} from '../../db/exerciseList';
import { saveExerciseList, setPatientCanEdit } from '../../services/api';
import { supabase } from '../../services/supabase';
import type { ScreenProps } from '../../navigation/types';
import { font, radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';

type DraftItem = PatientExercise & { key: string };

let nextKey = 0;
const withKey = (item: PatientExercise): DraftItem => ({ ...item, key: String(nextKey++) });

export function ExerciseListScreen({ navigation, route }: ScreenProps<'ExerciseList'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const user = useCurrentUser();
  const { refreshUser } = useAuth();
  const requireTherapist = useTherapistGate();
  // Set while a therapist is editing on this phone (after the clinic password).
  const { clinic, setClinic, endClinic } = useClinicSession();
  const [items, setItems] = useState(() => getExerciseList(user.id));
  const [draft, setDraft] = useState<DraftItem[] | null>(null); // non-null = edit mode
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  // Only therapists edit lists, unless the clinic has unlocked editing for this patient.
  const patientCanEdit = user.canEditExercises;

  const beginEdit = useCallback(
    (openSearch: boolean) => {
      const current = getExerciseList(user.id);
      setDraft(current.map(withKey));
      // With an empty list there is nothing to edit yet, so open the exercise search.
      setAdding(openSearch || current.length === 0);
    },
    [user.id],
  );

  const startEditing = useCallback(
    (openSearch = false) => {
      if (patientCanEdit) {
        beginEdit(openSearch);
        return;
      }
      requireTherapist(session => {
        setClinic(session);
        beginEdit(openSearch);
      });
    },
    [patientCanEdit, beginEdit, requireTherapist, setClinic],
  );

  // Opened from the dashboard's edit button: go straight to editing.
  const openInEdit = route.params?.edit === true;
  useEffect(() => {
    if (openInEdit) {
      startEditing();
    }
    // Only on first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(async () => {
    if (!draft || saving) {
      return;
    }
    const cleaned = draft.map(({ key: _key, ...rest }) => rest);
    setSaving(true);
    try {
      await saveExerciseList(clinic?.client ?? supabase, user.id, cleaned);
      setItems(cleaned);
      setDraft(null);
      endClinic();
    } catch {
      Alert.alert(
        'List not saved',
        'Please check the internet connection. If editing was switched off by the clinic, ask your therapist.',
      );
    } finally {
      setSaving(false);
    }
  }, [draft, saving, clinic, user.id, endClinic]);

  const cancel = useCallback(() => {
    setDraft(null);
    endClinic();
  }, [endClinic]);

  /** Turns the patient's own editing on or off. Always needs the clinic password. */
  const togglePatientEditing = (allow: boolean) => {
    const apply = async (session: ClinicSession, endAfter: boolean) => {
      try {
        await setPatientCanEdit(session.client, user.id, allow);
        refreshUser();
      } catch {
        Alert.alert('Not changed', 'Please check the internet connection and try again.');
      } finally {
        if (endAfter) {
          session.end();
        }
      }
    };
    if (clinic) {
      apply(clinic, false);
    } else {
      requireTherapist(session => apply(session, true));
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        draft ? (
          <Pressable onPress={save} hitSlop={12} disabled={saving}>
            <Text style={styles.headerAction}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => startEditing()} hitSlop={12} style={styles.headerEdit}>
            <Icon name="edit" size={18} color={colors.white} />
            <Text style={styles.headerAction}>Edit</Text>
          </Pressable>
        ),
    });
  }, [navigation, draft, save, saving, startEditing, styles, colors]);

  // Ask before leaving with unsaved edits.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (!draft) {
          return;
        }
        event.preventDefault();
        Alert.alert('Discard changes?', 'Your changes to the list are not saved.', [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(event.data.action),
          },
        ]);
      }),
    [navigation, draft],
  );

  const addedIds = useMemo(() => new Set(draft?.map(item => item.exerciseId)), [draft]);

  if (draft) {
    const update = (key: string, change: Partial<PatientExercise>) =>
      setDraft(current =>
        current!.map(item => (item.key === key ? { ...item, ...change } : item)),
      );
    const remove = (key: string) =>
      setDraft(current => current!.filter(item => item.key !== key));

    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <BusyOverlay visible={saving} message="Saving the exercise list…" />
        <View style={styles.permission}>
          <View style={styles.flex}>
            <Text style={styles.permissionTitle}>Patient can edit this list</Text>
            <Text style={styles.permissionHint}>
              {clinic ? 'Editing as clinic. ' : ''}Changing this needs the clinic password.
            </Text>
          </View>
          <Switch
            value={patientCanEdit}
            onValueChange={togglePatientEditing}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>
        <Text style={styles.hint}>Long-press an exercise and drag it to change the order.</Text>
        <ReorderableList
          data={draft}
          keyExtractor={item => item.key}
          onReorder={({ from, to }: ReorderableListReorderEvent) =>
            setDraft(current => reorderItems(current!, from, to))
          }
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <EditableRow
              item={item}
              position={index + 1}
              onChange={change => update(item.key, change)}
              onRemove={() => remove(item.key)}
            />
          )}
          ListFooterComponent={
            <Button
              title="+ Add exercise"
              variant="secondary"
              onPress={() => setAdding(true)}
              style={styles.addButton}
            />
          }
        />
        <View style={styles.bottomBar}>
          <Button title="Cancel" variant="secondary" onPress={cancel} style={styles.flex} />
          <Button title="Save list" onPress={save} loading={saving} style={styles.flex} />
        </View>
        <AddExerciseModal
          visible={adding}
          addedIds={addedIds}
          onClose={() => setAdding(false)}
          onAdd={exercise =>
            setDraft(current => [
              ...current!,
              withKey({
                exerciseId: exercise.id,
                reps: DEFAULT_REPS,
                holdSeconds: DEFAULT_HOLD_SECONDS,
              }),
            ])
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => `${item.exerciseId}-${index}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          patientCanEdit ? undefined : (
            <Text style={styles.managedNote}>
              Your therapist manages this list. Editing needs the clinic password.
            </Text>
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No exercises in your list yet.</Text>
            <Button title="Create exercise list" onPress={() => startEditing(true)} />
          </View>
        }
        renderItem={({ item, index }) => <ViewRow item={item} position={index + 1} />}
        ListFooterComponent={
          items.length ? (
            <Button
              title="Update list"
              variant="secondary"
              onPress={() => startEditing()}
              style={styles.addButton}
            />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

function ViewRow({ item, position }: { item: PatientExercise; position: number }) {
  const styles = useStyles();
  const exercise = getLibraryExercise(item.exerciseId);
  if (!exercise) {
    return null;
  }
  return (
    <View style={styles.row}>
      <Text style={styles.position}>{position}</Text>
      <ExerciseThumb exercise={exercise} />
      <View style={styles.rowInfo}>
        <Text style={styles.name}>{exercise.name}</Text>
        <Text style={styles.counts}>
          Reps {item.reps} · Hold {item.holdSeconds}s
        </Text>
      </View>
    </View>
  );
}

function EditableRow({
  item,
  position,
  onChange,
  onRemove,
}: {
  item: PatientExercise;
  position: number;
  onChange: (change: Partial<PatientExercise>) => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  const exercise = getLibraryExercise(item.exerciseId);
  if (!exercise) {
    return null;
  }
  return (
    <Pressable onLongPress={drag} delayLongPress={250} style={[styles.row, styles.editRow]}>
      <View style={styles.editTop}>
        <Icon name="grip" color={colors.textMuted} size={22} />
        <Text style={styles.position}>{position}</Text>
        <ExerciseThumb exercise={exercise} size={44} />
        <Text style={[styles.name, styles.rowInfo]} numberOfLines={2}>
          {exercise.name}
        </Text>
        <Pressable
          accessibilityLabel={`Remove ${exercise.name}`}
          onPress={onRemove}
          hitSlop={10}
          style={styles.remove}>
          <Icon name="trash" size={20} color={colors.danger} />
        </Pressable>
      </View>
      <View style={styles.steppers}>
        <Stepper label="Reps" value={item.reps} onChange={reps => onChange({ reps })} />
        <Stepper
          label="Hold (seconds)"
          value={item.holdSeconds}
          onChange={holdSeconds => onChange({ holdSeconds })}
          max={120}
        />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.md, paddingBottom: spacing.xl },
    permission: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      margin: spacing.md,
      marginBottom: 0,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    permissionTitle: { fontSize: font.body, fontWeight: '600', color: colors.text },
    permissionHint: { fontSize: font.small - 2, color: colors.textMuted, marginTop: 2 },
    managedNote: {
      fontSize: font.small,
      color: colors.textMuted,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    hint: {
      fontSize: font.small,
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    headerEdit: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    headerAction: { color: colors.white, fontSize: font.body, fontWeight: '700' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    editRow: { flexDirection: 'column', alignItems: 'stretch' },
    editTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    position: {
      minWidth: 28,
      textAlign: 'center',
      fontSize: font.large,
      fontWeight: '700',
      color: colors.primary,
    },
    rowInfo: { flex: 1 },
    name: { fontSize: font.body, fontWeight: '600', color: colors.text },
    counts: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
    remove: { padding: spacing.sm },
    steppers: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    addButton: { marginTop: spacing.sm },
    empty: { alignItems: 'stretch', marginTop: spacing.xl, gap: spacing.md },
    emptyText: { textAlign: 'center', fontSize: font.body, color: colors.textMuted },
    bottomBar: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    flex: { flex: 1 },
  }),
);
