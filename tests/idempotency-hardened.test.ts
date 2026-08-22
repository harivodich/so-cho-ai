import { describe, expect, it } from "vitest";
import { withIdempotency, clearIdempotencyCache, computeRequestHash } from "@/server/idempotency";

describe("Hardened Idempotency & Concurrency Security", () => {
  it("differentiates two files with identical byte size but different content", async () => {
    clearIdempotencyCache();
    const fileAContent = Buffer.from("Audio recording A content 12345678");
    const fileBContent = Buffer.from("Audio recording B content 87654321");
    expect(fileAContent.length).toBe(fileBContent.length); // Identical byte size

    const hashA = computeRequestHash({ mode: "voice", fileBytes: fileAContent });
    const hashB = computeRequestHash({ mode: "voice", fileBytes: fileBContent });
    expect(hashA).not.toBe(hashB);

    const clientKey = "same-idempotency-key-for-two-files";

    // Request 1 processes File A
    const resA = await withIdempotency(
      { userId: "uid_store_1", route: "/api/extract", key: clientKey, payload: { fileBytes: fileAContent } },
      async () => ({ extracted: "File A Transaction" }),
    );
    expect(resA.cached).toBe(false);
    expect(resA.data.extracted).toBe("File A Transaction");

    // Request 2 sends File B with the same key -> Must be rejected with 409, not return File A's cache
    await expect(
      withIdempotency(
        { userId: "uid_store_1", route: "/api/extract", key: clientKey, payload: { fileBytes: fileBContent } },
        async () => ({ extracted: "File B Transaction" }),
      ),
    ).rejects.toThrow("Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác.");
  });

  it("rejects concurrent in-flight requests that attempt to reuse key with a different payload", async () => {
    clearIdempotencyCache();
    const clientKey = "concurrent-clashing-key";

    let releaseFirstTask: (() => void) | null = null;
    const firstTaskPromise = new Promise<string>((resolve) => {
      releaseFirstTask = () => resolve("result-of-first-task");
    });

    // Start Task 1 with payload 1
    const p1 = withIdempotency(
      { userId: "user_concurrent", route: "/api/extract", key: clientKey, payload: { query: "query1" } },
      () => firstTaskPromise,
    );

    // Concurrently start Task 2 with same key but payload 2
    const p2 = withIdempotency(
      { userId: "user_concurrent", route: "/api/extract", key: clientKey, payload: { query: "DIFFERENT_query2" } },
      async () => "result-of-second-task",
    );

    // Task 2 must immediately reject with 409
    await expect(p2).rejects.toThrow("trong một tác vụ đang chạy");

    // Release Task 1
    if (releaseFirstTask) releaseFirstTask();
    const res1 = await p1;
    expect(res1.data).toBe("result-of-first-task");
  });

  it("shares in-flight execution when concurrent requests have identical keys and matching payloads", async () => {
    clearIdempotencyCache();
    const clientKey = "concurrent-matching-key";
    let executions = 0;

    const slowOperation = async () => {
      executions += 1;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return { status: "success", executions };
    };

    const [res1, res2] = await Promise.all([
      withIdempotency(
        { userId: "user_sync", route: "/api/extract", key: clientKey, payload: { file: "exact_same.mp3" } },
        slowOperation,
      ),
      withIdempotency(
        { userId: "user_sync", route: "/api/extract", key: clientKey, payload: { file: "exact_same.mp3" } },
        slowOperation,
      ),
    ]);

    expect(executions).toBe(1);
    expect(res1.data).toEqual(res2.data);
    expect(res1.cached).toBe(false);
    expect(res2.cached).toBe(true);
  });

  it("prevents key collisions between different users or routes with matching client keys", async () => {
    clearIdempotencyCache();
    const commonClientKey = "shared-uuid-12345";

    const resUser1 = await withIdempotency(
      { userId: "user_alpha", route: "/api/extract", key: commonClientKey, payload: { audio: "a.wav" } },
      async () => "alpha_result",
    );

    const resUser2 = await withIdempotency(
      { userId: "user_beta", route: "/api/extract", key: commonClientKey, payload: { audio: "b.wav" } },
      async () => "beta_result",
    );

    const resRoute2 = await withIdempotency(
      { userId: "user_alpha", route: "/api/insights", key: commonClientKey, payload: { snap: "s" } },
      async () => "insights_result",
    );

    expect(resUser1.data).toBe("alpha_result");
    expect(resUser2.data).toBe("beta_result");
    expect(resRoute2.data).toBe("insights_result");
    expect(resUser1.cached).toBe(false);
    expect(resUser2.cached).toBe(false);
    expect(resRoute2.cached).toBe(false);
  });

  it("rejects whitespace-only idempotency keys with INVALID_IDEMPOTENCY_KEY error", async () => {
    clearIdempotencyCache();
    await expect(
      withIdempotency(
        { userId: "user_alpha", route: "/api/extract", key: "   ", payload: { data: 123 } },
        async () => "result",
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "INVALID_IDEMPOTENCY_KEY",
    });
  });
});
