export type FirebaseAdminServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

type Environment = Record<string, string | undefined>;

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON is missing ${field}.`);
  }

  return value;
}

/**
 * Vercel has no Google Application Default Credentials. This parses its
 * server-only secret without ever exposing it to the browser bundle.
 */
export function readFirebaseAdminServiceAccount(
  environment: Environment = process.env,
): FirebaseAdminServiceAccount | null {
  const serialized = (
    environment.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON ||
    environment.FIREBASE_SERVICE_ACCOUNT_JSON
  )?.trim();
  if (!serialized) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON must be an object.");
  }

  const account = parsed as Record<string, unknown>;
  const projectId = requiredString(account.project_id, "project_id");
  const clientEmail = requiredString(account.client_email, "client_email");
  const privateKey = requiredString(account.private_key, "private_key").replace(/\\n/g, "\n");

  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON has an invalid private_key.");
  }

  return { projectId, clientEmail, privateKey };
}

export function isFirebaseAdminConfigured(
  environment: Environment = process.env,
): boolean {
  if (environment.TEST_DISTRIBUTED_IDEMPOTENCY === "true") {
    return true;
  }
  if (Boolean(
    environment.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?.trim() ||
    environment.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  )) {
    return true;
  }
  if (Boolean(environment.GOOGLE_APPLICATION_CREDENTIALS?.trim())) {
    return true;
  }
  if (Boolean(environment.FIREBASE_CONFIG?.trim())) {
    return true;
  }
  if (Boolean(environment.GOOGLE_CLOUD_PROJECT?.trim() || environment.GCLOUD_PROJECT?.trim())) {
    return true;
  }
  return false;
}
