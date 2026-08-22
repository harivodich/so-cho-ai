"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { configureFirebaseClient, getFirebaseClient, isFirebaseConfigured, type FirebaseWebConfig } from "@/lib/firebase/client";
import { FirebaseCatalogRepository } from "@/lib/catalog/firebase-repository";
import { LocalCatalogRepository, type CatalogRepository } from "@/lib/catalog/repository";
import { clearOutboxForOwner, enqueueOutbox, listOutbox, listDueOutbox, recordOutboxFailure, removeOutbox } from "@/lib/offline/outbox";
import { canonicalizeItemName } from "@/types/transaction";
import type { ConfirmedTransaction } from "@/types/transaction";
import { buildTransactionStockMovement, transactionStockMovementId } from "@/lib/catalog/transaction-stock";
import type { Product, StockMovement } from "@/types/catalog";

type ConfigResponse = { configured: false } | { configured: true; firebase: FirebaseWebConfig };

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : prefix + "-" + Date.now();
}

function effectiveUserId(scope?: string | null): string {
  if (scope?.trim()) return scope.trim();
  try {
    return getFirebaseClient().auth.currentUser?.uid ?? "local-device";
  } catch {
    return "local-device";
  }
}

export function useCatalog(scope?: string | null) {
  const repositoryRef = useRef<CatalogRepository | null>(null);
  const fallbackRef = useRef<LocalCatalogRepository | null>(null);
  const deviceFallbackRef = useRef<LocalCatalogRepository | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [localCatalogCount, setLocalCatalogCount] = useState(0);
  const [persistence, setPersistence] = useState<"loading" | "local" | "firebase">("loading");
  const [error, setError] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(0);
  const outboxOwner = scope ?? "device";

  const reload = useCallback(async () => {
    const nextRepository = repositoryRef.current;
    if (!nextRepository) return;
    const [nextProducts, nextMovements] = await Promise.all([nextRepository.listProducts(), nextRepository.listMovements()]);
    setProducts(nextProducts);
    setMovements(nextMovements);
    setError(null);
  }, []);

  const syncOutbox = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository || repository.kind !== "firebase" || !window.navigator.onLine) return;
    const dueOps = [...listDueOutbox("products", outboxOwner), ...listDueOutbox("stockMovements", outboxOwner)];
    for (const operation of dueOps) {
      try {
        if (operation.domain === "products" && operation.action === "save") {
          await repository.saveProduct(operation.payload as Product);
        } else if (operation.domain === "stockMovements" && operation.action === "save") {
          await repository.saveMovement(operation.payload as StockMovement);
        } else if (operation.domain === "stockMovements" && operation.action === "remove") {
          await repository.removeMovement(operation.key.replace("stockMovements:", ""));
        }
        removeOutbox(operation.key, outboxOwner);
      } catch (err) {
        recordOutboxFailure(operation.key, err instanceof Error ? err.message : "SYNC_FAILED", outboxOwner);
        break;
      }
    }
    await reload();
    setSyncPending(listOutbox("products", outboxOwner).length + listOutbox("stockMovements", outboxOwner).length);
  }, [outboxOwner, reload]);

  useEffect(() => {
    let active = true;
    const local = new LocalCatalogRepository(scope);
    const deviceLocal = new LocalCatalogRepository();
    queueMicrotask(() => {
      if (!active) return;
      setProducts([]);
      setMovements([]);
      setError(null);
      setSyncPending(listOutbox("products", outboxOwner).length + listOutbox("stockMovements", outboxOwner).length);
      setPersistence('loading');
    });
    fallbackRef.current = local;
    deviceFallbackRef.current = deviceLocal;
    repositoryRef.current = local;
    const onOnline = () => { void initialize(); };
    window.addEventListener("online", onOnline);

    async function initialize() {
      try {
        const [localProducts, localMovements, deviceProducts, deviceMovements] = await Promise.all([
          local.listProducts(),
          local.listMovements(),
          deviceLocal.listProducts(),
          deviceLocal.listMovements(),
        ]);
        if (active) {
          setProducts(localProducts);
          setMovements(localMovements);
          setLocalCatalogCount(deviceProducts.length + deviceMovements.length);
          setPersistence("local");
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Không thể đọc danh mục.");
      }
      try {
        const response = await fetch("/api/firebase-config", { cache: "no-store" });
        const configuration = (await response.json()) as ConfigResponse;
        if (!configuration.configured || !isFirebaseConfigured(configuration.firebase)) return;
        const client = configureFirebaseClient(configuration.firebase);
        if (!client.auth.currentUser) return;
        const firebase = new FirebaseCatalogRepository();
        const [nextProducts, nextMovements] = await Promise.all([firebase.listProducts(), firebase.listMovements()]);
        if (!active) return;
        repositoryRef.current = firebase;
        setProducts(nextProducts);
        setMovements(nextMovements);
        setPersistence("firebase");
        await syncOutbox();
      } catch (reason) {
        if (active) setError(reason instanceof Error ? "Không thể đồng bộ danh mục: " + reason.message : "Không thể đồng bộ danh mục.");
      }
    }

    void initialize();
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
    };
  }, [outboxOwner, scope, syncOutbox]);

  const saveProduct = useCallback(async (input: { name: string; defaultUnit: string; lowStockThreshold: number; id?: string; userId?: string }): Promise<Product> => {
    const repository = repositoryRef.current;
    const fallback = fallbackRef.current;
    if (!repository || !fallback) throw new Error("Danh mục chưa sẵn sàng.");
    const name = input.name.trim();
    const canonicalName = canonicalizeItemName(name);
    if (!canonicalName || !input.defaultUnit.trim() || !Number.isFinite(input.lowStockThreshold) || input.lowStockThreshold < 0) {
      throw new Error("Tên, đơn vị và ngưỡng tồn phải hợp lệ.");
    }
    const now = new Date().toISOString();
    const existing = products.find((product) => product.canonicalName === canonicalName);
    const product: Product = {
      id: existing?.id ?? input.id ?? newId("product"),
      userId: effectiveUserId(scope),
      name,
      canonicalName,
      defaultUnit: input.defaultUnit.trim(),
      lowStockThreshold: Math.round(input.lowStockThreshold),
      active: true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await repository.saveProduct(product);
    } catch (reason) {
      if (repository.kind !== "firebase") throw reason;
      await fallback.saveProduct(product);
      enqueueOutbox({ key: "products:" + product.id, ownerId: outboxOwner, domain: "products", action: "save", payload: product });
      setSyncPending(listOutbox("products", outboxOwner).length + listOutbox("stockMovements", outboxOwner).length);
      setError("Đã lưu danh mục tạm; sẽ đồng bộ khi có mạng.");
    }
    setProducts((current) => [...current.filter((item) => item.id !== product.id), product]);
    return product;
  }, [outboxOwner, products, scope]);

  const persistMovement = useCallback(async (movement: StockMovement) => {
    const repository = repositoryRef.current;
    const fallback = fallbackRef.current;
    if (!repository || !fallback) throw new Error("Danh mục chưa sẵn sàng.");
    try {
      await repository.saveMovement(movement);
    } catch (reason) {
      if (repository.kind !== "firebase") throw reason;
      await fallback.saveMovement(movement);
      enqueueOutbox({ key: "stockMovements:" + movement.id, ownerId: outboxOwner, domain: "stockMovements", action: "save", payload: movement });
      setSyncPending(listOutbox("products", outboxOwner).length + listOutbox("stockMovements", outboxOwner).length);
      setError("Đã lưu điều chỉnh tồn tạm; sẽ đồng bộ khi có mạng.");
    }
    setMovements((current) => [...current.filter((item) => item.id !== movement.id), movement]);
  }, [outboxOwner]);

  const removeMovement = useCallback(async (id: string) => {
    const repository = repositoryRef.current;
    const fallback = fallbackRef.current;
    if (!repository || !fallback) throw new Error("Danh mục chưa sẵn sàng.");
    try {
      await repository.removeMovement(id);
    } catch (reason) {
      if (repository.kind !== "firebase") throw reason;
      await fallback.removeMovement(id);
      enqueueOutbox({ key: "stockMovements:" + id, ownerId: outboxOwner, domain: "stockMovements", action: "remove", payload: null });
      setSyncPending(listOutbox("products", outboxOwner).length + listOutbox("stockMovements", outboxOwner).length);
      setError("Đã xóa điều chỉnh tồn tạm; sẽ đồng bộ khi có mạng.");
    }
    setMovements((current) => current.filter((item) => item.id !== id));
  }, [outboxOwner]);

  const addAdjustment = useCallback(async (input: { product: Product; quantityDelta: number; reason: string; occurredAt: string }) => {
    if (!Number.isFinite(input.quantityDelta) || input.quantityDelta === 0 || !input.reason.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.occurredAt)) {
      throw new Error("Điều chỉnh tồn phải có số lượng khác 0, lý do và ngày hợp lệ.");
    }
    const movement: StockMovement = {
      id: newId("movement"),
      userId: input.product.userId,
      productId: input.product.id,
      itemName: input.product.name,
      canonicalItemName: input.product.canonicalName,
      unit: input.product.defaultUnit,
      kind: "adjustment",
      quantityDelta: input.quantityDelta,
      reason: input.reason.trim(),
      sourceTransactionId: null,
      occurredAt: input.occurredAt,
      createdAt: new Date().toISOString(),
    };
    await persistMovement(movement);
  }, [persistMovement]);

  const syncTransaction = useCallback(async (transaction: ConfirmedTransaction) => {
    const related = movements.filter((item) => item.sourceTransactionId === transaction.id);
    const removeRelated = async () => {
      for (const item of related) await removeMovement(item.id);
    };
    if ((transaction.type !== "sale" && transaction.type !== "purchase") || transaction.quantity === null || transaction.quantity <= 0 || !transaction.itemName || !transaction.unit) {
      await removeRelated();
      return;
    }
    const canonicalName = canonicalizeItemName(transaction.canonicalItemName ?? transaction.itemName);
    if (!canonicalName) {
      await removeRelated();
      return;
    }
    let availableProducts = products;
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Danh mục chưa sẵn sàng.");
    if (!availableProducts.some((item) => item.canonicalName === canonicalName)) {
      try {
        availableProducts = await repository.listProducts();
      } catch {
        availableProducts = (await fallbackRef.current?.listProducts()) ?? availableProducts;
      }
      setProducts(availableProducts);
    }
    let product = availableProducts.find((item) => item.canonicalName === canonicalName);
    if (!product) {
      product = await saveProduct({ name: transaction.itemName, defaultUnit: transaction.unit, lowStockThreshold: 0, userId: transaction.userId });
    } else if (product.defaultUnit.trim().toLowerCase() !== transaction.unit.trim().toLowerCase()) {
      await removeRelated();
      setError(`Không cập nhật tồn cho ${product.name}: đơn vị giao dịch (${transaction.unit}) khác đơn vị danh mục (${product.defaultUnit}).`);
      return;
    }
    const movementId = transactionStockMovementId(transaction.id);
    for (const item of related.filter((item) => item.id !== movementId)) await removeMovement(item.id);
    const movement = buildTransactionStockMovement(transaction, product);
    if (!movement) {
      await removeRelated();
      setError(`Không cập nhật tồn cho ${product.name}: đơn vị giao dịch không khớp đơn vị danh mục.`);
      return;
    }
    await persistMovement(movement);
  }, [movements, persistMovement, products, removeMovement, saveProduct]);

  const removeTransaction = useCallback(async (transactionId: string) => {
    const related = movements.filter((item) => item.sourceTransactionId === transactionId);
    for (const item of related) await removeMovement(item.id);
  }, [movements, removeMovement]);

  const clearLocal = useCallback(async () => {
    await fallbackRef.current?.clear();
    clearOutboxForOwner(outboxOwner, "products");
    clearOutboxForOwner(outboxOwner, "stockMovements");
    setSyncPending(0);
    setProducts([]);
    setMovements([]);
  }, [outboxOwner]);
  const clearLocalForOwner = useCallback(async (ownerId: string) => {
    const normalizedOwner = ownerId.trim();
    if (!normalizedOwner) return;
    await new LocalCatalogRepository(normalizedOwner).clear();
    clearOutboxForOwner(normalizedOwner, "products");
    clearOutboxForOwner(normalizedOwner, "stockMovements");
    if (normalizedOwner === outboxOwner) {
      setSyncPending(0);
      setProducts([]);
      setMovements([]);
    }
  }, [outboxOwner]);

  const clear = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Danh mục chưa sẵn sàng.");
    await repository.clear();
    await fallbackRef.current?.clear();
    clearOutboxForOwner(outboxOwner, "products");
    clearOutboxForOwner(outboxOwner, "stockMovements");
    setSyncPending(0);
    setProducts([]);
    setMovements([]);
  }, [outboxOwner]);

  const importLocalCatalog = useCallback(async () => {
    const repository = repositoryRef.current;
    const deviceLocal = deviceFallbackRef.current;
    if (!repository || !deviceLocal || repository.kind !== "firebase") {
      throw new Error("Hãy đăng nhập tài khoản thật trước khi nhập danh mục trên thiết bị.");
    }
    const [deviceProducts, deviceMovements] = await Promise.all([deviceLocal.listProducts(), deviceLocal.listMovements()]);
    for (const product of deviceProducts) await repository.saveProduct(product);
    for (const movement of deviceMovements) await repository.saveMovement(movement);
    await deviceLocal.clear();
    for (const product of deviceProducts) removeOutbox("products:" + product.id, "device");
    for (const movement of deviceMovements) removeOutbox("stockMovements:" + movement.id, "device");
    setLocalCatalogCount(0);
    setSyncPending(listOutbox("products", outboxOwner).length + listOutbox("stockMovements", outboxOwner).length);
    await reload();
  }, [outboxOwner, reload]);

  return { syncPending, addAdjustment, clear, clearLocal, clearLocalForOwner, error, importLocalCatalog, localCatalogCount, movements, persistence, products, reload, removeTransaction, saveProduct, syncTransaction };
}
