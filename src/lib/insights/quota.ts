import { Timestamp } from "firebase-admin/firestore";

import { vietnamDateKey } from "@/lib/extraction/quota";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";

export const DAILY_INSIGHT_LIMIT = 5;

export class DailyInsightQuotaError extends Error {
  constructor() {
    super("Bạn đã dùng hết 5 lượt nhận xét hôm nay. Số liệu báo cáo vẫn xem được bình thường.");
    this.name = "DailyInsightQuotaError";
  }
}

export async function enforceDailyInsightQuota(userId: string, now = new Date()): Promise<void> {
  const db = getFirebaseAdminDb();
  const day = vietnamDateKey(now);
  const reference = db.doc(`users/${userId}/system/dailyInsightQuota`);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const stored = snapshot.data();
    const count = snapshot.exists && stored?.day === day && Number.isSafeInteger(stored.count) ? stored.count : 0;
    if (count >= DAILY_INSIGHT_LIMIT) throw new DailyInsightQuotaError();
    transaction.set(reference, { day, count: count + 1, updatedAt: Timestamp.fromDate(now) }, { merge: true });
  });
}
