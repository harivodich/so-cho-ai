import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("account profile contract", () => {
  it("shows explicit login controls before any user exists", () => {
    const panel = readFileSync("src/components/account-panel.tsx", "utf8");
    expect(panel).toContain("const canSignIn = !user || user.isAnonymous");
    expect(panel).toContain("onGoogle");
    expect(panel).toContain("Dùng email và mật khẩu");
  });

  it("persists a UID-scoped profile and default settings document", () => {
    const client = readFileSync("src/lib/firebase/client.ts", "utf8");
    expect(client).toContain('doc(db, "users", user.uid, "profile", "main")');
    expect(client).toContain('doc(db, "users", user.uid, "settings", "default")');
    expect(client).toContain("uid: user.uid");
    expect(client).toContain('typeof settings.currency === "string" ? settings.currency : "VND"');
    expect(client).toContain("const [existingProfile, existingSettings]");
    expect(client).toContain('typeof settings.defaultUnit === "string" ? settings.defaultUnit : "kg"');
    expect(client).toContain('typeof settings.lowStockAlertsEnabled === "boolean"');
  });
});
