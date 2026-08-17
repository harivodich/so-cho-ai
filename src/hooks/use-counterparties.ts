"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { configureFirebaseClient, isFirebaseConfigured, type FirebaseWebConfig } from "@/lib/firebase/client";
import { FirebaseCounterpartyRepository } from "@/lib/counterparties/firebase-repository";
import { LocalCounterpartyRepository, type CounterpartyRepository } from "@/lib/counterparties/repository";
import { enqueueOutbox, listOutbox, removeOutbox } from "@/lib/offline/outbox";
import type { Counterparty } from "@/types/counterparty";

type ConfigResponse = { configured: false } | { configured: true; firebase: FirebaseWebConfig };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "counterparty-" + Date.now();
}

export function useCounterparties(scope?: string | null) {
  const repositoryRef = useRef<CounterpartyRepository | null>(null);
  const fallbackRef = useRef<LocalCounterpartyRepository | null>(null);
  const deviceFallbackRef = useRef<LocalCounterpartyRepository | null>(null);
  const [items, setItems] = useState<Counterparty[]>([]);
  const [localCounterpartyCount, setLocalCounterpartyCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(0);
  const outboxOwner = scope ?? "device";

  const reload = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    setItems(await repository.list());
    setError(null);
  }, []);

  const syncOutbox = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository || repository.kind !== "firebase" || !window.navigator.onLine) return;
    for (const operation of listOutbox("counterparties", outboxOwner)) {
      try {
        if (operation.action === "save") {
          await repository.save(operation.payload as Counterparty);
        }
        removeOutbox(operation.key, outboxOwner);
        setSyncPending(listOutbox("counterparties", outboxOwner).length);
      } catch {
        break;
      }
    }
    await reload();
  }, [outboxOwner, reload]);

  useEffect(() => {
    let active = true;
    const local = new LocalCounterpartyRepository(scope);
    const deviceLocal = new LocalCounterpartyRepository();
    queueMicrotask(() => {
      if (!active) return;
      setItems([]);
      setError(null);
      setSyncPending(listOutbox("counterparties", outboxOwner).length);
    });
    fallbackRef.current = local;
    deviceFallbackRef.current = deviceLocal;
    repositoryRef.current = local;
    const onOnline = () => { void initialize(); };
    window.addEventListener("online", onOnline);

    async function initialize() {
      try {
        const [localItems, deviceItems] = await Promise.all([local.list(), deviceLocal.list()]);
        if (active) {
          setItems(localItems);
          setLocalCounterpartyCount(deviceItems.length);
        }
        const response = await fetch("/api/firebase-config", { cache: "no-store" });
        const configuration = (await response.json()) as ConfigResponse;
        if (!configuration.configured || !isFirebaseConfigured(configuration.firebase)) return;
        const client = configureFirebaseClient(configuration.firebase);
        if (!client.auth.currentUser) return;
        const remote = new FirebaseCounterpartyRepository();
        const remoteItems = await remote.list();
        if (!active) return;
        repositoryRef.current = remote;
        setItems(remoteItems);
        await syncOutbox();
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Không thể tải danh bạ đối tác.");
      }
    }
    void initialize();
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
    };
  }, [outboxOwner, scope, syncOutbox]);

  const remember = useCallback(async (name: string) => {
    const normalized = name.trim();
    const repository = repositoryRef.current;
    const fallback = fallbackRef.current;
    if (!normalized || !repository || !fallback) return;

    let existing: Counterparty | undefined;
    try {
      existing = (await repository.list()).find((item) => item.name.localeCompare(normalized, undefined, { sensitivity: "base" }) === 0);
    } catch {
      if (repository.kind !== "firebase") throw new Error("Không thể đọc danh bạ đối tác.");
      existing = (await fallback.list()).find((item) => item.name.localeCompare(normalized, undefined, { sensitivity: "base" }) === 0);
    }

    const now = new Date().toISOString();
    const item: Counterparty = {
      id: existing?.id ?? newId(),
      userId: existing?.userId ?? scope ?? "local-device",
      name: normalized,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await repository.save(item);
      setError(null);
    } catch (reason) {
      if (repository.kind !== "firebase") {
        setError(reason instanceof Error ? reason.message : "Không thể lưu đối tác.");
        return;
      }
      await fallback.save(item);
      enqueueOutbox({ key: "counterparties:" + item.id, ownerId: outboxOwner, domain: "counterparties", action: "save", payload: item });
      setSyncPending(listOutbox("counterparties", outboxOwner).length);
      setError("Đã lưu đối tác tạm; sẽ đồng bộ khi có mạng.");
    }
    setItems((current) => [...current.filter((entry) => entry.id !== item.id), item].sort((left, right) => left.name.localeCompare(right.name)));
  }, [outboxOwner, scope]);

  const clearLocal = useCallback(async () => {
    await fallbackRef.current?.clear();
    for (const operation of listOutbox("counterparties", outboxOwner)) removeOutbox(operation.key, outboxOwner);
    setItems([]);
    setSyncPending(listOutbox("counterparties", outboxOwner).length);
  }, [outboxOwner]);

  const clearLocalForOwner = useCallback(async (ownerId: string) => {
    const normalizedOwner = ownerId.trim();
    if (!normalizedOwner) return;
    await new LocalCounterpartyRepository(normalizedOwner).clear();
    for (const operation of listOutbox("counterparties", normalizedOwner)) removeOutbox(operation.key, normalizedOwner);
    if (normalizedOwner === outboxOwner) {
      setItems([]);
      setSyncPending(0);
    }
  }, [outboxOwner]);

  const clear = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    await repository.clear();
    await fallbackRef.current?.clear();
    for (const operation of listOutbox("counterparties", outboxOwner)) removeOutbox(operation.key, outboxOwner);
    setItems([]);
    setSyncPending(listOutbox("counterparties", outboxOwner).length);
  }, [outboxOwner]);

  const importLocalCounterparties = useCallback(async () => {
    const repository = repositoryRef.current;
    const deviceLocal = deviceFallbackRef.current;
    if (!repository || !deviceLocal || repository.kind !== "firebase") {
      throw new Error("Hãy đăng nhập tài khoản thật trước khi nhập đối tác trên thiết bị.");
    }
    const deviceItems = await deviceLocal.list();
    for (const item of deviceItems) await repository.save(item);
    await deviceLocal.clear();
    for (const item of deviceItems) removeOutbox("counterparties:" + item.id, "device");
    setLocalCounterpartyCount(0);
    setSyncPending(listOutbox("counterparties", outboxOwner).length);
    await reload();
  }, [outboxOwner, reload]);

  return { syncPending, clear, clearLocal, clearLocalForOwner, error, importLocalCounterparties, items, localCounterpartyCount, names: items.map((item) => item.name), reload, remember };
}
