import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { searchLibrary, type LibraryExercise } from '../data/exerciseLibrary';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { Button } from './Button';
import { ExerciseThumb } from './ExerciseThumb';
import { Icon } from './Icon';

type Props = {
  visible: boolean;
  addedIds: Set<string>;
  onAdd: (exercise: LibraryExercise) => void;
  onClose: () => void;
};

/** Searches the Exercise Library only. Stays open so several exercises can be added. */
export function AddExerciseModal({ visible, addedIds, onAdd, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const results = useMemo(() => searchLibrary(text), [text]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <Text style={styles.title}>Add exercise</Text>
            <Pressable accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
              <Icon name="close" color={colors.white} />
            </Pressable>
          </View>
          <View style={styles.searchBox}>
            <Icon name="search" color={colors.textMuted} size={20} />
            <TextInput
              style={styles.searchInput}
              value={text}
              onChangeText={setText}
              placeholder="Search exercises"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No exercise found</Text>}
            renderItem={({ item }) => {
              const added = addedIds.has(item.id);
              return (
                <Pressable
                  onPress={() => onAdd(item)}
                  disabled={added}
                  style={[styles.row, added && styles.rowAdded]}>
                  <ExerciseThumb exercise={item} size={48} />
                  <Text style={styles.name}>{item.name}</Text>
                  <Icon
                    name={added ? 'check' : 'plus'}
                    color={added ? colors.dotGreen : colors.primary}
                  />
                </Pressable>
              );
            }}
          />
          <View style={styles.footer}>
            <Button title="Done" onPress={onClose} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.header,
      padding: spacing.md,
    },
    title: { color: colors.white, fontSize: font.large, fontWeight: '700' },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: font.body,
      color: colors.text,
      paddingVertical: spacing.sm + 4,
      marginLeft: spacing.sm,
    },
    list: { paddingHorizontal: spacing.md },
    empty: { textAlign: 'center', color: colors.textMuted, fontSize: font.body, marginTop: spacing.lg },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    rowAdded: { opacity: 0.6 },
    name: { flex: 1, fontSize: font.body, color: colors.text },
    footer: { padding: spacing.md },
  }),
);
