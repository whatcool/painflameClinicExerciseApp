import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import { handOffClinic, useTherapistGate } from '../../context/TherapistGate';
import {
  groupReports,
  listReports,
  type DateGroup,
  type Report,
} from '../../db/reports';
import type { ScreenProps } from '../../navigation/types';
import { deleteReport, reportUrl } from '../../services/api';
import { isImage } from '../../services/files';
import { supabase } from '../../services/supabase';
import { font, radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { formatLongDate } from '../../utils/date';

type Viewer = { photos: Report[]; index: number } | null;

export function ReportsScreen({ navigation }: ScreenProps<'Reports'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const user = useCurrentUser();
  const requireTherapist = useTherapistGate();
  const [groups, setGroups] = useState<DateGroup[]>([]);
  const [viewer, setViewer] = useState<Viewer>(null);
  const { sync } = useAuth();
  // Photos are private: they are shown through short-lived signed links.
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    const reports = listReports(user.id);
    setGroups(groupReports(reports));
    const photos = reports.filter(r => isImage(r.mimeType));
    if (photos.length) {
      supabase.storage
        .from('patient-files')
        .createSignedUrls(
          photos.map(p => p.filePath),
          3600,
        )
        .then(({ data }) => {
          const urls: Record<string, string> = {};
          data?.forEach((entry, i) => {
            if (entry.signedUrl) {
              urls[photos[i].id] = entry.signedUrl;
            }
          });
          setPhotoUrls(urls);
        })
        .catch(() => {}); // offline: placeholders
    }
  }, [user.id]);

  useFocusEffect(
    useCallback(() => {
      load();
      sync(true).then(load);
    }, [load, sync]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityLabel="Add document"
          onPress={() =>
            requireTherapist(session => {
              handOffClinic(session);
              navigation.navigate('AddReport');
            })
          }
          hitSlop={12}
          style={styles.headerAdd}>
          <Icon name="plus" size={20} color={colors.white} />
          <Text style={styles.headerAddText}>Add</Text>
        </Pressable>
      ),
    });
  }, [navigation, requireTherapist, styles, colors]);

  const openPdf = async (report: Report) => {
    try {
      // Opens in the phone's PDF viewer or browser through a link valid for one hour.
      await Linking.openURL(await reportUrl(report));
    } catch {
      Alert.alert('Cannot open file', 'Please check your internet connection and try again.');
    }
  };

  const confirmDelete = (report: Report) =>
    requireTherapist(session =>
      Alert.alert(
        isImage(report.mimeType) ? 'Delete photo?' : 'Delete document?',
        report.title ? `"${report.title}" will be removed.` : 'This photo will be removed.',
        [
          { text: 'Cancel', style: 'cancel', onPress: session.end },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteReport(session.client, report);
                load();
              } catch {
                Alert.alert('Not deleted', 'Please check the internet connection and try again.');
              } finally {
                session.end();
              }
            },
          },
        ],
        { onDismiss: session.end },
      ),
    );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={groups}
        keyExtractor={group => group.date}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="file" size={48} color={colors.border} />
            <Text style={styles.emptyText}>
              No documents yet. Reports from Painflame Clinic will appear here.
            </Text>
          </View>
        }
        renderItem={({ item: group }) => (
          <View style={styles.dateGroup}>
            <Text style={styles.date}>{formatLongDate(group.date)}</Text>
            {group.doctors.map(doctorGroup => {
              const pdfs = doctorGroup.reports.filter(r => !isImage(r.mimeType));
              const photos = doctorGroup.reports.filter(r => isImage(r.mimeType));
              return (
                <View key={doctorGroup.doctorId} style={styles.doctorGroup}>
                  <Text style={styles.doctorName}>{doctorGroup.doctorName}</Text>
                  {pdfs.map(report => (
                    <Pressable
                      key={report.id}
                      onPress={() => openPdf(report)}
                      style={({ pressed }) => [styles.report, pressed && styles.pressed]}>
                      <View style={styles.pdfThumb}>
                        <Icon name="file" color={colors.primary} />
                        <Text style={styles.pdfLabel}>PDF</Text>
                      </View>
                      <Text style={styles.reportTitle} numberOfLines={2}>
                        {report.title}
                      </Text>
                      <Pressable
                        accessibilityLabel={`Delete ${report.title}`}
                        onPress={() => confirmDelete(report)}
                        hitSlop={10}
                        style={styles.delete}>
                        <Icon name="trash" size={20} color={colors.textMuted} />
                      </Pressable>
                    </Pressable>
                  ))}
                  {photos.length > 0 && (
                    <View style={styles.photoGrid}>
                      {photos.map((photo, index) => (
                        <Pressable
                          key={photo.id}
                          accessibilityLabel={`Open photo ${index + 1}`}
                          onPress={() => setViewer({ photos, index })}
                          style={styles.photoTile}>
                          {photoUrls[photo.id] ? (
                            <Image source={{ uri: photoUrls[photo.id] }} style={styles.photo} />
                          ) : (
                            <View style={[styles.photo, styles.photoPlaceholder]}>
                              <Icon name="image" color={colors.textMuted} />
                            </View>
                          )}
                          <Pressable
                            accessibilityLabel={`Delete photo ${index + 1}`}
                            onPress={() => confirmDelete(photo)}
                            hitSlop={8}
                            style={styles.photoDelete}>
                            <Icon name="trash" size={14} color={colors.white} />
                          </Pressable>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      />

      <PhotoViewer viewer={viewer} urls={photoUrls} onClose={() => setViewer(null)} />
    </SafeAreaView>
  );
}

/** Full-screen photo viewer; swipe left/right between the photos of one group. */
function PhotoViewer({
  viewer,
  urls,
  onClose,
}: {
  viewer: Viewer;
  urls: Record<string, string>;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(viewer?.index ?? 0), [viewer]);

  return (
    <Modal
      visible={viewer !== null}
      animationType="fade"
      onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.viewer}>
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerTitle}>
              {viewer && viewer.photos.length > 1
                ? `Photo ${index + 1} of ${viewer.photos.length}`
                : 'Photo'}
            </Text>
            <Pressable accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
              <Icon name="close" color={colors.white} size={28} />
            </Pressable>
          </View>
          {viewer && (
            <FlatList
              data={viewer.photos}
              keyExtractor={photo => String(photo.id)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={viewer.index}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onMomentumScrollEnd={e =>
                setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
              }
              renderItem={({ item }) => (
                <Image source={{ uri: urls[item.id] }} style={[styles.viewerImage, { width }]} />
              )}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const TILE = 92;

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    list: { padding: spacing.md, paddingBottom: spacing.xl },
    headerAdd: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    headerAddText: { color: colors.white, fontSize: font.body, fontWeight: '700' },
    empty: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.md },
    emptyText: { textAlign: 'center', fontSize: font.body, color: colors.textMuted },
    dateGroup: { marginBottom: spacing.lg },
    date: {
      fontSize: font.large,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: spacing.sm,
    },
    doctorGroup: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    doctorName: {
      fontSize: font.body,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: spacing.xs,
      paddingBottom: spacing.sm,
    },
    report: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.xs,
      borderRadius: radius.sm,
    },
    pressed: { backgroundColor: colors.primaryLight },
    pdfThumb: {
      width: 52,
      height: 52,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pdfLabel: { fontSize: 10, fontWeight: '700', color: colors.primary },
    reportTitle: { flex: 1, fontSize: font.body, color: colors.text },
    delete: { padding: spacing.sm },
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      padding: spacing.xs,
    },
    photoTile: { width: TILE, height: TILE },
    photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    photo: {
      width: TILE,
      height: TILE,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryLight,
    },
    photoDelete: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewer: { flex: 1, backgroundColor: '#000000' },
    viewerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.md,
    },
    viewerTitle: { flex: 1, color: colors.white, fontSize: font.body, fontWeight: '600' },
    viewerImage: { height: '100%', resizeMode: 'contain' },
  }),
);
