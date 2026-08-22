import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("account isolation contracts", () => {
  it("rejects anonymous tokens on AI routes", () => {
    const extract = readFileSync("src/app/api/extract/route.ts", "utf8");
    const insights = readFileSync("src/app/api/insights/route.ts", "utf8");
    expect(extract).toContain('decoded.firebase?.sign_in_provider === "anonymous"');
    expect(insights).toContain('decoded.firebase?.sign_in_provider === "anonymous"');
    expect(extract).toContain("return errorResponse");
    expect(insights).toContain("return errorResponse");
  });

  it("does not expose the AI insight action to anonymous sessions", () => {
    const insight = readFileSync("src/components/daily-insight.tsx", "utf8");
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(insight).toContain("aiEnabled");
    expect(insight).toContain("!aiEnabled");
    expect(page).toContain("userId={isRealAccount ? userScope : null}");
  });
  it("keeps Firestore documents scoped to the authenticated uid", () => {
    const rules = readFileSync("firestore.rules", "utf8");
    expect(rules).toContain("request.auth.uid == userId");
    expect(rules).toContain("function ownsDocument(userId)");
    expect(rules).toContain("request.resource.data.userId == userId");
    expect(rules.match(/allow create, update: if ownsDocument\(userId\)/g)?.length).toBe(5);
    expect(rules).toContain("match /users/{userId}/transactions/{transactionId}");
    expect(rules).toContain("match /users/{userId}/profile/{document=**}");
    expect(rules).toContain("match /users/{userId}/settings/{document=**}");
    expect(rules).toContain("match /users/{userId}/debts/{debtId}");
    expect(rules).toContain("match /users/{userId}/products/{productId}");
    expect(rules).toContain("match /users/{userId}/stockMovements/{movementId}");
  });
  it("preserves anonymous data when an existing-account login attempt fails", () => {
    const client = readFileSync("src/lib/firebase/client.ts", "utf8");
    const start = client.indexOf("export async function signInOrLinkEmailAccount");
    const end = client.indexOf("export async function verifyFirebaseEmail", start);
    const emailFlow = client.slice(start, end);
    expect(emailFlow).toContain("auth.currentUser?.isAnonymous && create");
    expect(emailFlow).toContain("await signInWithEmailAndPassword(auth, email.trim(), password);");
    expect(emailFlow).not.toContain("await signOut(auth);");
  });

  it("configures the browser redirect resolver for Firebase Auth", () => {
    const client = readFileSync("src/lib/firebase/client.ts", "utf8");
    expect(client).toContain("browserPopupRedirectResolver");
    expect(client).toContain("popupRedirectResolver: browserPopupRedirectResolver");
  });

  it("offers an explicit Google existing-account path without linking", () => {
    const client = readFileSync("src/lib/firebase/client.ts", "utf8");
    const start = client.indexOf("export async function signInWithExistingGoogleAccount");
    const end = client.indexOf("export async function signInOrLinkEmailAccount", start);
    const existingGoogleFlow = client.slice(start, end);
    expect(existingGoogleFlow).toContain("await signInWithRedirect(auth, new GoogleAuthProvider());");
    expect(existingGoogleFlow).not.toContain("linkWithRedirect");

    const panel = readFileSync("src/components/account-panel.tsx", "utf8");
    expect(panel).toContain("onGoogleExisting");
    expect(panel).toContain("window.confirm");
  });
  it("does not create an anonymous account during repository initialization", () => {
    const repositories = [
      "src/lib/transactions/firebase-repository.ts",
      "src/lib/catalog/firebase-repository.ts",
      "src/lib/debts/firebase-repository.ts",
      "src/lib/counterparties/firebase-repository.ts",
    ].map((file) => readFileSync(file, "utf8"));
    expect(repositories.every((source) => !source.includes("signInAnonymously"))).toBe(true);
    expect(repositories.every((source) => source.includes("SIGN_IN_REQUIRED"))).toBe(true);
  });

  it("keeps device-local transactions available for explicit post-login import", () => {
    const hook = readFileSync("src/hooks/use-transactions.ts", "utf8");
    expect(hook).toContain("deviceFallbackRef");
    expect(hook).toContain("deviceFallbackRepository.list()");
    expect(hook).toContain("nhập dữ liệu trên thiết bị");
  });
  it("reconciles imported transactions into inventory movements", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(page).toContain("const imported = await importLocalTransactions()");
    expect(page).toContain("catalog.syncTransaction(transaction)");
  });
  it("imports all device-local domains only after explicit confirmation", () => {
    const panel = readFileSync("src/components/account-panel.tsx", "utf8");
    const page = readFileSync("src/app/page.tsx", "utf8");
    const catalog = readFileSync("src/hooks/use-catalog.ts", "utf8");
    const debts = readFileSync("src/hooks/use-debts.ts", "utf8");
    const counterparties = readFileSync("src/hooks/use-counterparties.ts", "utf8");
    expect(panel).toContain("window.confirm");
    expect(panel).toContain("localImportCount");
    expect(page).toContain("catalog.importLocalCatalog()");
    expect(page).toContain("debts.importLocalDebts()");
    expect(page).toContain("counterparties.importLocalCounterparties()");
    expect(catalog).toContain("deviceFallbackRef");
    expect(catalog).toContain("removeOutbox(\"products:\"");
    expect(catalog).toContain("userId: effectiveUserId(scope)");
    expect(debts).toContain("deviceFallbackRef");
    expect(debts).toContain("removeOutbox(\"debts:\"");
    expect(counterparties).toContain("deviceFallbackRef");
    expect(counterparties).toContain("removeOutbox(\"counterparties:\"");
  });

  it("preserves device-local data when clearing account-local transactions", () => {
    const hook = readFileSync("src/hooks/use-transactions.ts", "utf8");
    const clearLocalStart = hook.indexOf("const clearLocal = useCallback");
    const clearStart = hook.indexOf("const clear = useCallback", clearLocalStart);
    const clearLocal = hook.slice(clearLocalStart, clearStart);
    expect(clearLocal).toContain("await fallbackRef.current?.clear();");
    expect(clearLocal).toContain("await refreshDeviceLocalCount();");
    expect(clearLocal).not.toContain("deviceFallbackRef.current?.clear()");
  });
  it("keeps the account trigger touch target accessible", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(".account-trigger {\n  min-height: 44px;");
  });
  it("exposes account drawer state to assistive technology", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    const panel = readFileSync("src/components/account-panel.tsx", "utf8");
    expect(page).toContain("aria-expanded={accountOpen}");
    expect(page).toContain("aria-controls=\"account-panel\"");
    expect(panel).toContain("id=\"account-panel\"");
  });

  it("rejects oversized extraction requests before multipart parsing", () => {
    const route = readFileSync("src/app/api/extract/route.ts", "utf8");
    expect(route).toContain("content-length");
    expect(route).toContain("6 * 1024 * 1024");
    expect(route).toContain("Tệp tải lên vượt giới hạn cho phép.");
  });

  it("retries Firebase initialization after reconnecting online", () => {
    const hooks = [
      "src/hooks/use-transactions.ts",
      "src/hooks/use-debts.ts",
      "src/hooks/use-catalog.ts",
      "src/hooks/use-counterparties.ts",
    ];
    for (const file of hooks) {
      expect(readFileSync(file, "utf8")).toContain("const onOnline = () => { void initialize(); };");
    }
    expect(readFileSync("src/hooks/use-transactions.ts", "utf8")).toContain("setTransactions(sortTransactions(await repository.list()));");
    expect(readFileSync("src/hooks/use-debts.ts", "utf8")).toContain("setEntries(await repository.list());");
  });

  it("clears account-scoped fallback caches with remote clear", () => {
    const hooks = [
      "src/hooks/use-transactions.ts",
      "src/hooks/use-debts.ts",
      "src/hooks/use-catalog.ts",
      "src/hooks/use-counterparties.ts",
    ];
    for (const file of hooks) {
      const source = readFileSync(file, "utf8");
      const start = source.indexOf("const clear = useCallback");
      const end = source.indexOf("}, [outboxOwner]);", start);
      expect(source.slice(start, end)).toContain("await fallbackRef.current?.clear();");
    }
  });

  it("clears account-scoped local caches by an explicit owner during deletion", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(page).toContain("clearTransactionLocalForOwner(deletedOwner)");
    expect(page).toContain("debts.clearLocalForOwner(deletedOwner)");
    expect(page).toContain("catalog.clearLocalForOwner(deletedOwner)");
    expect(page).toContain("counterparties.clearLocalForOwner(deletedOwner)");
    for (const file of ["src/hooks/use-transactions.ts", "src/hooks/use-catalog.ts", "src/hooks/use-debts.ts", "src/hooks/use-counterparties.ts"]) {
      expect(readFileSync(file, "utf8")).toContain("const clearLocalForOwner = useCallback");
    }
  });

  it("keeps a saved transaction id stable when inventory sync needs a retry", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(page).toContain("let transactionSaved = false;");
    expect(page).toContain("if (transactionSaved) setEditing(transaction);");
    expect(page).toContain("Đã lưu giao dịch nhưng chưa cập nhật tồn kho");
  });

  it("aggregates pending outbox changes across data domains", () => {
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(page).toContain("transactionSyncPending + debts.syncPending + catalog.syncPending + counterparties.syncPending");
    for (const file of ["src/hooks/use-debts.ts", "src/hooks/use-catalog.ts", "src/hooks/use-counterparties.ts"]) {
      expect(readFileSync(file, "utf8")).toContain("return { syncPending,");
    }
  });
});
