"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  configureFirebaseClient,
  getFirebaseIdToken,
  isFirebaseConfigured,
  type FirebaseWebConfig,
} from "@/lib/firebase/client";
import { FirebaseTransactionRepository } from "@/lib/transactions/firebase-repository";
import {
  LocalTransactionRepository,
  type TransactionRepository,
} from "@/lib/transactions/repository";
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

  configureFirebaseClient(configuration.firebase);
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

export function useTransactions() {
  const repositoryRef = useRef<TransactionRepository | null>(null);
  const [transactions, setTransactions] = useState<ConfirmedTransaction[]>([]);
  const [persistence, setPersistence] = useState<PersistenceKind>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fallbackRepository = new LocalTransactionRepository();
    repositoryRef.current = fallbackRepository;

    async function initialize() {
      try {
        const localItems = await fallbackRepository.list();
        if (active) {
          setTransactions(sortTransactions(localItems));
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
        if (repository.kind === "local") {
          if (active) setPersistence("local");
          return;
        }

        const items = await withTimeout(repository.list(), 5_000);
        if (!active) return;
        repositoryRef.current = repository;
        setTransactions(sortTransactions(items));
        setError(null);
        setPersistence("firebase");
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? `Không thể kết nối Firebase: ${reason.message}` : "Không thể kết nối Firebase.");
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (transaction: ConfirmedTransaction) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Kho dữ liệu chưa sẵn sàng.");
    await repository.save(transaction);
    setTransactions((current) => sortTransactions([...current.filter((item) => item.id !== transaction.id), transaction]));
  }, []);

  const remove = useCallback(async (id: string) => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Kho dữ liệu chưa sẵn sàng.");
    await repository.remove(id);
    setTransactions((current) => current.filter((transaction) => transaction.id !== id));
  }, []);

  const clear = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) throw new Error("Kho dữ liệu chưa sẵn sàng.");
    await repository.clear();
    setTransactions([]);
  }, []);

  const getIdToken = useCallback(async () => {
    if (repositoryRef.current?.kind !== "firebase") {
      throw new Error("Ghi giọng nói chỉ khả dụng sau khi Firebase kết nối.");
    }

    return getFirebaseIdToken();
  }, []);

  return { clear, error, getIdToken, persistence, remove, save, transactions };
}
