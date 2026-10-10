import type { ImageSourcePropType } from 'react-native';

/**
 * Exercise Library: the clinic's pool of exercises. Patients never browse this
 * directly; it is only searched from "Add exercise" on the Exercise List.
 *
 * To add media for an exercise, put files in src/assets/exercises/ and reference them:
 *   images: [require('../assets/exercises/chin-tuck-1.jpg'), require('../assets/exercises/chin-tuck-2.jpg')],
 *   thumbnailIndex: 0,
 *   video: require('../assets/exercises/chin-tuck.mp4'),   // 5-second clip
 *
 * Exercise ids are stored in patients' lists, so never change or reuse an id.
 * Later this list can be served from the backend instead of being bundled.
 */
export type LibraryExercise = {
  id: string;
  name: string;
  images: ImageSourcePropType[];
  thumbnailIndex: number; // which entry of `images` is the thumbnail
  video: number | null; // require()'d 5-second video
};

const exercise = (id: string, name: string): LibraryExercise => ({
  id,
  name,
  images: [],
  thumbnailIndex: 0,
  video: null,
});

// Starter set of common spine/joint rehab exercises. Replace or extend with the clinic's own.
export const EXERCISE_LIBRARY: LibraryExercise[] = [
  exercise('chin-tuck', 'Chin Tuck'),
  exercise('neck-side-bend', 'Neck Side Bend'),
  exercise('neck-rotation', 'Neck Rotation'),
  exercise('shoulder-shrug', 'Shoulder Shrug'),
  exercise('shoulder-blade-squeeze', 'Shoulder Blade Squeeze'),
  exercise('wall-push-up', 'Wall Push-up'),
  exercise('pelvic-tilt', 'Pelvic Tilt'),
  exercise('knee-to-chest', 'Knee to Chest Stretch'),
  exercise('double-knee-to-chest', 'Double Knee to Chest'),
  exercise('bridging', 'Bridging'),
  exercise('cat-camel', 'Cat-Camel'),
  exercise('bird-dog', 'Bird Dog'),
  exercise('prone-press-up', 'Prone Press-up'),
  exercise('lower-trunk-rotation', 'Lower Trunk Rotation'),
  exercise('piriformis-stretch', 'Piriformis Stretch'),
  exercise('hamstring-stretch', 'Hamstring Stretch'),
  exercise('straight-leg-raise', 'Straight Leg Raise'),
  exercise('quadriceps-set', 'Quadriceps Set'),
  exercise('heel-slide', 'Heel Slide'),
  exercise('ankle-pump', 'Ankle Pump'),
  exercise('calf-stretch', 'Calf Stretch'),
  exercise('clamshell', 'Clamshell'),
];

const byId = new Map(EXERCISE_LIBRARY.map(item => [item.id, item]));

export function getLibraryExercise(id: string) {
  return byId.get(id) ?? null;
}

export function getThumbnail(item: LibraryExercise): ImageSourcePropType | null {
  return item.images[item.thumbnailIndex] ?? item.images[0] ?? null;
}

export function searchLibrary(text: string) {
  const needle = text.trim().toLowerCase();
  if (!needle) {
    return EXERCISE_LIBRARY;
  }
  return EXERCISE_LIBRARY.filter(item => item.name.toLowerCase().includes(needle));
}
