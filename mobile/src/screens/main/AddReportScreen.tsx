import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { DoctorLibraryModal } from '../../components/DoctorLibraryModal';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { TextField, useFieldStyles } from '../../components/TextField';
import { useCurrentUser } from '../../context/AuthContext';
import type { Doctor } from '../../db/doctors';
import { addReport } from '../../db/reports';
import { transaction } from '../../db/database';
import type { ScreenProps } from '../../navigation/types';
import { pickReportPdf, pickReportPhotos, type PickedFile } from '../../services/files';
import { font, radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { toDayKey } from '../../utils/date';

// A document is either one PDF (with a title) or one or more photos (no title).
type Selection = { kind: 'pdf'; file: PickedFile } | { kind: 'photos'; files: PickedFile[] } | null;

/** Only reachable through the doctor's password (Reports → Add). */
export function AddReportScreen({ navigation }: ScreenProps<'AddReport'>) {
  const styles = useStyles();
  const fieldStyles = useFieldStyles();
  const { colors } = useTheme();
  const user = useCurrentUser();
  const [selection, setSelection] = useState<Selection>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toDayKey(new Date()));
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [errors, setErrors] = useState<{ file?: string; title?: string; doctor?: string }>({});

  const choosePdf = async () => {
    try {
      const file = await pickReportPdf();
      if (file) {
        setSelection({ kind: 'pdf', file });
        if (!title && file.name) {
          setTitle(file.name.replace(/\.[^.]+$/, ''));
        }
      }
    } catch {
      Alert.alert('Could not add file', 'Please choose a PDF file.');
    }
  };

  const choosePhotos = async () => {
    try {
      const files = await pickReportPhotos();
      if (files.length) {
        // Adding more photos keeps the ones already chosen.
        setSelection(current => ({
          kind: 'photos',
          files: [...(current?.kind === 'photos' ? current.files : []), ...files],
        }));
      }
    } catch {
      Alert.alert('Could not add photos', 'Please try again with different photos.');
    }
  };

  const removePhoto = (uri: string) =>
    setSelection(current => {
      if (current?.kind !== 'photos') {
        return current;
      }
      const files = current.files.filter(file => file.uri !== uri);
      return files.length ? { kind: 'photos', files } : null;
    });

  const save = () => {
    const next: typeof errors = {};
    if (!selection) {
      next.file = 'Choose a PDF or photos';
    }
    if (selection?.kind === 'pdf' && !title.trim()) {
      next.title = 'Enter a title';
    }
    if (!doctor) {
      next.doctor = 'Choose the issuing doctor';
    }
    setErrors(next);
    if (Object.keys(next).length || !selection || !doctor) {
      return;
    }
    const files = selection.kind === 'pdf' ? [selection.file] : selection.files;
    const docTitle = selection.kind === 'pdf' ? title.trim() : '';
    transaction(() => {
      for (const file of files) {
        addReport(user.id, {
          title: docTitle,
          reportDate: date,
          doctorId: doctor.id,
          fileUri: file.uri,
          mimeType: file.mimeType,
          fileName: file.name,
        });
      }
    });
    navigation.goBack();
  };

  return (
    <Screen>
      <Text style={fieldStyles.label}>Document</Text>
      <View style={styles.choiceRow}>
        <Pressable
          onPress={choosePdf}
          style={[styles.choice, selection?.kind === 'pdf' && styles.choiceActive]}>
          <Icon name="file" color={colors.primary} size={28} />
          <Text style={styles.choiceText}>PDF</Text>
        </Pressable>
        <Pressable
          onPress={choosePhotos}
          style={[styles.choice, selection?.kind === 'photos' && styles.choiceActive]}>
          <Icon name="image" color={colors.primary} size={28} />
          <Text style={styles.choiceText}>Photos</Text>
          <Text style={styles.choiceHint}>Select one or more</Text>
        </Pressable>
      </View>
      {errors.file ? <Text style={fieldStyles.error}>{errors.file}</Text> : null}

      {selection?.kind === 'pdf' && (
        <>
          <View style={styles.pdfRow}>
            <Icon name="file" color={colors.primary} />
            <Text style={styles.pdfName} numberOfLines={2}>
              {selection.file.name ?? 'Selected PDF'}
            </Text>
          </View>
          <TextField label="Title" value={title} onChangeText={setTitle} error={errors.title} />
        </>
      )}

      {selection?.kind === 'photos' && (
        <View style={styles.photos}>
          {selection.files.map(file => (
            <View key={file.uri} style={styles.photoTile}>
              <Image source={{ uri: file.uri }} style={styles.photo} />
              <Pressable
                accessibilityLabel="Remove photo"
                onPress={() => removePhoto(file.uri)}
                hitSlop={8}
                style={styles.removePhoto}>
                <Icon name="close" size={14} color={colors.white} strokeWidth={3} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={choosePhotos} style={[styles.photoTile, styles.addPhoto]}>
            <Icon name="plus" color={colors.primary} size={28} />
          </Pressable>
        </View>
      )}

      <View style={styles.gap} />
      <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />

      <Text style={fieldStyles.label}>Issuing doctor</Text>
      <Pressable
        onPress={() => setLibraryOpen(true)}
        style={[styles.picker, !!errors.doctor && styles.error]}>
        {doctor ? (
          <Avatar uri={doctor.photoUri} size={44} />
        ) : (
          <Icon name="plus" color={colors.primary} size={28} />
        )}
        <Text style={styles.pickerText}>{doctor ? doctor.fullName : 'Choose doctor'}</Text>
      </Pressable>
      {errors.doctor ? <Text style={fieldStyles.error}>{errors.doctor}</Text> : null}

      <Button title="Save" onPress={save} style={styles.save} />

      <DoctorLibraryModal
        visible={libraryOpen}
        title="Issuing doctor"
        selectedId={doctor?.id}
        onClose={() => setLibraryOpen(false)}
        onSelect={selected => {
          setDoctor(selected);
          setLibraryOpen(false);
        }}
      />
    </Screen>
  );
}

const TILE = 96;

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    choiceRow: { flexDirection: 'row', gap: spacing.sm },
    choice: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    choiceActive: { borderStyle: 'solid', borderWidth: 2, backgroundColor: colors.primaryLight },
    choiceText: { fontSize: font.body, fontWeight: '600', color: colors.primary, marginTop: 4 },
    choiceHint: { fontSize: font.small - 3, color: colors.textMuted },
    pdfRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginVertical: spacing.md,
    },
    pdfName: { flex: 1, fontSize: font.body, color: colors.text },
    photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    photoTile: { width: TILE, height: TILE },
    photo: { width: TILE, height: TILE, borderRadius: radius.sm },
    removePhoto: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.white,
    },
    addPhoto: {
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 64,
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    error: { borderColor: colors.danger },
    pickerText: { flex: 1, fontSize: font.body, color: colors.text },
    gap: { height: spacing.md },
    save: { marginTop: spacing.lg },
  }),
);
