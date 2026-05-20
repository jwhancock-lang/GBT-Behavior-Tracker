import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import devConfig from "../../firebase-applet-config.json";

// ==========================================
// PRODUCTION CONFIGURATION (gbt-behavior-tracker)
// ==========================================
// TODO: Replace these placeholders with your actual Web App credentials
// which you can find in your Firebase Console under Settings > Project Settings > General > Your apps.
const prodConfig = {
  apiKey: "AIzaSy..." , // Replace with your production API key
  authDomain: "gbt-behavior-tracker.firebaseapp.com",
  projectId: "gbt-behavior-tracker",
  storageBucket: "gbt-behavior-tracker.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace with your production Messaging Sender ID
  appId: "YOUR_APP_ID", // Replace with your production App ID
  firestoreDatabaseId: "(default)"
};

// Auto-detect environment based on the domain name in the browser
const isProduction =
  window.location.hostname.includes("gbt-behavior-tracker") ||
  window.location.hostname.endsWith(".web.app") ||
  window.location.hostname.endsWith(".firebaseapp.com");

const currentConfig = isProduction ? prodConfig : devConfig;

export const app = initializeApp(currentConfig);
export const auth = getAuth(app);
export const db = currentConfig.firestoreDatabaseId && currentConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(app, currentConfig.firestoreDatabaseId)
  : getFirestore(app);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
