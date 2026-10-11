import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { errorText, extensionOf, must, publicUrl, supabase, upload } from '../supabase';
import type { Exercise } from '../types';

const MAX_VIDEO_MB = 15;

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setExercises(must(await supabase.from('exercises').select('*').order('name')) as Exercise[]);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (editing) {
    return (
      <ExerciseForm
        exercise={editing === 'new' ? null : editing}
        existingIds={exercises.map(e => e.id)}
        onDone={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <>
      <div className="row">
        <h1>Exercise Library</h1>
        <span className="spacer" />
        <button onClick={() => setEditing('new')}>+ New exercise</button>
      </div>
      <p className="muted">
        Patients never browse this list. They (or you) search it when adding exercises to a list.
      </p>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th />
              <th>Name</th>
              <th>Images</th>
              <th>Video</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map(e => {
              const thumb = e.image_paths[e.thumbnail_index] ?? e.image_paths[0];
              return (
                <tr key={e.id} className="clickable" onClick={() => setEditing(e)}>
                  <td>
                    {thumb ? (
                      <img className="thumb" src={publicUrl('exercise-media', thumb)!} alt="" />
                    ) : (
                      <div className="thumb" />
                    )}
                  </td>
                  <td>
                    <strong>{e.name}</strong>
                    <div className="muted">{e.id}</div>
                  </td>
                  <td>{e.image_paths.length}</td>
                  <td>{e.video_path ? 'Yes' : <span className="muted">No</span>}</td>
                  <td>
                    {e.active ? (
                      <span className="badge green">Active</span>
                    ) : (
                      <span className="badge orange">Hidden</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ExerciseForm({
  exercise,
  existingIds,
  onDone,
}: {
  exercise: Exercise | null;
  existingIds: string[];
  onDone: () => void;
}) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [images, setImages] = useState<string[]>(exercise?.image_paths ?? []);
  const [thumbnail, setThumbnail] = useState(exercise?.thumbnail_index ?? 0);
  const [videoPath, setVideoPath] = useState(exercise?.video_path ?? null);
  const [active, setActive] = useState(exercise?.active ?? true);
  const [status, setStatus] = useState('');
  const id = exercise?.id ?? slug(name);

  const addImages = async (files: File[]) => {
    if (!id) {
      setStatus('Enter the name first.');
      return;
    }
    setStatus('Uploading images…');
    try {
      const stamp = Date.now();
      const paths: string[] = [];
      for (const [i, file] of files.entries()) {
        paths.push(await upload('exercise-media', `${id}/${stamp}-${i}.${extensionOf(file)}`, file));
      }
      setImages(current => [...current, ...paths]);
      setStatus('');
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  const setVideo = async (file: File | undefined) => {
    if (!file || !id) {
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setStatus(`The video is larger than ${MAX_VIDEO_MB} MB. Please use a short (5-second) clip.`);
      return;
    }
    setStatus('Uploading video…');
    try {
      setVideoPath(await upload('exercise-media', `${id}/video-${Date.now()}.${extensionOf(file)}`, file));
      setStatus('');
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !id) {
      setStatus('Enter a name.');
      return;
    }
    if (!exercise && existingIds.includes(id)) {
      setStatus('An exercise with this name already exists.');
      return;
    }
    const fields = {
      name: name.trim(),
      image_paths: images,
      thumbnail_index: Math.min(thumbnail, Math.max(images.length - 1, 0)),
      video_path: videoPath,
      active,
    };
    try {
      must(
        exercise
          ? await supabase.from('exercises').update(fields).eq('id', exercise.id)
          : await supabase.from('exercises').insert({ id, ...fields }),
      );
      onDone();
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  return (
    <form className="card" onSubmit={save}>
      <h1>{exercise ? exercise.name : 'New exercise'}</h1>
      <div className="grid2">
        <label>
          Name
          <input value={name} onChange={e => setName(e.target.value)} required />
        </label>
        <label>
          Id (used in patients' lists, cannot change)
          <input value={id} disabled />
        </label>
      </div>

      <h2 style={{ marginTop: 20 }}>Images</h2>
      <p className="muted">Click an image to make it the thumbnail shown in exercise lists.</p>
      <div className="media-grid">
        {images.map((path, i) => (
          <div key={path} className={`media-tile ${i === thumbnail ? 'selected' : ''}`}>
            <img src={publicUrl('exercise-media', path)!} alt="" onClick={() => setThumbnail(i)} />
            <button
              type="button"
              className="link"
              onClick={() => {
                setImages(current => current.filter(p => p !== path));
                if (thumbnail >= i && thumbnail > 0) {
                  setThumbnail(thumbnail - 1);
                }
              }}>
              Remove
            </button>
            {i === thumbnail && <span className="badge orange">Thumbnail</span>}
          </div>
        ))}
      </div>
      <label style={{ marginTop: 12 }}>
        Add images
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={e => addImages(Array.from(e.target.files ?? []))}
        />
      </label>

      <h2 style={{ marginTop: 20 }}>Video (about 5 seconds)</h2>
      {videoPath ? (
        <div className="row">
          <video
            src={publicUrl('exercise-media', videoPath)!}
            controls
            loop
            muted
            style={{ maxWidth: 320, borderRadius: 8 }}
          />
          <button type="button" className="link" onClick={() => setVideoPath(null)}>
            Remove video
          </button>
        </div>
      ) : (
        <p className="muted">No video yet.</p>
      )}
      <label>
        {videoPath ? 'Replace video' : 'Upload video'}
        <input type="file" accept="video/*" onChange={e => setVideo(e.target.files?.[0])} />
      </label>

      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 }}>
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
        Active (can be added to lists). Hidden exercises stay in lists that already have them.
      </label>

      {status && <div className="error">{status}</div>}
      <div className="row" style={{ marginTop: 16 }}>
        <button>Save exercise</button>
        <button type="button" className="secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
