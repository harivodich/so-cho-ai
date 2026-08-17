import { describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES, validateImageUpload } from "@/lib/extraction/image-validation";

describe("validateImageUpload", () => {
  it("accepts supported images up to 5 MB", () => {
    expect(validateImageUpload(MAX_IMAGE_BYTES, "image/jpeg")).toEqual({ valid: true });
    expect(validateImageUpload(1024, "image/png")).toEqual({ valid: true });
    expect(validateImageUpload(1024, "image/webp")).toEqual({ valid: true });
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(validateImageUpload(0, "image/jpeg")).toMatchObject({ valid: false, status: 400 });
    expect(validateImageUpload(1024, "application/pdf")).toMatchObject({ valid: false, status: 400 });
    expect(validateImageUpload(MAX_IMAGE_BYTES + 1, "image/jpeg")).toMatchObject({ valid: false, status: 413 });
  });
});
