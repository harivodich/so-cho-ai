import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("account deletion contract", () => {
  it("authenticates the caller and deletes the UID tree server-side", () => {
    const route = readFileSync("src/app/api/account/delete/route.ts", "utf8");
    const client = readFileSync("src/lib/firebase/client.ts", "utf8");
    expect(route).toContain('verifyIdToken(token, true)');
    expect(route).toContain('await db.recursiveDelete(db.doc("users/" + userId));');
    expect(route).toContain('await getFirebaseAdminAuth().deleteUser(userId)');
    expect(route).toContain('return errorResponse');
    expect(route).toContain('Chưa thể xác nhận xóa tài khoản hoàn toàn. Hãy thử lại sau.');
    expect(client).toContain('fetch("/api/account/delete"');
    expect(client).toContain('await signOut(auth);');
  });

  it("ensures Firestore recursiveDelete executes before Auth deleteUser", () => {
    const route = readFileSync("src/app/api/account/delete/route.ts", "utf8");
    const firestoreDeleteIndex = route.indexOf('await db.recursiveDelete(db.doc("users/" + userId))');
    const authDeleteIndex = route.indexOf('await getFirebaseAdminAuth().deleteUser(userId)');
    expect(firestoreDeleteIndex).toBeGreaterThan(0);
    expect(authDeleteIndex).toBeGreaterThan(firestoreDeleteIndex);
  });
});