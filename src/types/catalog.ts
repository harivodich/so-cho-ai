import { z } from "zod";

export const productSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  canonicalName: z.string().trim().min(1).max(120),
  defaultUnit: z.string().trim().min(1).max(32),
  lowStockThreshold: z.number().finite().nonnegative(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Product = z.infer<typeof productSchema>;

export const stockMovementKinds = ["purchase", "sale", "adjustment"] as const;
export type StockMovementKind = (typeof stockMovementKinds)[number];

export const stockMovementSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  productId: z.string().min(1),
  itemName: z.string().trim().min(1).max(120),
  canonicalItemName: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(32),
  kind: z.enum(stockMovementKinds),
  quantityDelta: z.number().finite().refine((value) => value !== 0, "quantityDelta must not be zero"),
  reason: z.string().trim().max(500).nullable(),
  sourceTransactionId: z.string().min(1).nullable(),
  occurredAt: z.string().date(),
  createdAt: z.string().datetime(),
});

export type StockMovement = z.infer<typeof stockMovementSchema>;

export type ProductStock = Product & {
  quantity: number;
  isLow: boolean;
  isNegative: boolean;
};
