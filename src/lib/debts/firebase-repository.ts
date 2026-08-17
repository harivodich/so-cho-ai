import { collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from "firebase/firestore/lite";

import { getFirebaseClient } from "@/lib/firebase/client";
import type { DebtEntry } from "@/types/debt";

import type { DebtRepository } from "./repository";

export class FirebaseDebtRepository implements DebtRepository {
  readonly kind = "firebase" as const;

  private entriesCollection() {
    const uid = getFirebaseClient().auth.currentUser?.uid;
    if (!uid) throw new Error("SIGN_IN_REQUIRED");
    return collection(getFirebaseClient().db, "users", uid, "debts");
  }

  async list(): Promise<DebtEntry[]> {
    const snapshot = await getDocs(this.entriesCollection());
    return snapshot.docs.map((item) => item.data() as DebtEntry).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async save(entry: DebtEntry): Promise<void> {
    const uid = getFirebaseClient().auth.currentUser?.uid;
    if (!uid) throw new Error("SIGN_IN_REQUIRED");
    await setDoc(doc(this.entriesCollection(), entry.id), { ...entry, userId: uid });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.entriesCollection(), id));
  }

  async clear(): Promise<void> {
    const entries = this.entriesCollection();
    const snapshot = await getDocs(entries);
    const batch = writeBatch(getFirebaseClient().db);
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}