import type { ImageSourcePropType } from 'react-native';
import { query, run, transaction } from '../db/database';

/**
 * Exercise Library, cached from Supabase. The clinic manages it in the admin panel
 * (names, pictures, the thumbnail and the 5-second video). Patients never browse it
 * directly; it is only searched from "Add exercise".
 */
export type LibraryExercise = {
  id: string;
  name: string;
  images: ImageSourcePropType[];
  thumbnailIndex: number; // which entry of `images` is the thumbnail
  videoUrl: string | null;
  active: boolean;
};

type ExerciseRow = {
  id: string;
  name: string;
  image_urls: string;
  thumbnail_index: number;
  video_url: string | null;
  active: number;
};

export type CachedExercise = {
  id: string;
  name: string;
  imageUrls: string[];
  thumbnailIndex: number;
  videoUrl: string | null;
  active: boolean;
};

const toExercise = (row: ExerciseRow): LibraryExercise => ({
  id: row.id,
  name: row.name,
  images: (JSON.parse(row.image_urls) as string[]).map(uri => ({ uri })),
  thumbnailIndex: row.thumbnail_index,
  videoUrl: row.video_url,
  active: row.active === 1,
});

export function cacheLibrary(exercises: CachedExercise[]) {
  transaction(() => {
    run('DELETE FROM exercises');
    for (const e of exercises) {
      run(
        `INSERT INTO exercises (id, name, image_urls, thumbnail_index, video_url, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [e.id, e.name, JSON.stringify(e.imageUrls), e.thumbnailIndex, e.videoUrl, e.active ? 1 : 0],
      );
    }
  });
}

/** Also returns inactive exercises, so lists that still contain them keep working. */
export function getLibraryExercise(id: string): LibraryExercise | null {
  const row = query<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', [id])[0];
  return row ? toExercise(row) : null;
}

export function getThumbnail(item: LibraryExercise): ImageSourcePropType | null {
  return item.images[item.thumbnailIndex] ?? item.images[0] ?? null;
}

/** Active exercises matching the search text, for "Add exercise". */
export function searchLibrary(text: string): LibraryExercise[] {
  const needle = `%${text.trim().toLowerCase()}%`;
  return query<ExerciseRow>(
    'SELECT * FROM exercises WHERE active = 1 AND lower(name) LIKE ? ORDER BY name COLLATE NOCASE',
    [needle],
  ).map(toExercise);
}
