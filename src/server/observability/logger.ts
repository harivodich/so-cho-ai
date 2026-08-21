import { createHash } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  requestId?: string;
  userId?: string;
  userIdHash?: string;
  route?: string;
  method?: string;
  status?: number;
  latencyMs?: number;
  provider?: string;
  model?: string;
  promptVersion?: string;
  errorCode?: string;
  [key: string]: unknown;
};

export function hashUserId(uid: string | null | undefined): string {
  if (!uid) return "anonymous";
  return `usr_${createHash("sha256").update(uid).digest("hex").slice(0, 16)}`;
}

const SENSITIVE_KEY_PATTERN = /(key|token|secret|password|auth|authorization|credential|audio|image|base64|body)/i;

export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      if (typeof value === "string" && value.length > 32) {
        sanitized[key] = `[REDACTED_LEN_${value.length}]`;
      } else {
        sanitized[key] = "[REDACTED]";
      }
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function writeLog(level: LogLevel, message: string, context?: LogContext) {
  const timestamp = new Date().toISOString();
  const safeContext: Record<string, unknown> = context ? { ...context } : {};

  if (safeContext.userId && typeof safeContext.userId === "string") {
    safeContext.userIdHash = hashUserId(safeContext.userId);
    delete safeContext.userId;
  }

  const logEntry = {
    timestamp,
    level,
    message,
    ...sanitizeLogData(safeContext),
  };

  const jsonStr = JSON.stringify(logEntry);
  if (level === "error") {
    console.error(jsonStr);
  } else if (level === "warn") {
    console.warn(jsonStr);
  } else {
    console.log(jsonStr);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => writeLog("debug", message, context),
  info: (message: string, context?: LogContext) => writeLog("info", message, context),
  warn: (message: string, context?: LogContext) => writeLog("warn", message, context),
  error: (message: string, context?: LogContext) => writeLog("error", message, context),
};
