const DB_NAME = "documentAssetStore";
const STORE_NAME = "assets";
const DB_VERSION = 1;

export interface StoredAssetMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  updatedAt: number;
}

interface StoredAssetRecord extends StoredAssetMetadata {
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const getIndexedDB = (): IDBFactory => {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not supported in this environment.");
  }
  return indexedDB;
};

const generateId = (): string => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (error) {
    console.warn("randomUUID unavailable, falling back to timestamp-based id.", error);
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const openDatabase = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = getIndexedDB().open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
};

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> => {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    Promise.resolve()
      .then(() => executor(store))
      .then((result) => {
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
        tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
      })
      .catch((error) => {
        tx.abort();
        reject(error);
      });
  });
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [meta, data] = dataUrl.split(",");
  const mimeMatch = /data:(.*?)(;base64)?$/i.exec(meta);
  const mime = mimeMatch?.[1] || "application/octet-stream";
  const binary = atob(data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

const resolveDeferred = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const saveAsset = async (
  file: Blob,
  options: {
    id?: string;
    name?: string;
    type?: string;
    createdAt?: number;
    updatedAt?: number;
  } = {}
): Promise<StoredAssetMetadata> => {
  const id = options.id ?? generateId();
  const now = Date.now();

  return runTransaction("readwrite", async (store) => {
    const existing = options.id
      ? ((await resolveDeferred(store.get(id))) as StoredAssetRecord | undefined)
      : undefined;

    const createdAt = options.createdAt ?? existing?.createdAt ?? now;
    const updatedAt = options.updatedAt ?? now;

    const record: StoredAssetRecord = {
      id,
      name: options.name || ("name" in file ? (file as File).name : "asset"),
      type: options.type || file.type || "application/octet-stream",
      size: file.size,
      createdAt,
      updatedAt,
      blob: file,
    };

    await resolveDeferred(store.put(record));

    return {
      id: record.id,
      name: record.name,
      type: record.type,
      size: record.size,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  });
};

export const saveAssetFromDataUrl = async (
  dataUrl: string,
  options: {
    id?: string;
    name?: string;
    type?: string;
    createdAt?: number;
    updatedAt?: number;
  } = {}
): Promise<StoredAssetMetadata> => {
  const blob = dataUrlToBlob(dataUrl);
  return saveAsset(blob, {
    ...options,
    type: options.type || blob.type,
  });
};

export const getAsset = async (id: string): Promise<StoredAssetRecord | null> =>
  runTransaction("readonly", async (store) => {
    const result = (await resolveDeferred(store.get(id))) as StoredAssetRecord | undefined;
    return result ?? null;
  });

export const getAssetDataUrl = async (
  id: string
): Promise<{
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  dataUrl: string;
} | null> => {
  const asset = await getAsset(id);
  if (!asset) return null;
  const dataUrl = await blobToDataUrl(asset.blob);
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    size: asset.size,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    dataUrl,
  };
};

export const getAssetObjectUrl = async (
  id: string
): Promise<{ id: string; name: string; type: string; url: string } | null> => {
  const asset = await getAsset(id);
  if (!asset) return null;
  const url = URL.createObjectURL(asset.blob);
  return { id: asset.id, name: asset.name, type: asset.type, url };
};

export const deleteAsset = async (id: string): Promise<void> =>
  runTransaction("readwrite", async (store) => {
    await resolveDeferred(store.delete(id));
  });

export const listAllAssets = async (): Promise<StoredAssetMetadata[]> =>
  runTransaction("readonly", async (store) => {
    const request = store.getAll();
    const results = (await resolveDeferred(request)) as StoredAssetRecord[];
    return results.map(({ blob: _blob, ...meta }) => meta);
  });

export const getAssetsByIds = async (
  ids: string[]
): Promise<Record<string, StoredAssetRecord | null>> => {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const asset = await getAsset(id);
      return [id, asset ?? null] as const;
    })
  );
  return Object.fromEntries(entries);
};

export const clearAllAssets = async (): Promise<void> =>
  runTransaction("readwrite", async (store) => {
    await resolveDeferred(store.clear());
  });


