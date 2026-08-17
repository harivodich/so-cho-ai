import { z } from "zod";

export const counterpartySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Counterparty = z.infer<typeof counterpartySchema>;
