import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore/lite";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

type FirebaseClient = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let firebaseClient: FirebaseClient | null = null;

export function isFirebaseConfigured(config: Partial<FirebaseWebConfig>): config is FirebaseWebConfig {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function configureFirebaseClient(config: FirebaseWebConfig): FirebaseClient {
  if (firebaseClient) {
    return firebaseClient;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  // Anonymous sessions should survive reloads, but do not need Firebase Auth's
  // IndexedDB-backed default persistence. That storage closes while a tab is
  // hidden and can reject the initial sign-in in an embedded/mobile browser.
  const auth = initializeAuth(app, { persistence: browserLocalPersistence });
  firebaseClient = { app, auth, db: getFirestore(app) };
  return firebaseClient;
}

export function getFirebaseClient(): FirebaseClient {
  if (!firebaseClient) {
    throw new Error("Firebase chưa được khởi tạo.");
  }

  return firebaseClient;
}

export async function getFirebaseIdToken(): Promise<string> {
  const { auth } = getFirebaseClient();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Phiên Firebase chưa sẵn sàng. Hãy thử lại sau ít giây.");
  }

  return user.getIdToken();
}
