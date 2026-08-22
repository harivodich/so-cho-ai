import { describe, expect, it, vi, beforeEach } from "vitest";
import { FirebaseTransactionRepository } from "@/lib/transactions/firebase-repository";
import { FirebaseDebtRepository } from "@/lib/debts/firebase-repository";
import { FirebaseCounterpartyRepository } from "@/lib/counterparties/firebase-repository";
import { FirebaseCatalogRepository } from "@/lib/catalog/firebase-repository";

// Mock Firebase Client and Firestore Batch methods
const committedBatches: Array<Array<{ ref: { id: string } }>> = [];
let currentBatchOps: Array<{ ref: { id: string } }> = [];

const mockWriteBatch = vi.fn(() => ({
  delete: vi.fn((ref: { id: string }) => {
    currentBatchOps.push({ ref });
  }),
  commit: vi.fn(async () => {
    committedBatches.push([...currentBatchOps]);
    currentBatchOps = [];
  }),
}));

let mockDocs: Array<{ ref: { id: string } }> = [];

vi.mock("firebase/firestore/lite", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({
    docs: mockDocs,
  })),
  writeBatch: (db: unknown) => mockWriteBatch(db),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseClient: vi.fn(() => ({
    auth: { currentUser: { uid: "test_user_chunking" } },
    db: {},
  })),
  isFirebaseConfigured: vi.fn(() => true),
  configureFirebaseClient: vi.fn(),
}));

describe("Firestore Batch Chunking Boundary Contract (max 450 per batch)", () => {
  beforeEach(() => {
    committedBatches.length = 0;
    currentBatchOps = [];
    vi.clearAllMocks();
  });

  function generateDocs(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      ref: { id: `doc_${i}` },
    }));
  }

  it("handles empty collection (0 documents) without creating unnecessary commits", async () => {
    mockDocs = generateDocs(0);
    const repo = new FirebaseTransactionRepository();
    await repo.clear();

    expect(committedBatches.length).toBe(0);
  });

  it("handles 449 documents in a single batch (below 450 limit)", async () => {
    mockDocs = generateDocs(449);
    const repo = new FirebaseTransactionRepository();
    await repo.clear();

    expect(committedBatches.length).toBe(1);
    expect(committedBatches[0].length).toBe(449);
  });

  it("handles exactly 450 documents in exactly 1 batch", async () => {
    mockDocs = generateDocs(450);
    const repo = new FirebaseDebtRepository();
    await repo.clear();

    expect(committedBatches.length).toBe(1);
    expect(committedBatches[0].length).toBe(450);
  });

  it("splits 451 documents across 2 batches (450 + 1)", async () => {
    mockDocs = generateDocs(451);
    const repo = new FirebaseCounterpartyRepository();
    await repo.clear();

    expect(committedBatches.length).toBe(2);
    expect(committedBatches[0].length).toBe(450);
    expect(committedBatches[1].length).toBe(1);
  });

  it("splits 900 documents across exactly 2 batches of 450", async () => {
    mockDocs = generateDocs(450); // catalog merges product + movement snapshots
    const repo = new FirebaseCatalogRepository();
    await repo.clear();

    // 450 products + 450 movements = 900 docs -> 2 batches of 450
    expect(committedBatches.length).toBe(2);
    expect(committedBatches[0].length).toBe(450);
    expect(committedBatches[1].length).toBe(450);
  });
});
