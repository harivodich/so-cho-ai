import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Firestore Security Rules Contract & Safety Analysis", () => {
  const rules = readFileSync("firestore.rules", "utf8");

  it("uses Cloud Firestore Rules version 2", () => {
    expect(rules).toContain("rules_version = '2';");
    expect(rules).toContain("service cloud.firestore");
  });

  it("safely accesses optional fields using .get() to prevent runtime crashes on missing properties", () => {
    // Direct property access like `request.resource.data.phone == null` throws a runtime rule error if 'phone' is absent
    // .get() with fallback must be used instead
    expect(rules).toContain("request.resource.data.get('phone', null)");
    expect(rules).toContain("request.resource.data.get('displayName', null)");
    expect(rules).toContain("request.resource.data.get('email', null)");
    expect(rules).toContain("request.resource.data.get('revenueGoals', null)");
    expect(rules).toContain("request.resource.data.get('unitPrice', null)");
    expect(rules).toContain("request.resource.data.get('quantity', null)");
    expect(rules).not.toMatch(/request\.resource\.data\.phone\s*==\s*null/);
    expect(rules).not.toMatch(/request\.resource\.data\.monthlyRevenueGoal/);
  });

  it("enforces schema and numeric non-negative bounds across transactions and debts", () => {
    expect(rules).toContain("validNumber(request.resource.data.amount, 0, 1000000000000)");
    expect(rules).toContain("request.resource.data.type in ['sale', 'purchase', 'expense']");
    expect(rules).toContain("request.resource.data.direction in ['receivable', 'payable']");
    expect(rules).toContain("validString(request.resource.data.partyName, 200)");
    expect(rules).toContain("validNumber(request.resource.data.quantityDelta, -10000000, 10000000)");
    expect(rules).toContain("request.resource.data.get('defaultUnit', null)");
    expect(rules).toContain("request.resource.data.get('itemName', null)");
  });

  it("restricts /idempotency_records to server-only Firebase Admin access", () => {
    expect(rules).toContain("match /idempotency_records/{recordId}");
    expect(rules).toContain("allow read, write: if false;");
  });

  it("verifies collection scope and ownership", () => {
    expect(rules).toContain("match /users/{userId}/transactions/{transactionId}");
    expect(rules).toContain("match /users/{userId}/profile/{document=**}");
    expect(rules).toContain("match /users/{userId}/settings/{document=**}");
    expect(rules).toContain("match /users/{userId}/debts/{debtId}");
    expect(rules).toContain("match /users/{userId}/products/{productId}");
    expect(rules).toContain("match /users/{userId}/stockMovements/{movementId}");
    expect(rules).toContain("match /users/{userId}/counterparties/{counterpartyId}");
  });
});
