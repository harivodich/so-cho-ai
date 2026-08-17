import { collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from "firebase/firestore/lite";

import { getFirebaseClient } from "@/lib/firebase/client";
import type { Product, StockMovement } from "@/types/catalog";

import type { CatalogRepository } from "./repository";

export class FirebaseCatalogRepository implements CatalogRepository {
  readonly kind = "firebase" as const;

  private userId(): string {
    const uid = getFirebaseClient().auth.currentUser?.uid;
    if (!uid) throw new Error("SIGN_IN_REQUIRED");
    return uid;
  }

  private productsCollection() {
    return collection(getFirebaseClient().db, "users", this.userId(), "products");
  }

  private movementsCollection() {
    return collection(getFirebaseClient().db, "users", this.userId(), "stockMovements");
  }

  async listProducts(): Promise<Product[]> {
    const snapshot = await getDocs(this.productsCollection());
    return snapshot.docs.map((item) => item.data() as Product);
  }

  async saveProduct(product: Product): Promise<void> {
    const uid = this.userId();
    await setDoc(doc(this.productsCollection(), product.id), { ...product, userId: uid });
  }

  async listMovements(): Promise<StockMovement[]> {
    const snapshot = await getDocs(this.movementsCollection());
    return snapshot.docs.map((item) => item.data() as StockMovement);
  }

  async saveMovement(movement: StockMovement): Promise<void> {
    const uid = this.userId();
    await setDoc(doc(this.movementsCollection(), movement.id), { ...movement, userId: uid });
  }

  async removeMovement(id: string): Promise<void> {
    await deleteDoc(doc(this.movementsCollection(), id));
  }

  async clear(): Promise<void> {
    const products = this.productsCollection();
    const movements = this.movementsCollection();
    const [productSnapshot, movementSnapshot] = await Promise.all([getDocs(products), getDocs(movements)]);
    const batch = writeBatch(getFirebaseClient().db);
    productSnapshot.docs.forEach((item) => batch.delete(item.ref));
    movementSnapshot.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}