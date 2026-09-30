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
