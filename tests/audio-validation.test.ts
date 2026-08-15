import { describe, expect, it } from "vitest";

import { MAX_AUDIO_BYTES, validateAudioUpload } from "@/lib/extraction/audio-validation";

describe("validateAudioUpload", () => {
  it("accepts supported audio at the exact 5 MB boundary, including browser WebM", () => {
    expect(validateAudioUpload(MAX_AUDIO_BYTES, "audio/wav")).toEqual({ valid: true });
    expect(validateAudioUpload(128, "audio/webm;codecs=opus")).toEqual({ valid: true });
  });

  it("rejects empty, oversized, and fractional payload sizes", () => {
    expect(validateAudioUpload(0, "audio/wav")).toMatchObject({ valid: false, status: 413 });
    expect(validateAudioUpload(MAX_AUDIO_BYTES + 1, "audio/wav")).toMatchObject({ valid: false, status: 413 });
    expect(validateAudioUpload(10.5, "audio/wav")).toMatchObject({ valid: false, status: 413 });
  });

  it("rejects unsupported MIME types before model extraction", () => {
    expect(validateAudioUpload(128, "text/plain")).toEqual({
      valid: false,
      status: 415,
      message: "Định dạng audio chưa hỗ trợ. Hãy ghi lại bằng trình duyệt hiện tại.",
    });
  });
});
