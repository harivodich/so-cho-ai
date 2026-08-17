import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  initializeAuth,
  linkWithCredential,
  linkWithRedirect,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc, type Firestore } from "firebase/firestore/lite";

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
  if (firebaseClient) return firebaseClient;

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const auth = initializeAuth(app, {
    persistence: browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  firebaseClient = { app, auth, db: getFirestore(app) };
  return firebaseClient;
}

export function getFirebaseClient(): FirebaseClient {
  if (!firebaseClient) throw new Error("Firebase chưa được khởi tạo.");
  return firebaseClient;
}

export async function saveFirebaseUserProfile(user: User): Promise<void> {
  const { db } = getFirebaseClient();
  const profileRef = doc(db, "users", user.uid, "profile", "main");
  const settingsRef = doc(db, "users", user.uid, "settings", "default");
  const [existingProfile, existingSettings] = await Promise.all([getDoc(profileRef), getDoc(settingsRef)]);
  const existingCreatedAt = existingProfile.data()?.createdAt;
  const settings = existingSettings.data() ?? {};
  const createdAt = typeof existingCreatedAt === "string" ? existingCreatedAt : new Date().toISOString();
  const updatedAt = new Date().toISOString();
  await setDoc(profileRef, {
    uid: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    providerIds: user.providerData.map((provider) => provider.providerId),
    createdAt,
    updatedAt,
  }, { merge: true });
  await setDoc(settingsRef, {
    uid: user.uid,
    currency: typeof settings.currency === "string" ? settings.currency : "VND",
    defaultUnit: typeof settings.defaultUnit === "string" ? settings.defaultUnit : "kg",
    lowStockAlertsEnabled: typeof settings.lowStockAlertsEnabled === "boolean" ? settings.lowStockAlertsEnabled : true,
    updatedAt,
  }, { merge: true });
}

export async function getFirebaseIdToken(): Promise<string> {
  const { auth } = getFirebaseClient();
  const user = auth.currentUser;
  if (!user) throw new Error("Phiên Firebase chưa sẵn sàng. Hãy thử lại sau ít giây.");
  return user.getIdToken();
}

export function subscribeFirebaseAuth(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(getFirebaseClient().auth, callback);
}

export async function consumeFirebaseRedirectResult(): Promise<void> {
  await getRedirectResult(getFirebaseClient().auth);
}

export async function signInWithGoogleAccount(): Promise<void> {
  const { auth } = getFirebaseClient();
  const provider = new GoogleAuthProvider();
  if (auth.currentUser?.isAnonymous) {
    await linkWithRedirect(auth.currentUser, provider);
    return;
  }
  await signInWithRedirect(auth, provider);
}

export async function signInWithExistingGoogleAccount(): Promise<void> {
  const { auth } = getFirebaseClient();
  await signInWithRedirect(auth, new GoogleAuthProvider());
}
export async function signInOrLinkEmailAccount(email: string, password: string, create: boolean): Promise<void> {
  const { auth } = getFirebaseClient();
  const credential = EmailAuthProvider.credential(email.trim(), password);
  if (auth.currentUser?.isAnonymous && create) {
    await linkWithCredential(auth.currentUser, credential);
    return;
  }
  if (create) {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
    return;
  }
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function verifyFirebaseEmail(): Promise<void> {
  const user = getFirebaseClient().auth.currentUser;
  if (!user || user.isAnonymous) throw new Error("Hãy đăng nhập tài khoản thật trước.");
  await sendEmailVerification(user);
}

export async function sendFirebasePasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseClient().auth, email.trim());
}

export async function signOutFirebase(): Promise<void> {
  await signOut(getFirebaseClient().auth);
}

export async function deleteFirebaseUser(): Promise<void> {
  const { auth } = getFirebaseClient();
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa có phiên đăng nhập.");

  const token = await user.getIdToken();
  const response = await fetch("/api/account/delete", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
  });
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "Chưa thể xóa tài khoản. Hãy thử lại.");
  }
  await signOut(auth);
}
