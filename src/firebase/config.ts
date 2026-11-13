import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_CONFIG = firebaseConfig;

// Validate connection to Firestore on boot
export async function testFirestoreConnection(): Promise<'ok' | 'offline'> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return 'ok';
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return 'offline';
    }
    // permission-denied on closed test path proves server connection succeeded
    return 'ok';
  }
}

testFirestoreConnection();
