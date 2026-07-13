import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { createFirestoreConverter, type RuntimeSchema } from '../firestore/firestoreCodec';

export interface PersistedEntity {
  id: string;
}

export interface FirestoreRepository<T extends PersistedEntity> {
  getById(entityId: string): Promise<T | null>;
  list(maxResults?: number): Promise<T[]>;
  listByOwner(ownerId: string, maxResults?: number): Promise<T[]>;
  getLatestByOwner(ownerId: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  remove(entityId: string): Promise<void>;
}

function assertSegment(value: string, label: string): void {
  if (value.trim().length === 0 || value.includes('/')) throw new TypeError(`${label} must be a non-empty Firestore id`);
}

function assertCollectionPath(path: string): void {
  const segments = path.split('/');
  if (segments.length % 2 === 0 || segments.some((segment) => segment.length === 0)) {
    throw new TypeError('Repository path must point to a Firestore collection');
  }
}

export function createFirestoreRepository<T extends PersistedEntity>(
  firestore: Firestore,
  collectionPath: string,
  schema: RuntimeSchema<T>,
): FirestoreRepository<T> {
  assertCollectionPath(collectionPath);
  const converter = createFirestoreConverter(schema);
  const typedCollection = collection(firestore, collectionPath).withConverter(converter);

  return {
    async getById(entityId) {
      assertSegment(entityId, 'Entity id');
      const snapshot = await getDoc(doc(typedCollection, entityId));
      return snapshot.exists() ? snapshot.data() : null;
    },
    async list(maxResults = 50) {
      const snapshot = await getDocs(query(typedCollection, limit(maxResults)));
      return snapshot.docs.map((document) => document.data());
    },
    async listByOwner(ownerId, maxResults = 50) {
      assertSegment(ownerId, 'Owner id');
      const snapshot = await getDocs(query(typedCollection, where('ownerId', '==', ownerId), limit(maxResults)));
      return snapshot.docs.map((document) => document.data());
    },
    async getLatestByOwner(ownerId) {
      assertSegment(ownerId, 'Owner id');
      const snapshot = await getDocs(query(typedCollection, where('ownerId', '==', ownerId), orderBy('updatedAt', 'desc'), limit(5)));
      return snapshot.docs.map((document) => document.data()).find((entity) => !('archivedAt' in entity) || entity.archivedAt === undefined) ?? null;
    },
    async save(entity) {
      assertSegment(entity.id, 'Entity id');
      const validated = schema.parse(entity);
      await setDoc(doc(typedCollection, validated.id), validated);
    },
    async remove(entityId) {
      assertSegment(entityId, 'Entity id');
      await deleteDoc(doc(typedCollection, entityId));
    },
  };
}
