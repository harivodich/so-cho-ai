import { describe, expect, it } from "vitest";

import { transactionDraftsJsonSchema } from "@/lib/extraction/schema";

describe("Gemini structured output contract", () => {
  it("uses Gemini-compatible nullable fields instead of JSON-schema union arrays", () => {
    const properties = transactionDraftsJsonSchema.items.properties;

    expect(properties.type).toMatchObject({ type: "string", nullable: true });
    expect(properties.quantity).toMatchObject({ type: "number", nullable: true });
    expect(properties.amount).toMatchObject({ type: "number", nullable: true });
    expect(properties.occurredAt).toMatchObject({ type: "string", nullable: true });
  });
});
