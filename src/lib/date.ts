const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REPORT_DAYS = 366;

function utcDate(date: string): Date | null {
  if (!DATE_PATTERN.test(date)) {
    return null;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date
    ? null
    : parsed;
}

export function currentLocalDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function currentLocalMonth(): string {
  return currentLocalDate().slice(0, 7);
}

export function formatVietnameseDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export function formatVietnameseMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)} năm ${year}`;
}

export function formatVietnameseDateRange(startDate: string, endDate: string): string {
  return startDate === endDate
    ? formatVietnameseDate(startDate)
    : `${formatVietnameseDate(startDate)} – ${formatVietnameseDate(endDate)}`;
}

export function addDays(date: string, amount: number): string {
  const parsed = utcDate(date);
  if (!parsed || !Number.isInteger(amount)) {
    return "";
  }

  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

export function daysInclusive(startDate: string, endDate: string): number {
  const start = utcDate(startDate);
  const end = utcDate(endDate);
  if (!start || !end || start > end) {
    return 0;
  }

  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function dateRange(startDate: string, endDate: string): string[] {
  const count = daysInclusive(startDate, endDate);
  if (count === 0 || count > MAX_REPORT_DAYS) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => addDays(startDate, index));
}

export function previousDateRange(startDate: string, endDate: string): {
  startDate: string;
  endDate: string;
} | null {
  const count = daysInclusive(startDate, endDate);
  if (count === 0) {
    return null;
  }

  const previousEnd = addDays(startDate, -1);
  return {
    startDate: addDays(previousEnd, -(count - 1)),
    endDate: previousEnd,
  };
}

export function monthDates(month: string): string[] {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return [];
  }

  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: dayCount }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

export function monthRange(month: string): { startDate: string; endDate: string } | null {
  const dates = monthDates(month);
  return dates.length > 0 ? { startDate: dates[0], endDate: dates.at(-1) ?? dates[0] } : null;
}

export function previousMonth(month: string): string {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  return previous.toISOString().slice(0, 7);
}
