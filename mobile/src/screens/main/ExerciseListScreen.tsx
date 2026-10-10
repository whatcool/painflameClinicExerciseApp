import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddExerciseModal } from '../../components/AddExerciseModal';
import { Button } from '../../components/Button';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Icon } from '../../components/Icon';
import { Stepper } from '../../components/Stepper';
import { useCurrentUser } from '../../context/AuthContext';
import { getLibraryExercise } from '../../data/exerciseLibrary';
import {
  DEFAULT_HOLD_SECONDS,
  DEFAULT_REPS,
  getExerciseList,
  saveExerciseList,
  type PatientExercise,
} from '../../db/exerciseList';
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
  const [items, setItems] = useState(() => getExerciseList(user.id));
  // Opened from the dashboard's edit button: start straight in edit mode.
  const openInEdit = route.params?.edit === true;
  const [draft, setDraft] = useState<DraftItem[] | null>(() =>
    openInEdit ? items.map(withKey) : null,
  ); // non-null = edit mode
  // With an empty list there is nothing to edit yet, so open the exercise search.
  const [adding, setAdding] = useState(openInEdit && items.length === 0);

  const startEditing = useCallback(
    (openSearch = false) => {
      setDraft(items.map(withKey));
      setAdding(openSearch);
    },
    [items],
  );

  const save = useCallback(() => {
    if (!draft) {
      return;
    }
    const cleaned = draft.map(({ key: _key, ...rest }) => rest);
    saveExerciseList(user.id, cleaned);
    setItems(cleaned);
    setDraft(null);
  }, [draft, user.id]);

  const cancel = useCallback(() => setDraft(null), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        draft ? (
          <Pressable onPress={save} hitSlop={12}>
            <Text style={styles.headerAction}>Save</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => startEditing()} hitSlop={12} style={styles.headerEdit}>
            <Icon name="edit" size={18} color={colors.white} />
            <Text style={styles.headerAction}>Edit</Text>
          </Pressable>
        ),
    });
  }, [navigation, draft, save, startEditing, styles, colors]);

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
          <Button title="Save list" onPress={save} style={styles.flex} />
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
