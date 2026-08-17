import type { Product, StockMovement } from "@/types/catalog";
import { scopedStorageKey } from "@/lib/storage-scope";

export type CatalogRepository = {
  kind: "local" | "firebase";
  listProducts(): Promise<Product[]>;
  saveProduct(product: Product): Promise<void>;
  listMovements(): Promise<StockMovement[]>;
  saveMovement(movement: StockMovement): Promise<void>;
  removeMovement(id: string): Promise<void>;
  clear(): Promise<void>;
};

const PRODUCTS_KEY = "so-cho-ai.products.v1";
const MOVEMENTS_KEY = "so-cho-ai.stock-movements.v1";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

export class LocalCatalogRepository implements CatalogRepository {
  private readonly productsKey: string;
  private readonly movementsKey: string;

  constructor(scope?: string | null) {
    this.productsKey = scopedStorageKey(PRODUCTS_KEY, scope);
    this.movementsKey = scopedStorageKey(MOVEMENTS_KEY, scope);
  }
  readonly kind = "local" as const;

  async listProducts(): Promise<Product[]> { return read<Product>(this.productsKey); }
  async saveProduct(product: Product): Promise<void> {
    const current = read<Product>(this.productsKey);
    const next = [...current.filter((item) => item.id !== product.id), product];
    window.localStorage.setItem(this.productsKey, JSON.stringify(next));
  }
  async listMovements(): Promise<StockMovement[]> { return read<StockMovement>(this.movementsKey); }
  async saveMovement(movement: StockMovement): Promise<void> {
    const current = read<StockMovement>(this.movementsKey);
    window.localStorage.setItem(this.movementsKey, JSON.stringify([...current.filter((item) => item.id !== movement.id), movement]));
  }
  async removeMovement(id: string): Promise<void> {
    const current = read<StockMovement>(this.movementsKey);
    window.localStorage.setItem(this.movementsKey, JSON.stringify(current.filter((item) => item.id !== id)));
  }

  async clear(): Promise<void> {
    window.localStorage.removeItem(this.productsKey);
    window.localStorage.removeItem(this.movementsKey);
  }
}
