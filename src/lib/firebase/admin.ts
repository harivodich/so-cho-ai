import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { readFirebaseAdminServiceAccount } from "./admin-credentials";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = readFirebaseAdminServiceAccount();
  const projectId = serviceAccount?.projectId
    ?? process.env.GOOGLE_CLOUD_PROJECT
    ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    projectId,
  });
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getFirebaseAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
