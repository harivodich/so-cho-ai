import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminDb } from "@/lib/firebase/admin";

export const DAILY_EXTRACTION_LIMIT = 30;

export class ExtractionQuotaError extends Error {
  constructor() {
    super("Bạn đã dùng hết 30 lượt trích xuất AI hôm nay. Hãy nhập tay hoặc thử lại vào ngày mai.");
    this.name = "ExtractionQuotaError";
  }
}

export function vietnamDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function enforceExtractionQuota(userId: string, now = new Date()): Promise<void> {
  const db = getFirebaseAdminDb();
  const day = vietnamDateKey(now);
  const quotaReference = db.doc(`users/${userId}/system/extractionQuota`);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(quotaReference);
    const storedQuota = snapshot.data();
    const count =
      snapshot.exists &&
      storedQuota?.day === day &&
      typeof storedQuota.count === "number" &&
      Number.isSafeInteger(storedQuota.count)
        ? storedQuota.count
        : 0;
    if (count >= DAILY_EXTRACTION_LIMIT) {
      throw new ExtractionQuotaError();
    }

    transaction.set(
      quotaReference,
      {
        day,
        count: count + 1,
        updatedAt: Timestamp.fromDate(now),
      },
      { merge: true },
    );
  });
}
