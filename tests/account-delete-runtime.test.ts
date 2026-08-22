import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/account/delete/route";

const mockRecursiveDelete = vi.fn();
const mockDeleteUser = vi.fn();
const mockVerifyIdToken = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdminDb: () => ({
    doc: (path: string) => ({ path }),
    recursiveDelete: mockRecursiveDelete,
  }),
  getFirebaseAdminAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
    deleteUser: mockDeleteUser,
  }),
}));

describe("Account Deletion Runtime Resilience & Resumability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyIdToken.mockResolvedValue({ uid: "user_delete_123" });
  });

  function createRequest() {
    return new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid_id_token",
      },
    });
  }

  it("fails closed with 503 and does NOT delete Auth user when Firestore recursiveDelete throws", async () => {
    mockRecursiveDelete.mockRejectedValueOnce(new Error("Firestore database connection failed"));

    const response = await POST(createRequest());
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.error.message).toContain("Chưa thể xác nhận xóa tài khoản hoàn toàn");

    // CRITICAL: Auth user must NOT be deleted so the user can log in and retry!
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("deletes Auth user and returns 200 when Firestore recursiveDelete succeeds", async () => {
    mockRecursiveDelete.mockResolvedValueOnce(undefined);
    mockDeleteUser.mockResolvedValueOnce(undefined);

    const response = await POST(createRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.deleted).toBe(true);

    expect(mockRecursiveDelete).toHaveBeenCalledWith({ path: "users/user_delete_123" });
    expect(mockDeleteUser).toHaveBeenCalledWith("user_delete_123");
  });

  it("handles idempotent retry gracefully when Auth user is already deleted (auth/user-not-found)", async () => {
    mockRecursiveDelete.mockResolvedValueOnce(undefined);
    const notFoundError = new Error("User not found");
    (notFoundError as { code?: string }).code = "auth/user-not-found";
    mockDeleteUser.mockRejectedValueOnce(notFoundError);

    const response = await POST(createRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.deleted).toBe(true);
  });
});
