import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  onSnapshot,
  GeoPoint,
} from 'firebase/firestore';
import { db } from './config';

// === USER OPERATIONS ===

export const getUserProfile = async (uid) => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};

export const updateUserProfile = async (uid, data) => {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const subscribeToUserProfile = (uid, callback) => {
  const docRef = doc(db, 'users', uid);
  return onSnapshot(docRef, (doc) => {
    callback(doc.exists() ? doc.data() : null);
  });
};

// === SCAN OPERATIONS ===

export const saveScan = async (uid, scanData) => {
  const scansRef = collection(db, 'users', uid, 'scans');
  const newScanRef = doc(scansRef);
  
  await setDoc(newScanRef, {
    ...scanData,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  });
  
  return newScanRef.id;
};

export const getScans = async (uid, limitCount = 100) => {
  const scansRef = collection(db, 'users', uid, 'scans');
  const q = query(scansRef, orderBy('createdAt', 'desc'), limit(limitCount));
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
};

export const subscribeToScans = (uid, callback, limitCount = 100) => {
  const scansRef = collection(db, 'users', uid, 'scans');
  const q = query(scansRef, orderBy('createdAt', 'desc'), limit(limitCount));
  
  return onSnapshot(q, (querySnapshot) => {
    const scans = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(scans);
  });
};

export const getScan = async (uid, scanId) => {
  const scanRef = doc(db, 'users', uid, 'scans', scanId);
  const scanSnap = await getDoc(scanRef);
  
  return scanSnap.exists() ? { id: scanSnap.id, ...scanSnap.data() } : null;
};

export const deleteScan = async (uid, scanId) => {
  await deleteDoc(doc(db, 'users', uid, 'scans', scanId));
};

// Helper to create GeoPoint
export const createGeoPoint = (lat, lng) => {
  return new GeoPoint(lat, lng);
};