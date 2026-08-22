import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore/lite";

import { getFirebaseClient } from "@/lib/firebase/client";
import type { ConfirmedTransaction } from "@/types/transaction";

import type { TransactionRepository } from "./repository";

export class FirebaseTransactionRepository implements TransactionRepository {
  readonly kind = "firebase" as const;

  private userId(): string {
    const uid = getFirebaseClient().auth.currentUser?.uid;
    if (!uid) throw new Error("SIGN_IN_REQUIRED");
    return uid;
  }

  private transactionsCollection() {
    const { db } = getFirebaseClient();
    return collection(db, "users", this.userId(), "transactions");
  }

  async list(): Promise<ConfirmedTransaction[]> {
    const snapshot = await getDocs(this.transactionsCollection());
    return snapshot.docs
      .map((item) => item.data() as ConfirmedTransaction)
      .sort((left, right) => {
        const dateOrder = right.occurredAt.localeCompare(left.occurredAt);
        return dateOrder !== 0 ? dateOrder : right.updatedAt.localeCompare(left.updatedAt);
      });
  }

  async save(transaction: ConfirmedTransaction): Promise<void> {
    const uid = this.userId();
    await setDoc(doc(this.transactionsCollection(), transaction.id), { ...transaction, userId: uid });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.transactionsCollection(), id));
  }

  async clear(): Promise<void> {
    const transactions = this.transactionsCollection();
    const snapshot = await getDocs(transactions);
    const { db } = getFirebaseClient();
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