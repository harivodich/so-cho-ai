import "client-only";

const STORAGE_KEY = "so-cho-ai.revenue-goals.v1";
const CHANGE_EVENT = "so-cho-ai:revenue-goals-changed";
const MAX_GOAL = 999_999_999_999;

type RevenueGoals = Record<string, number>;

function readGoals(): RevenueGoals {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([month, value]) =>
          /^\d{4}-\d{2}$/.test(month) &&
          typeof value === "number" &&
          Number.isInteger(value) &&
          value > 0 &&
          value <= MAX_GOAL,
      ),
    ) as RevenueGoals;
  } catch {
    return {};
  }
}

function notifyGoalChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getRevenueGoal(month: string): number {
  return readGoals()[month] ?? 0;
}

export function saveRevenueGoal(month: string, amount: number) {
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(amount) || amount <= 0 || amount > MAX_GOAL) {
    throw new Error("Mục tiêu phải là số tiền nguyên từ 1.000 đ đến 999.999.999.999 đ.");
  }

  const goals = readGoals();
  goals[month] = amount;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  notifyGoalChange();
}

export function removeRevenueGoal(month: string) {
  const goals = readGoals();
  delete goals[month];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  notifyGoalChange();
}

export function clearRevenueGoals() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
  notifyGoalChange();
}

export function subscribeToRevenueGoals(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
