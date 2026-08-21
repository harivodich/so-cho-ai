import { NextResponse } from "next/server";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "IDEMPOTENCY_KEY_REUSED"
  | "PAYLOAD_TOO_LARGE"
  | "UNPROCESSABLE_ENTITY"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "AI_PROVIDER_ERROR"
  | "GATEWAY_TIMEOUT"
  | "SERVICE_UNCONFIGURED"
  | "INTERNAL_SERVER_ERROR";

export class AppHttpError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type StandardErrorResponse = {
  error: {
    code: ErrorCode | string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};

export function createErrorResponse(
  error: unknown,
  requestId: string,
  fallbackMessage = "Đã xảy ra lỗi khi xử lý yêu cầu.",
): NextResponse<StandardErrorResponse> {
  if (error instanceof AppHttpError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
      {
        status: error.status,
        headers: { "x-request-id": requestId, "Cache-Control": "no-store" },
      },
    );
  }

  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message,
        requestId,
      },
    },
    {
      status: 500,
      headers: { "x-request-id": requestId, "Cache-Control": "no-store" },
    },
  );
}
