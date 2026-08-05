import { signInAnonymously } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { getFirebaseClient } from "@/lib/firebase/client";
import type { ConfirmedTransaction } from "@/types/transaction";

import type { TransactionRepository } from "./repository";

export class FirebaseTransactionRepository implements TransactionRepository {
  readonly kind = "firebase" as const;
  private uid: string | null = null;

  private async userId(): Promise<string> {
    if (this.uid) {
      return this.uid;
    }

    const { auth } = getFirebaseClient();
    const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
    this.uid = credential.user.uid;
    return this.uid;
  }

  private async transactionsCollection() {
    const { db } = getFirebaseClient();
    const uid = await this.userId();
    return collection(db, "users", uid, "transactions");
  }

  async list(): Promise<ConfirmedTransaction[]> {
    const snapshot = await getDocs(await this.transactionsCollection());
    return snapshot.docs
      .map((item) => item.data() as ConfirmedTransaction)
      .sort((left, right) => {
        const dateOrder = right.occurredAt.localeCompare(left.occurredAt);
        return dateOrder !== 0 ? dateOrder : right.updatedAt.localeCompare(left.updatedAt);
      });
  }

  async save(transaction: ConfirmedTransaction): Promise<void> {
    const transactions = await this.transactionsCollection();
    const uid = await this.userId();
    await setDoc(doc(transactions, transaction.id), { ...transaction, userId: uid });
  }

  async remove(id: string): Promise<void> {
    const transactions = await this.transactionsCollection();
    await deleteDoc(doc(transactions, id));
  }

  async clear(): Promise<void> {
    const transactions = await this.transactionsCollection();
    const snapshot = await getDocs(transactions);
    const { db } = getFirebaseClient();
    const batch = writeBatch(db);
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}
