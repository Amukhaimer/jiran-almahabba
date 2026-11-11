export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("ar", {
    month: "long",
    year: "numeric",
    numberingSystem: "latn",
  }).format(new Date(year, month - 1, 1));
}

export const MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function paymentKindLabel(kind: string): string {
  switch (kind) {
    case "PRIOR_DEBT":
      return "مستحقات سابقة";
    case "SETTLEMENT":
      return "دفعة سداد";
    default:
      return "اشتراك شهري";
  }
}

/**
 * Every year from the earliest given year up to the latest (at least the current year),
 * ascending. Year pickers use this so years without records are still selectable.
 */
export function fillYearRange(years: number[]): number[] {
  const current = new Date().getFullYear();
  const valid = years.filter((y) => Number.isInteger(y) && y >= 2000 && y <= current + 5);
  const min = Math.min(current, ...valid);
  const max = Math.max(current, ...valid);
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}
