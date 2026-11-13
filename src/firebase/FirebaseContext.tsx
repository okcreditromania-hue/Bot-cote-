import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseAuthUser } from 'firebase/auth';
import { auth, googleProvider } from './config';
import { isQuotaExceededError } from './errors';
import {
  ADMIN_EMAIL,
  ensureAdminDoc,
  pullClientSnapshotFromFirestore,
  pullFullSnapshotFromFirestore,
  pushFullSnapshotToFirestore,
  upsertUserToFirestore,
  upsertAviatorRoundToFirestore,
  type FullAppSnapshot,
} from './firestoreService';
import type { AviatorRoundHistoryItem, ClientOperation, User } from '../types';
import type { TransactionRecord } from '../types/saspay';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'quota_exceeded' | 'error';

interface FirebaseContextValue {
  firebaseUser: FirebaseAuthUser | null;
  isAuthReady: boolean;
  isFirebaseAdmin: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
  signInWithGooglePopup: () => Promise<FirebaseAuthUser | null>;
  signOutFirebase: () => Promise<void>;
  getFreshIdToken: () => Promise<string | null>;
  syncAdminBidirectional: () => Promise<FullAppSnapshot | null>;
  syncClientWithFirestore: (
    existingLocalUser?: User | null
  ) => Promise<{
    user: User | null;
    transactions: TransactionRecord[];
    operations: ClientOperation[];
  } | null>;
  syncSingleUserToFirestore: (user: User, isAdminActor?: boolean) => Promise<void>;
  syncRoundToFirestore: (round: AviatorRoundHistoryItem) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers.set('X-Firebase-Id-Token', token);
      }
    } catch {
      // ignore token fetch failures and proceed cleanly
    }
  }
  return fetch(input, { ...init, headers });
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isFirebaseAdmin = Boolean(
    firebaseUser && firebaseUser.email === ADMIN_EMAIL && firebaseUser.emailVerified
  );

  const getFreshIdToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

  const syncAdminBidirectional = useCallback(async (): Promise<FullAppSnapshot | null> => {
    const current = auth.currentUser;
    if (!current || current.email !== ADMIN_EMAIL || !current.emailVerified) {
      return null;
    }
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      await ensureAdminDoc(current);
      const firestoreSnapshot = await pullFullSnapshotFromFirestore();

      // 1. Restore any permanent Firestore data into server.ts memory (non-destructive)
      const importRes = await authFetch('/api/sync/import-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firestoreSnapshot),
      });

      let mergedSnapshot: FullAppSnapshot = firestoreSnapshot;
      if (importRes.ok) {
        const importData = await importRes.json();
        if (importData.snapshot) {
          mergedSnapshot = importData.snapshot;
        }
      } else {
        const exportRes = await authFetch('/api/sync/export-snapshot');
        if (exportRes.ok) {
          const exportData = await exportRes.json();
          if (exportData.snapshot) mergedSnapshot = exportData.snapshot;
        }
      }

      // 2. Push any existing server/local records (e.g. initial users & operations) to Firestore without deleting anything
      await pushFullSnapshotToFirestore(mergedSnapshot);

      setSyncStatus('synced');
      setLastSyncedAt(new Date().toISOString());
      return mergedSnapshot;
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setSyncStatus('quota_exceeded');
        setSyncError('Quota quotidien gratuit Firestore atteint. Réinitialisation demain.');
      } else {
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Erreur de synchronisation Firestore');
      }
      return null;
    }
  }, []);

  const syncClientWithFirestore = useCallback(
    async (
      existingLocalUser?: User | null
    ): Promise<{
      user: User | null;
      transactions: TransactionRecord[];
      operations: ClientOperation[];
    } | null> => {
      const current = auth.currentUser;
      if (!current || !current.emailVerified) return null;
      setSyncStatus('syncing');
      setSyncError(null);

      try {
        // Pull client data from Firestore by firebaseUid
        const cloud = await pullClientSnapshotFromFirestore(current.uid);

        if (cloud.user) {
          // Restore cloud user + history into server.ts so Aviator/SasPay stay consistent across devices
          const res = await authFetch('/api/sync/import-client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user: cloud.user,
              transactions: cloud.transactions,
              operations: cloud.operations,
            }),
          });
          let finalUser = cloud.user;
          if (res.ok) {
            const d = await res.json();
            if (d.user) finalUser = d.user;
          }
          setSyncStatus('synced');
          setLastSyncedAt(new Date().toISOString());
          return {
            user: finalUser,
            transactions: cloud.transactions,
            operations: cloud.operations,
          };
        }

        // First-time link: if existing phone+password session is open, bind firebaseUid cleanly
        if (existingLocalUser) {
          const linkRes = await authFetch('/api/users/link-firebase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: existingLocalUser.id,
              phone: existingLocalUser.phone,
              firebaseUid: current.uid,
              email: current.email || '',
            }),
          });
          const linkedUser: User =
            linkRes.ok ? ((await linkRes.json()).user || existingLocalUser) : existingLocalUser;

          // Ensure a client-owned /users/{uid} record exists for Firestore rule relational existence checks
          await upsertUserToFirestore(
            {
              ...linkedUser,
              id: current.uid,
              firebaseUid: current.uid,
              email: current.email || undefined,
            },
            { isAdminActor: false, overrideFirebaseUid: current.uid }
          );

          setSyncStatus('synced');
          setLastSyncedAt(new Date().toISOString());
          return { user: linkedUser, transactions: [], operations: [] };
        }

        // Brand-new Google client registration
        const newGoogleUser: User = {
          id: current.uid,
          firebaseUid: current.uid,
          email: current.email || undefined,
          fullName: current.displayName || 'Client VIP',
          phone: current.phoneNumber || `+229${Date.now().toString().slice(-8)}`,
          country: 'Bénin',
          bookmaker: '1xBet',
          vipTier: 'VIP1',
          paymentStatus: 'unpaid',
          balance: 0,
          registeredAt: new Date().toLocaleString('fr-FR'),
          notes: 'Compte créé via Google Firebase Auth',
        };

        await upsertUserToFirestore(newGoogleUser, {
          isAdminActor: false,
          overrideFirebaseUid: current.uid,
        });

        await authFetch('/api/sync/import-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: newGoogleUser, transactions: [], operations: [] }),
        });

        setSyncStatus('synced');
        setLastSyncedAt(new Date().toISOString());
        return { user: newGoogleUser, transactions: [], operations: [] };
      } catch (err) {
        if (isQuotaExceededError(err)) {
          setSyncStatus('quota_exceeded');
          setSyncError('Quota quotidien gratuit Firestore atteint.');
        } else {
          setSyncStatus('error');
          setSyncError(err instanceof Error ? err.message : 'Erreur de synchronisation client');
        }
        return null;
      }
    },
    []
  );

  const syncSingleUserToFirestore = useCallback(
    async (user: User, isAdminActor = false) => {
      if (!auth.currentUser) return;
      try {
        await upsertUserToFirestore(user, {
          isAdminActor,
          overrideFirebaseUid: user.firebaseUid || auth.currentUser.uid,
        });
        setLastSyncedAt(new Date().toISOString());
      } catch {
        // handled inside upsertUserToFirestore
      }
    },
    []
  );

  const syncRoundToFirestore = useCallback(async (round: AviatorRoundHistoryItem) => {
    if (
      !auth.currentUser ||
      auth.currentUser.email !== ADMIN_EMAIL ||
      !auth.currentUser.emailVerified
    ) {
      return;
    }
    try {
      await upsertAviatorRoundToFirestore(round);
    } catch {
      // ignore background error
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setIsAuthReady(true);
      if (fbUser && fbUser.email === ADMIN_EMAIL && fbUser.emailVerified) {
        syncAdminBidirectional().catch(() => {});
      }
    });
    return () => unsub();
  }, [syncAdminBidirectional]);

  const signInWithGooglePopup = useCallback(async (): Promise<FirebaseAuthUser | null> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return null;
      }
      throw err;
    }
  }, []);

  const signOutFirebase = useCallback(async () => {
    await signOut(auth);
    setSyncStatus('idle');
    setSyncError(null);
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        firebaseUser,
        isAuthReady,
        isFirebaseAdmin,
        syncStatus,
        lastSyncedAt,
        syncError,
        signInWithGooglePopup,
        signOutFirebase,
        getFreshIdToken,
        syncAdminBidirectional,
        syncClientWithFirestore,
        syncSingleUserToFirestore,
        syncRoundToFirestore,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
