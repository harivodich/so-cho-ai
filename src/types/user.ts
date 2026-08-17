import { z } from "zod";

export const userProfileSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().trim().max(120).nullable(),
  email: z.string().email().nullable(),
  photoURL: z.string().url().nullable(),
  providerIds: z.array(z.string().min(1)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const userSettingsSchema = z.object({
  uid: z.string().min(1),
  currency: z.literal("VND"),
  defaultUnit: z.string().trim().min(1).max(32),
  lowStockAlertsEnabled: z.boolean(),
  updatedAt: z.string().datetime(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;
