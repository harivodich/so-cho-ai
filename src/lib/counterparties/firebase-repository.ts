import { collection, doc, getDocs, setDoc, writeBatch } from "firebase/firestore/lite";

import { getFirebaseClient } from "@/lib/firebase/client";
import type { Counterparty } from "@/types/counterparty";

import type { CounterpartyRepository } from "./repository";

export class FirebaseCounterpartyRepository implements CounterpartyRepository {
  readonly kind = "firebase" as const;

  private collectionRef() {
    const uid = getFirebaseClient().auth.currentUser?.uid;
    if (!uid) throw new Error("SIGN_IN_REQUIRED");
    return collection(getFirebaseClient().db, "users", uid, "counterparties");
  }

  async list(): Promise<Counterparty[]> {
    const snapshot = await getDocs(this.collectionRef());
    return snapshot.docs.map((item) => item.data() as Counterparty).sort((left, right) => left.name.localeCompare(right.name));
  }

  async save(counterparty: Counterparty): Promise<void> {
    const uid = getFirebaseClient().auth.currentUser?.uid;
    if (!uid) throw new Error("SIGN_IN_REQUIRED");
    await setDoc(doc(this.collectionRef(), counterparty.id), { ...counterparty, userId: uid });
  }

  async clear(): Promise<void> {
    const collectionRef = this.collectionRef();
    const snapshot = await getDocs(collectionRef);
    const db = getFirebaseClient().db;
    const docs = snapshot.docs;
    const CHUNK_SIZE = 450;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  }
}