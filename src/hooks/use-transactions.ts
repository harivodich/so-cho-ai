"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  configureFirebaseClient,
  getFirebaseIdToken,
  isFirebaseConfigured,
  type FirebaseWebConfig,
} from "@/lib/firebase/client";
import {
  clearOutboxForOwner,
  listOutbox,
  listDueOutbox,
  recordOutboxFailure,
  enqueueOutbox,
  removeOutbox,
} from "@/lib/offline/outbox";
import { FirebaseTransactionRepository } from "@/lib/transactions/firebase-repository";
import { LocalTransactionRepository, type TransactionRepository } from "@/lib/transactions/repository";
import type { ConfirmedTransaction } from "@/types/transaction";

type PersistenceKind = "loading" | "local" | "firebase";
type FirebaseConfigResponse =
  | { configured: false }
  | { configured: true; firebase: FirebaseWebConfig };

function sortTransactions(transactions: ConfirmedTransaction[]): ConfirmedTransaction[] {
  return [...transactions].sort((left, right) => {
    const dateOrder = right.occurredAt.localeCompare(left.occurredAt);
    return dateOrder !== 0 ? dateOrder : right.updatedAt.localeCompare(left.updatedAt);
  });
}

async function selectRepository(): Promise<TransactionRepository> {
  const response = await fetch("/api/firebase-config", { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể kiểm tra cấu hình lưu trữ.");

  const configuration = (await response.json()) as FirebaseConfigResponse;
  if (!configuration.configured || !isFirebaseConfigured(configuration.firebase)) {
    return new LocalTransactionRepository();
  }

  const client = configureFirebaseClient(configuration.firebase);
  if (!client.auth.currentUser) return new LocalTransactionRepository();
  return new FirebaseTransactionRepository();
}

async function withTimeout<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Firebase phản hồi quá lâu.")), milliseconds);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function useTransactions(scope?: string | null) {
  const repositoryRef = useRef<TransactionRepository | null>(null);
  const fallbackRef = useRef<LocalTransactionRepository | null>(null);
  const deviceFallbackRef = useRef<LocalTransactionRepository | null>(null);
  const [transactions, setTransactions] = useState<ConfirmedTransaction[]>([]);
  const [localTransactionCount, setLocalTransactionCount] = useState(0);
  const [syncPending, setSyncPending] = useState(0);
  const [persistence, setPersistence] = useState<PersistenceKind>("loading");
  const [error, setError] = useState<string | null>(null);
  const outboxOwner = scope ?? "device";

  const syncOutbox = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository || repository.kind !== "firebase" || !window.navigator.onLine) return;
    let changed = false;
    for (const operation of listDueOutbox("transactions", outboxOwner)) {
      try {
        if (operation.action === "save") {
          await repository.save(operation.payload as ConfirmedTransaction);
        } else {
          await repository.remove(operation.key.replace("transactions:", ""));
        }
        removeOutbox(operation.key, outboxOwner);
        changed = true;
      } catch (err) {
        recordOutboxFailure(operation.key, err instanceof Error ? err.message : "SYNC_FAILED", outboxOwner);
        break;
      }
    }
    setSyncPending(listOutbox("transactions", outboxOwner).length);
    if (changed) {
      try {
        setTransactions(sortTransactions(await repository.list()));
      } catch {
        // Keep the local snapshot until the next online retry if refresh fails.
      }
    }
  }, [outboxOwner]);

  useEffect(() => {
    let active = true;
    const fallbackRepository = new LocalTransactionRepository(scope);
    const deviceFallbackRepository = new LocalTransactionRepository();
    queueMicrotask(() => {
      if (!active) return;
      setTransactions([]);
      setLocalTransactionCount(0);
      setSyncPending(listOutbox("transactions", outboxOwner).length);
      setError(null);
      setPersistence("loading");
    });
    fallbackRef.current = fallbackRepository;
    deviceFallbackRef.current = deviceFallbackRepository;
    repositoryRef.current = fallbackRepository;

    const onOnline = () => { void initialize(); };
    window.addEventListener("online", onOnline);

    async function initialize() {
      try {
        const [localItems, deviceItems] = await Promise.all([fallbackRepository.list(), deviceFallbackRepository.list()]);
        if (active) {
          setTransactions(sortTransactions(localItems));
          setLocalTransactionCount(deviceItems.length);
          setPersistence("local");
        }
      } catch {
        if (active) {
          setTransactions([]);
          setPersistence("local");
        }
      }

      try {
        const repository = await withTimeout(selectRepository(), 3_000);
        if (repository.kind === "local") return;

        const items = await withTimeout(repository.list(), 5_000);
        if (!active) return;
        repositoryRef.current = repository;
        setTransactions(sortTransactions(items));
        setError(null);
        setPersistence("firebase");
        await syncOutbox();
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? "Không thể kết nối Firebase: " + reason.message : "Không thể kết nối Firebase.");
      }
    }

    void initialize();
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
    };
  }, [outboxOwner, scope, syncOutbox]);

  const reload = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    const items = await repository.list();
    setTransactions(sortTransactions(items));
    setError(null);
  }, []);

  const refreshDeviceLocalCount = useCallback(async () => {
    const deviceRepository = deviceFallbackRef.current;
    if (!deviceRepository) return;
    setLocalTransactionCount((await deviceRepository.list()).length);
  }, []);

  const save = useCallback(async (transaction: ConfirmedTransaction) => {
    const repository = repositoryRef.current;
    const fallbackRepository = fallbackRef.current;
    if (!repository || !fallbackRepository) throw new Error("Kho dữ liệu chưa sẵn sàng.");
    let usedLocalFallback = repository.kind === "local";
    try {
      await repository.save(transaction);
    } catch (reason) {
      if (repository.kind !== "firebase") throw reason;
      usedLocalFallback = true;
      await fallbackRepository.save(transaction);
      enqueueOutbox({ key: "transactions:" + transaction.id, ownerId: outboxOwner, domain: "transactions", action: "save", payload: transaction });
      setSyncPending(listOutbox("transactions", outboxOwner).length);
      setError("Đã lưu tạm trên thiết bị; ứng dụng sẽ đồng bộ khi có mạng.");
    }
    setTransactions((current) => sortTransactions([...current.filter((item) => item.id !== transaction.id), transaction]));
    if (usedLocalFallback) await refreshDeviceLocalCount();
  }, [outboxOwner, refreshDeviceLocalCount]);

  const remove = useCallback(async (id: string) => {
    const repository = repositoryRef.current;
    const fallbackRepository = fallbackRef.current;
    if (!repository || !fallbackRepository) throw new Error("Kho dữ liệu chưa sẵn sàng.");
    let usedLocalFallback = repository.kind === "local";
    try {
      await repository.remove(id);
    } catch (reason) {
      if (repository.kind !== "firebase") throw reason;
      usedLocalFallback = true;
      await fallbackRepository.remove(id);
      enqueueOutbox({ key: "transactions:" + id, ownerId: outboxOwner, domain: "transactions", action: "remove", payload: null });
      setSyncPending(listOutbox("transactions", outboxOwner).length);
      setError("Đã xóa tạm trên thiết bị; ứng dụng sẽ đồng bộ khi có mạng.");
    }
    setTransactions((current) => current.filter((transaction) => transaction.id !== id));
    if (usedLocalFallback) await refreshDeviceLocalCount();
  }, [outboxOwner, refreshDeviceLocalCount]);

  const clearLocal = useCallback(async () => {
    await fallbackRef.current?.clear();
    clearOutboxForOwner(outboxOwner, "transactions");
    setSyncPending(0);
    await refreshDeviceLocalCount();
    setTransactions([]);
  }, [outboxOwner, refreshDeviceLocalCount]);

  const clearLocalForOwner = useCallback(async (ownerId: string) => {
    const normalizedOwner = ownerId.trim();
    if (!normalizedOwner) return;
    await new LocalTransactionRepository(normalizedOwner).clear();
    clearOutboxForOwner(normalizedOwner, "transactions");
    if (normalizedOwner === outboxOwner) {
      setSyncPending(0);
      setTransactions([]);
    }
  }, [outboxOwner]);

  const clear = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Kho dữ liệu chưa sẵn sàng.");
    await repository.clear();
    await fallbackRef.current?.clear();
    await deviceFallbackRef.current?.clear();
    clearOutboxForOwner(outboxOwner, "transactions");
    setSyncPending(0);
    if (repository.kind === "local") setLocalTransactionCount(0);
    setTransactions([]);
  }, [outboxOwner]);

  const importLocalTransactions = useCallback(async () => {
    const repository = repositoryRef.current;
    const deviceFallbackRepository = deviceFallbackRef.current;
    if (!repository || !deviceFallbackRepository || repository.kind !== "firebase") {
      throw new Error("Hãy đăng nhập tài khoản thật trước khi nhập dữ liệu trên thiết bị.");
    }
    const localItems = await deviceFallbackRepository.list();
    for (const transaction of localItems) await save(transaction);
    await deviceFallbackRepository.clear();
    for (const transaction of localItems) removeOutbox("transactions:" + transaction.id, "device");
    setSyncPending(listOutbox("transactions", outboxOwner).length);
    const items = await repository.list();
    setLocalTransactionCount(0);
    setTransactions(sortTransactions(items));
    setError(null);
    return items;
  }, [outboxOwner, save]);

  const getIdToken = useCallback(async () => {
    if (repositoryRef.current?.kind !== "firebase") {
      throw new Error("Ghi giọng nói chỉ khả dụng sau khi Firebase kết nối.");
    }
    return getFirebaseIdToken();
  }, []);

  return { clear, clearLocal, clearLocalForOwner, error, getIdToken, importLocalTransactions, localTransactionCount, persistence, reload, remove, save, syncPending, transactions };
}
