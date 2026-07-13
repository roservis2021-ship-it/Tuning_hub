import { Timestamp, type DocumentData, type FirestoreDataConverter, type QueryDocumentSnapshot, type SnapshotOptions, type WithFieldValue } from 'firebase/firestore';

export interface RuntimeSchema<T> {
  parse(value: unknown): T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function encodeFirestoreValue(value: unknown): unknown {
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(encodeFirestoreValue);
  if (!isRecord(value)) return value;

  const encoded: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) encoded[key] = encodeFirestoreValue(child);
  }
  return encoded;
}

export function encodeFirestoreDocument(value: unknown): DocumentData {
  const encoded = encodeFirestoreValue(value);
  if (!isRecord(encoded)) throw new TypeError('A Firestore document must be an object');
  return encoded;
}

export function decodeFirestoreValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(decodeFirestoreValue);
  if (!isRecord(value)) return value;

  const decoded: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) decoded[key] = decodeFirestoreValue(child);
  return decoded;
}

export function createFirestoreConverter<T>(schema: RuntimeSchema<T>): FirestoreDataConverter<T> {
  return {
    toFirestore(modelObject: WithFieldValue<T>): DocumentData {
      return encodeFirestoreDocument(modelObject);
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
      const decoded = decodeFirestoreValue(snapshot.data(options));
      if (!isRecord(decoded)) throw new TypeError('A Firestore document must be an object');
      return schema.parse({ ...decoded, id: snapshot.id });
    },
  };
}
