"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { configureFirebaseClient, isFirebaseConfigured, type FirebaseWebConfig } from "@/lib/firebase/client";
import { clearOutboxForOwner, enqueueOutbox, listOutbox, removeOutbox } from "@/lib/offline/outbox";
import { FirebaseDebtRepository } from "@/lib/debts/firebase-repository";
import { LocalDebtRepository, type DebtRepository } from "@/lib/debts/repository";
import type { DebtEntry } from "@/types/debt";

type FirebaseConfigResponse = { configured: false } | { configured: true; firebase: FirebaseWebConfig };

async function selectRepository(scope?: string | null): Promise<DebtRepository> {
  const response = await fetch("/api/firebase-config", { cache: "no-store" });
  if (!response.ok) throw new Error("Không thể kiểm tra cấu hình lưu công nợ.");
  const configuration = (await response.json()) as FirebaseConfigResponse;
  if (!configuration.configured || !isFirebaseConfigured(configuration.firebase)) return new LocalDebtRepository(scope);
  const client = configureFirebaseClient(configuration.firebase);
  if (!client.auth.currentUser) return new LocalDebtRepository(scope);
  return new FirebaseDebtRepository();
}

export function useDebts(scope?: string | null) {
  const repositoryRef = useRef<DebtRepository | null>(null);
  const fallbackRef = useRef<LocalDebtRepository | null>(null);
  const deviceFallbackRef = useRef<LocalDebtRepository | null>(null);
  const [entries, setEntries] = useState<DebtEntry[]>([]);
  const [localDebtCount, setLocalDebtCount] = useState(0);
  const [persistence, setPersistence] = useState<"loading" | "local" | "firebase">("loading");
  const [error, setError] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(0);
  const outboxOwner = scope ?? "device";

  const syncOutbox = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository || repository.kind !== "firebase" || !window.navigator.onLine) return;
    let changed = false;
    for (const operation of listOutbox("debts", outboxOwner)) {
      try {
        if (operation.action === "save") await repository.save(operation.payload as DebtEntry);
        else await repository.remove(operation.key.replace("debts:", ""));
        removeOutbox(operation.key, outboxOwner);
        changed = true;
      } catch {
        break;
      }
    }
    if (changed) {
      try {
        setEntries(await repository.list());
      } catch {
        // Keep the local snapshot until the next online retry if refresh fails.
      }
    }
    setSyncPending(listOutbox("debts", outboxOwner).length);
  }, [outboxOwner]);

  useEffect(() => {
    let active = true;
    const fallback = new LocalDebtRepository(scope);
    const deviceFallback = new LocalDebtRepository();
    queueMicrotask(() => {
      if (!active) return;
      setEntries([]);
      setError(null);
      setSyncPending(listOutbox("debts", outboxOwner).length);
      setPersistence('loading');
    });
    fallbackRef.current = fallback;
    deviceFallbackRef.current = deviceFallback;
    repositoryRef.current = fallback;
    const onOnline = () => { void initialize(); };
    window.addEventListener("online", onOnline);

    async function initialize() {
      try {
        const [localEntries, deviceEntries] = await Promise.all([fallback.list(), deviceFallback.list()]);
        if (active) {
          setEntries(localEntries);
          setLocalDebtCount(deviceEntries.length);
          setPersistence("local");
        }
        const repository = await selectRepository(scope);
        if (repository.kind === "local") return;
        const remoteEntries = await repository.list();
        if (!active) return;
        repositoryRef.current = repository;
        setEntries(remoteEntries);
        setPersistence("firebase");
        await syncOutbox();
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Không thể tải sổ công nợ.");
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
    setEntries(await repository.list());
    setError(null);
  }, []);

  const save = useCallback(async (entry: DebtEntry) => {
    const repository = repositoryRef.current;
    const fallback = fallbackRef.current;
    if (!repository || !fallback) throw new Error("Sổ công nợ chưa sẵn sàng.");
    try {
      await repository.save(entry);
    } catch (reason) {
      if (repository.kind !== "firebase") throw reason;
      await fallback.save(entry);
      enqueueOutbox({ key: "debts:" + entry.id, ownerId: outboxOwner, domain: "debts", action: "save", payload: entry });
      setSyncPending(listOutbox("debts", outboxOwner).length);
      setError("Đã lưu công nợ tạm; sẽ đồng bộ khi có mạng.");
    }
    setEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
  }, [outboxOwner]);

  const remove = useCallback(async (id: string) => {
    const repository = repositoryRef.current;
    const fallback = fallbackRef.current;
    if (!repository || !fallback) throw new Error("Sổ công nợ chưa sẵn sàng.");
    try {
      await repository.remove(id);
    } catch (reason) {
      if (repository.kind !== "firebase") throw reason;
      await fallback.remove(id);
      enqueueOutbox({ key: "debts:" + id, ownerId: outboxOwner, domain: "debts", action: "remove", payload: null });
      setSyncPending(listOutbox("debts", outboxOwner).length);
      setError("Đã xóa công nợ tạm; sẽ đồng bộ khi có mạng.");
    }
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, [outboxOwner]);

  const clearLocal = useCallback(async () => {
    await fallbackRef.current?.clear();
    clearOutboxForOwner(outboxOwner, "debts");
    setSyncPending(listOutbox("debts", outboxOwner).length);
    setEntries([]);
  }, [outboxOwner]);
  const clearLocalForOwner = useCallback(async (ownerId: string) => {
    const normalizedOwner = ownerId.trim();
    if (!normalizedOwner) return;
    await new LocalDebtRepository(normalizedOwner).clear();
    clearOutboxForOwner(normalizedOwner, "debts");
    if (normalizedOwner === outboxOwner) {
      setSyncPending(0);
      setEntries([]);
    }
  }, [outboxOwner]);

  const clear = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Sổ công nợ chưa sẵn sàng.");
    await repository.clear();
    await fallbackRef.current?.clear();
    clearOutboxForOwner(outboxOwner, "debts");
    setSyncPending(listOutbox("debts", outboxOwner).length);
    setEntries([]);
  }, [outboxOwner]);

  const importLocalDebts = useCallback(async () => {
    const repository = repositoryRef.current;
    const deviceFallback = deviceFallbackRef.current;
    if (!repository || !deviceFallback || repository.kind !== "firebase") {
      throw new Error("Hãy đăng nhập tài khoản thật trước khi nhập công nợ trên thiết bị.");
    }
    const deviceEntries = await deviceFallback.list();
    for (const entry of deviceEntries) await repository.save(entry);
    await deviceFallback.clear();
    for (const entry of deviceEntries) removeOutbox("debts:" + entry.id, "device");
    setLocalDebtCount(0);
    setSyncPending(listOutbox("debts", outboxOwner).length);
    await reload();
  }, [outboxOwner, reload]);

  return { syncPending, clear, clearLocal, clearLocalForOwner, entries, error, importLocalDebts, localDebtCount, persistence, reload, remove, save };
}
