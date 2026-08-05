export const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatVnd(amount: number): string {
  return VND_FORMATTER.format(Math.round(amount));
}

export function parseVnd(value: string): number | null {
  const normalized = value.replace(/[^0-9]/g, "");
  if (!normalized) {
    return null;
  }

  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
