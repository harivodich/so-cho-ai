import { describe, expect, it } from "vitest";
import { isFirebaseAdminConfigured, readFirebaseAdminServiceAccount } from "../src/lib/firebase/admin-credentials";

const account = {
  project_id: "sochoai",
  client_email: "so-cho-ai-vercel@sochoai.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nexample\\n-----END PRIVATE KEY-----\\n",
};

describe("readFirebaseAdminServiceAccount", () => {
  it("uses ADC when the Vercel secret is absent", () => {
    expect(readFirebaseAdminServiceAccount({})).toBeNull();
  });

  it("parses a server-only service account and restores escaped newlines", () => {
    expect(readFirebaseAdminServiceAccount({
      FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: JSON.stringify(account),
    })).toEqual({
      projectId: "sochoai",
      clientEmail: "so-cho-ai-vercel@sochoai.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----\n",
    });
  });

  it("rejects malformed or incomplete credentials before Firebase Admin is initialized", () => {
    expect(() => readFirebaseAdminServiceAccount({
      FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: "not-json",
    })).toThrow("must be valid JSON");
    expect(() => readFirebaseAdminServiceAccount({
      FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: "sochoai" }),
    })).toThrow("missing client_email");
  });

  it("accurately detects Firebase Admin configuration and avoids client-only false positives", () => {
    expect(isFirebaseAdminConfigured({})).toBe(false);
    expect(isFirebaseAdminConfigured({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "client-only-project" })).toBe(false);
    expect(isFirebaseAdminConfigured({ FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: JSON.stringify(account) })).toBe(true);
    expect(isFirebaseAdminConfigured({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(account) })).toBe(true);
    expect(isFirebaseAdminConfigured({ GOOGLE_APPLICATION_CREDENTIALS: "/path/to/key.json" })).toBe(true);
    expect(isFirebaseAdminConfigured({ GOOGLE_CLOUD_PROJECT: "gcp-project" })).toBe(true);
  });
});
