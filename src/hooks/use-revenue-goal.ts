"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore/lite";

import { getFirebaseClient } from "@/lib/firebase/client";
import { enqueueOutbox, listDueOutbox, recordOutboxFailure, removeOutbox } from "@/lib/offline/outbox";
import { getRevenueGoal, getRevenueGoalsSnapshot, removeRevenueGoal, saveRevenueGoal } from "@/lib/revenue-goals";
import { mergeRevenueGoalScopes } from "@/lib/revenue-goal-migration";

type Props = { month: string; userId: string | null };
type GoalOperation = { userId: string; month: string; amount: number | null };

async function writeRemoteGoal(userId: string, month: string, amount: number | null): Promise<void> {
  const { db } = getFirebaseClient();
  const settingsRef = doc(db, "users", userId, "settings", "default");
  const current = await getDoc(settingsRef);
  const goals = { ...((current.data()?.revenueGoals as Record<string, number> | undefined) ?? {}) };
  if (amount === null) delete goals[month];
  else goals[month] = amount;
  await setDoc(settingsRef, { revenueGoals: goals, updatedAt: new Date().toISOString() }, { merge: true });
}

export function useRevenueGoal({ month, userId }: Props) {
  const [target, setTarget] = useState(() => getRevenueGoal(month, userId));
  const [error, setError] = useState<string | null>(null);

  const syncOutbox = useCallback(async () => {
    if (!userId || !window.navigator.onLine) return;
    for (const operation of listDueOutbox("revenueGoals", userId)) {
      const payload = operation.payload as Partial<GoalOperation>;
      if (payload.userId !== userId || operation.action !== "save") continue;
      try {
        await writeRemoteGoal(userId, payload.month ?? month, payload.amount ?? null);
        removeOutbox(operation.key, userId);
      } catch (err) {
        recordOutboxFailure(operation.key, err instanceof Error ? err.message : "SYNC_FAILED", userId);
        break;
      }
    }
  }, [month, userId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setTarget(getRevenueGoal(month, userId));
      setError(null);
    });
    async function load() {
      if (!userId) return;
      try {
        await syncOutbox();
        const { db } = getFirebaseClient();
        const settingsRef = doc(db, "users", userId, "settings", "default");
        const snapshot = await getDoc(settingsRef);
        const rawRemoteGoals = snapshot.data()?.revenueGoals;
        const remoteGoals = rawRemoteGoals && typeof rawRemoteGoals === "object" && !Array.isArray(rawRemoteGoals)
          ? Object.fromEntries(Object.entries(rawRemoteGoals).filter(([goalMonth, value]) => /^\d{4}-\d{2}$/.test(goalMonth) && typeof value === "number")) as Record<string, number>
          : {};
        const deviceGoals = getRevenueGoalsSnapshot("device");
        const uidGoals = getRevenueGoalsSnapshot(userId);
        const { goals: mergedGoals, migratedMonths, conflicts } = mergeRevenueGoalScopes(remoteGoals, deviceGoals, uidGoals);
        const shouldSeedFromLocal = Object.keys(remoteGoals).length === 0 && Object.keys(uidGoals).length > 0;
        const goalsToWrite = mergedGoals;
        const shouldWrite = migratedMonths.length > 0 || shouldSeedFromLocal;
        if (shouldWrite) {
          await setDoc(settingsRef, { revenueGoals: goalsToWrite, updatedAt: new Date().toISOString() }, { merge: true });
          for (const migratedMonth of migratedMonths) {
            const migratedAmount = mergedGoals[migratedMonth];
            if (migratedAmount === undefined) continue;
            saveRevenueGoal(migratedMonth, migratedAmount, userId);
            removeRevenueGoal(migratedMonth, "device");
          }
        }
        if (!active) return;
        if (conflicts.length > 0) setError("Remote revenue goals were kept for conflicting months. Export/import a backup if you need the device values.");
        const effectiveGoals = shouldWrite ? goalsToWrite : { ...uidGoals, ...remoteGoals };
        const effectiveTarget = effectiveGoals[month];
        if (typeof effectiveTarget === "number") setTarget(effectiveTarget);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Không thể đồng bộ mục tiêu.");
      }
    }

    void load();
    const onOnline = () => { void load(); };
    window.addEventListener("online", onOnline);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
    };
  }, [month, syncOutbox, userId]);

  const save = useCallback(async (amount: number) => {
    saveRevenueGoal(month, amount, userId);
    setTarget(amount);
    if (!userId) return;

    try {
      await writeRemoteGoal(userId, month, amount);
      setError(null);
    } catch (reason) {
      const payload: GoalOperation = { userId, month, amount };
      enqueueOutbox({ key: "revenueGoals:" + userId + ":" + month, ownerId: userId, domain: "revenueGoals", action: "save", payload });
      setError("Đã lưu mục tiêu trên thiết bị; sẽ đồng bộ khi có mạng.");
      throw reason;
    }
  }, [month, userId]);

  const remove = useCallback(async () => {
    removeRevenueGoal(month, userId);
    setTarget(0);
    if (!userId) return;

    try {
      await writeRemoteGoal(userId, month, null);
      setError(null);
    } catch (reason) {
      const payload: GoalOperation = { userId, month, amount: null };
      enqueueOutbox({ key: "revenueGoals:" + userId + ":" + month, ownerId: userId, domain: "revenueGoals", action: "save", payload });
      setError("Đã bỏ mục tiêu trên thiết bị; sẽ đồng bộ khi có mạng.");
      throw reason;
    }
  }, [month, userId]);

  return { error, remove, save, target };
}
