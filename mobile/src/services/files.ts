import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';

export type PickedFile = { uri: string; mimeType: string; name: string | null };

function extensionFor(name: string | null, mimeType: string) {
  const fromName = name?.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (fromName) {
    return fromName.toLowerCase();
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  return mimeType.split('/')[1] ?? 'bin';
}

/**
 * Lets the user pick a file and copies it into the app's private storage, so it keeps
 * working after the original is moved or deleted. Returns null if the user cancels.
 */
async function pickAndKeep(
  allowed: string[],
  prefix: string,
): Promise<PickedFile | null> {
  try {
    const [file] = await pick({ type: allowed });
    const mimeType = file.type ?? 'application/octet-stream';
    const fileName = `${prefix}-${Date.now()}.${extensionFor(file.name, mimeType)}`;
    const [copy] = await keepLocalCopy({
      files: [{ uri: file.uri, fileName }],
      destination: 'documentDirectory',
    });
    if (copy.status !== 'success') {
      throw new Error(copy.copyError);
    }
    return { uri: copy.localUri, mimeType, name: file.name };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw error;
  }
}

export function pickImage(prefix: string) {
  return pickAndKeep([types.images], prefix);
}

export function pickReportPdf() {
  return pickAndKeep([types.pdf], 'report');
}

/** Lets the user choose several photos at once; all are copied into app storage. */
export async function pickReportPhotos(): Promise<PickedFile[]> {
  try {
    const files = await pick({ type: [types.images], allowMultiSelection: true });
    const stamp = Date.now();
    const named = files.map((file, i) => {
      const mimeType = file.type ?? 'image/jpeg';
      return {
        file,
        mimeType,
        fileName: `report-${stamp}-${i}.${extensionFor(file.name, mimeType)}`,
      };
    });
    const copies = await keepLocalCopy({
      files: named.map(({ file, fileName }) => ({ uri: file.uri, fileName })) as [
        { uri: string; fileName: string },
        ...{ uri: string; fileName: string }[],
      ],
      destination: 'documentDirectory',
    });
    const bySource = new Map(named.map(entry => [entry.file.uri, entry]));
    const result: PickedFile[] = [];
    for (const copy of copies) {
      const entry = bySource.get(copy.sourceUri);
      if (copy.status === 'success' && entry) {
        result.push({ uri: copy.localUri, mimeType: entry.mimeType, name: entry.file.name });
      }
    }
    if (result.length === 0) {
      throw new Error('No photo could be copied');
    }
    return result;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      return [];
    }
    throw error;
  }
}

export const isImage = (mimeType: string) => mimeType.startsWith('image/');
