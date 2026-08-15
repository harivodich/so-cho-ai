import { describe, expect, it } from "vitest";

import { vietnamDateKey } from "../src/lib/extraction/quota";

describe("vietnamDateKey", () => {
  it("uses the Vietnam calendar day instead of the server UTC day", () => {
    expect(vietnamDateKey(new Date("2026-08-11T17:30:00.000Z"))).toBe("2026-08-12");
    expect(vietnamDateKey(new Date("2026-08-12T16:30:00.000Z"))).toBe("2026-08-12");
  });
});
