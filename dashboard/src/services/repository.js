import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export async function listRecords(resourceKey, max = 500) {
  const snapshot = await getDocs(query(collection(db, resourceKey), orderBy('updatedAt', 'desc'), limit(max)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveRecord(resourceKey, record, userEmail) {
  const recordRef = record.id ? doc(db, resourceKey, record.id) : doc(collection(db, resourceKey));
  const previous = record.id ? { ...record } : null;
  const payload = {
    ...record,
    id: recordRef.id,
    searchText: Object.values(record).filter((value) => typeof value === 'string').join(' ').toLowerCase(),
    updatedAt: serverTimestamp(),
    updatedBy: userEmail,
    ...(record.id ? {} : { createdAt: serverTimestamp(), createdBy: userEmail }),
  };
  await setDoc(recordRef, payload, { merge: true });
  await addDoc(collection(db, 'auditLog'), {
    resource: resourceKey,
    recordId: recordRef.id,
    action: record.id ? 'update' : 'create',
    user: userEmail,
    previous,
    next: payload,
    createdAt: serverTimestamp(),
  });
  return { ...record, id: recordRef.id };
}

export async function removeRecord(resourceKey, record, userEmail) {
  await deleteDoc(doc(db, resourceKey, record.id));
  await addDoc(collection(db, 'auditLog'), {
    resource: resourceKey,
    recordId: record.id,
    action: 'delete',
    user: userEmail,
    previous: record,
    createdAt: serverTimestamp(),
  });
}

export async function loadDashboardStats() {
  const keys = ['brands', 'models', 'generations', 'vehicles', 'engines', 'images', 'rules'];
  const entries = await Promise.all(keys.map(async (key) => {
    const snapshot = await getCountFromServer(collection(db, key));
    return [key, snapshot.data().count];
  }));
  const vehicleSnapshot = await getDocs(query(collection(db, 'vehicles'), limit(500)));
  const vehicles = vehicleSnapshot.docs.map((item) => item.data());
  return {
    ...Object.fromEntries(entries),
    verified: vehicles.filter((item) => item.status === 'verified' || item.status === 'published').length,
    pending: vehicles.filter((item) => item.status === 'draft' || item.status === 'needs_verification').length,
  };
}

export async function loadRecentActivity() {
  const snapshot = await getDocs(query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(12)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
