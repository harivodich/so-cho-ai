import { describe, expect, it } from "vitest";

import { readFirebaseAdminServiceAccount } from "../src/lib/firebase/admin-credentials";

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
});
