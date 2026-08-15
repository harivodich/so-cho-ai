import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
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
  firebaseClient = { app, auth: getAuth(app), db: getFirestore(app) };
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
