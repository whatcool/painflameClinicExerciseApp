import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { listDoctors, type Doctor } from '../db/doctors';
import { fetchDoctors, saveDoctor } from '../services/api';
import { pickImage, type PickedFile } from '../services/files';
import type { Client } from '../services/supabase';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { formatMonthYear } from '../utils/date';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Icon } from './Icon';
import { MonthYearField } from './MonthYearField';
import { TextField } from './TextField';

type Props = {
  visible: boolean;
  title: string;
  selectedId?: string | null;
  /** Clinic connection from the password gate; all reads and writes here use it. */
  clinic: Client | null;
  onSelect: (doctor: Doctor) => void;
  onClose: () => void;
};

/**
 * Doctor Library. Only ever opened after the clinic password has been entered
 * (from the dashboard doctor card or the Reports "Add" flow), so adding and editing
 * doctors here happens inside that already-unlocked action.
 */
export function DoctorLibraryModal({ visible, title, selectedId, clinic, onSelect, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [editing, setEditing] = useState<Doctor | 'new' | null>(null);
  const [loading, setLoading] = useState(false);

  // Show the cached list at once, then the latest from the server.
  const load = useCallback(async () => {
    setDoctors(listDoctors());
    if (!clinic) {
      return;
    }
    setLoading(true);
    try {
      setDoctors(await fetchDoctors(clinic));
    } catch {
      // offline: keep the cached list
    } finally {
      setLoading(false);
    }
  }, [clinic]);

  useEffect(() => {
    if (visible) {
      setEditing(null);
      load();
    }
  }, [visible, load]);

  const onSaved = () => {
    setEditing(null);
    load();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={editing ? () => setEditing(null) : onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {editing === 'new' ? 'New doctor' : editing ? 'Edit doctor' : title}
            </Text>
            <Pressable
              accessibilityLabel="Close"
              onPress={editing ? () => setEditing(null) : onClose}
              hitSlop={12}>
              <Icon name="close" color={colors.white} />
            </Pressable>
          </View>

          {editing ? (
            <DoctorForm
              doctor={editing === 'new' ? null : editing}
              clinic={clinic}
              onSaved={onSaved}
            />
          ) : (
            <FlatList
              data={doctors}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                <Button
                  title="+ Add new doctor"
                  variant="secondary"
                  onPress={() => setEditing('new')}
                  style={styles.addButton}
                />
              }
              ListEmptyComponent={
                loading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.empty}>No doctors yet. Add the first one.</Text>
                )
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={[styles.row, item.id === selectedId && styles.rowSelected]}>
                  <Avatar uri={item.photoUrl} size={56} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{item.fullName}</Text>
                    <Text style={styles.rowDetail}>{item.contact}</Text>
                    <Text style={styles.rowDetail}>
                      Since {formatMonthYear(item.startMonth, item.startYear)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Edit ${item.fullName}`}
                    onPress={() => setEditing(item)}
                    hitSlop={10}
                    style={styles.editButton}>
                    <Icon name="edit" size={20} color={colors.primary} />
                  </Pressable>
                </Pressable>
              )}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function DoctorForm({
  doctor,
  clinic,
  onSaved,
}: {
  doctor: Doctor | null;
  clinic: Client | null;
  onSaved: () => void;
}) {
  const styles = useStyles();
  const now = new Date();
  const [photoUri, setPhotoUri] = useState(doctor?.photoUrl ?? null);
  const [newPhoto, setNewPhoto] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(doctor?.fullName ?? '');
  const [contact, setContact] = useState(doctor?.contact ?? '');
  const [start, setStart] = useState({
    month: doctor?.startMonth ?? now.getMonth() + 1,
    year: doctor?.startYear ?? now.getFullYear(),
  });
  const [errors, setErrors] = useState<{ fullName?: string; contact?: string }>({});

  const choosePhoto = async () => {
    try {
      const file = await pickImage('doctor');
      if (file) {
        setPhotoUri(file.uri);
        setNewPhoto(file);
      }
    } catch {
      Alert.alert('Could not add photo', 'Please try a different image.');
    }
  };

  const save = async () => {
    const nextErrors: typeof errors = {};
    if (!fullName.trim()) {
      nextErrors.fullName = 'Enter the doctor’s full name';
    }
    if (!/^\+?\d{10,13}$/.test(contact.replace(/\s/g, ''))) {
      nextErrors.contact = 'Enter a valid contact number';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !clinic) {
      return;
    }
    setSaving(true);
    try {
      await saveDoctor(clinic, {
        id: doctor?.id ?? null,
        fullName: fullName.trim(),
        contact: contact.trim(),
        startMonth: start.month,
        startYear: start.year,
        newPhoto,
      });
      onSaved();
    } catch {
      Alert.alert('Could not save', 'Please check the internet connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
      <Pressable onPress={choosePhoto} style={styles.photo}>
        <Avatar uri={photoUri} size={110} />
        <Text style={styles.photoText}>{photoUri ? 'Change photo' : 'Add photo'}</Text>
      </Pressable>
      <TextField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        error={errors.fullName}
        autoCapitalize="words"
      />
      <TextField
        label="Contact number"
        value={contact}
        onChangeText={setContact}
        error={errors.contact}
        keyboardType="phone-pad"
      />
      <MonthYearField label="Working at Painflame since" value={start} onChange={setStart} />
      <Button title="Save doctor" onPress={save} loading={saving} />
    </ScrollView>
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
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    title: { color: colors.white, fontSize: font.large, fontWeight: '700' },
    list: { padding: spacing.md },
    addButton: { marginBottom: spacing.md },
    empty: { textAlign: 'center', color: colors.textMuted, fontSize: font.body, marginTop: spacing.lg },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowSelected: { borderColor: colors.primary, borderWidth: 2 },
    rowInfo: { flex: 1, marginLeft: spacing.md },
    rowName: { fontSize: font.body, fontWeight: '700', color: colors.text },
    rowDetail: { fontSize: font.small, color: colors.textMuted },
    editButton: { padding: spacing.sm },
    photo: { alignItems: 'center', marginBottom: spacing.lg },
    photoText: { marginTop: spacing.sm, color: colors.primary, fontSize: font.body, fontWeight: '600' },
  }),
);
