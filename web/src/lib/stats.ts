import { prisma } from "@/lib/prisma";

/** مقارنة سنة/شهر كرقم واحد */
export function yearMonthKey(year: number, month: number) {
  return year * 12 + month;
}

export function isMonthInOccupancy(
  year: number,
  month: number,
  activeFromYear: number,
  activeFromMonth: number,
  activeToYear: number | null | undefined,
  activeToMonth: number | null | undefined,
) {
  const t = yearMonthKey(year, month);
  if (t < yearMonthKey(activeFromYear, activeFromMonth)) return false;
  if (
    activeToYear != null &&
    activeToMonth != null &&
    t > yearMonthKey(activeToYear, activeToMonth)
  ) {
    return false;
  }
  return true;
}

export function formatOccupancyLabel(r: {
  activeFromYear: number;
  activeFromMonth: number;
  activeToYear: number | null;
  activeToMonth: number | null;
}) {
  const from = `${r.activeFromYear}/${r.activeFromMonth}`;
  if (r.activeToYear != null && r.activeToMonth != null) {
    return `${from} → ${r.activeToYear}/${r.activeToMonth}`;
  }
  return `${from} → الآن`;
}

/** إيرادات نقدية فقط (بدون مستحقات سابقة غير المحصّلة كقيد افتتاحي) */
export async function sumCashIncome(where: { year?: number; month?: number } = {}) {
  const result = await prisma.payment.aggregate({
    where: {
      ...where,
      kind: { not: "PRIOR_DEBT" },
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function sumExpenses(where: { year?: number; month?: number } = {}) {
  const result = await prisma.expense.aggregate({
    where,
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function sumCashIncomeRange(fromYear: number, toYear: number) {
  const result = await prisma.payment.aggregate({
    where: {
      kind: { not: "PRIOR_DEBT" },
      year: { gte: fromYear, lte: toYear },
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function sumExpensesRange(fromYear: number, toYear: number) {
  const result = await prisma.expense.aggregate({
    where: { year: { gte: fromYear, lte: toYear } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function getFundBalance() {
  const [income, expenses] = await Promise.all([
    sumCashIncome(),
    sumExpenses(),
  ]);
  return { income, expenses, balance: income - expenses };
}

/** رصيد الصندوق حتى نهاية سنة معينة */
export async function getBalanceThroughYear(year: number) {
  const [income, expenses] = await Promise.all([
    prisma.payment.aggregate({
      where: { kind: { not: "PRIOR_DEBT" }, year: { lte: year } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { year: { lte: year } },
      _sum: { amount: true },
    }),
  ]);
  const incomeTotal = income._sum.amount ?? 0;
  const expenseTotal = expenses._sum.amount ?? 0;
  return {
    income: incomeTotal,
    expenses: expenseTotal,
    balance: incomeTotal - expenseTotal,
  };
}

export async function monthlyBreakdown(year: number) {
  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { year, kind: { not: "PRIOR_DEBT" } },
      select: { month: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { year },
      select: { month: true, amount: true },
    }),
  ]);

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const income = payments
      .filter((p) => p.month === month)
      .reduce((s, p) => s + p.amount, 0);
    const expense = expenses
      .filter((e) => e.month === month)
      .reduce((s, e) => s + e.amount, 0);
    return { month, income, expense, net: income - expense };
  });
}

export async function monthlyBreakdownRange(fromYear: number, toYear: number) {
  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        kind: { not: "PRIOR_DEBT" },
        year: { gte: fromYear, lte: toYear },
      },
      select: { year: true, month: true, amount: true },
    }),
    prisma.expense.findMany({
      where: { year: { gte: fromYear, lte: toYear } },
      select: { year: true, month: true, amount: true },
    }),
  ]);

  const rows: {
    year: number;
    month: number;
    income: number;
    expense: number;
    net: number;
  }[] = [];

  for (let year = fromYear; year <= toYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const income = payments
        .filter((p) => p.year === year && p.month === month)
        .reduce((s, p) => s + p.amount, 0);
      const expense = expenses
        .filter((e) => e.year === year && e.month === month)
        .reduce((s, e) => s + e.amount, 0);
      rows.push({
        year,
        month,
        income,
        expense,
        net: income - expense,
      });
    }
  }

  return rows;
}

export async function yearlyBreakdownRange(fromYear: number, toYear: number) {
  const months = await monthlyBreakdownRange(fromYear, toYear);
  const result: {
    year: number;
    income: number;
    expense: number;
    net: number;
  }[] = [];

  for (let year = fromYear; year <= toYear; year++) {
    const yearRows = months.filter((m) => m.year === year);
    const income = yearRows.reduce((s, m) => s + m.income, 0);
    const expense = yearRows.reduce((s, m) => s + m.expense, 0);
    result.push({ year, income, expense, net: income - expense });
  }

  return result;
}

export type ArrearsRow = {
  residentId: string;
  name: string;
  monthlyFee: number;
  lateMonths: { year: number; month: number; label: string }[];
  count: number;
  owed: number;
};

/** أشهر متأخرة ضمن فترة سكن كل جار (وليس أشهر الشغور) */
export async function getArrears(fromYear: number, toYear: number): Promise<ArrearsRow[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const residents = await prisma.resident.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      payments: {
        where: {
          kind: "MONTHLY",
          year: { gte: fromYear, lte: toYear },
        },
        select: { year: true, month: true },
      },
    },
  });

  const paid = new Set<string>();
  for (const r of residents) {
    for (const p of r.payments) {
      paid.add(`${r.id}:${p.year}-${p.month}`);
    }
  }

  const rows: ArrearsRow[] = [];

  for (const r of residents) {
    const lateMonths: ArrearsRow["lateMonths"] = [];

    for (let year = fromYear; year <= toYear; year++) {
      for (let month = 1; month <= 12; month++) {
        if (year > currentYear || (year === currentYear && month > currentMonth)) {
          continue;
        }
        if (
          !isMonthInOccupancy(
            year,
            month,
            r.activeFromYear,
            r.activeFromMonth,
            r.activeToYear,
            r.activeToMonth,
          )
        ) {
          continue;
        }
        if (!paid.has(`${r.id}:${year}-${month}`)) {
          lateMonths.push({
            year,
            month,
            label: `${year}/${month}`,
          });
        }
      }
    }

    if (lateMonths.length === 0) continue;

    rows.push({
      residentId: r.id,
      name: r.name,
      monthlyFee: r.monthlyFee,
      lateMonths,
      count: lateMonths.length,
      owed: lateMonths.length * r.monthlyFee,
    });
  }

  return rows.sort((a, b) => b.count - a.count);
}

export type UnitReport = {
  resident: {
    id: string;
    name: string;
    monthlyFee: number;
    active: boolean;
    activeFromYear: number;
    activeFromMonth: number;
    activeToYear: number | null;
    activeToMonth: number | null;
    occupancyLabel: string;
  };
  payments: {
    id: string;
    year: number;
    month: number;
    amount: number;
    kind: string;
    note: string | null;
  }[];
  paidMonthlyCount: number;
  totalPaid: number;
  lateMonths: { year: number; month: number; label: string }[];
  lateCount: number;
  owed: number;
  byYear: { year: number; total: number; count: number }[];
};

export async function getUnitReport(
  residentId: string,
  fromYear: number,
  toYear: number,
): Promise<UnitReport | null> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const resident = await prisma.resident.findUnique({
    where: { id: residentId },
    include: {
      payments: {
        where: { year: { gte: fromYear, lte: toYear } },
        orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!resident) return null;

  const monthlyPaid = new Set(
    resident.payments
      .filter((p) => p.kind === "MONTHLY")
      .map((p) => `${p.year}-${p.month}`),
  );

  const lateMonths: UnitReport["lateMonths"] = [];
  for (let year = fromYear; year <= toYear; year++) {
    for (let month = 1; month <= 12; month++) {
      if (year > currentYear || (year === currentYear && month > currentMonth)) {
        continue;
      }
      if (
        !isMonthInOccupancy(
          year,
          month,
          resident.activeFromYear,
          resident.activeFromMonth,
          resident.activeToYear,
          resident.activeToMonth,
        )
      ) {
        continue;
      }
      if (!monthlyPaid.has(`${year}-${month}`)) {
        lateMonths.push({ year, month, label: `${year}/${month}` });
      }
    }
  }

  const cashPayments = resident.payments.filter((p) => p.kind !== "PRIOR_DEBT");
  const totalPaid = cashPayments.reduce((s, p) => s + p.amount, 0);

  const yearMap = new Map<number, { total: number; count: number }>();
  for (const p of cashPayments) {
    const cur = yearMap.get(p.year) ?? { total: 0, count: 0 };
    cur.total += p.amount;
    cur.count += 1;
    yearMap.set(p.year, cur);
  }

  const byYear = Array.from(yearMap.entries())
    .map(([year, v]) => ({ year, total: v.total, count: v.count }))
    .sort((a, b) => a.year - b.year);

  const occupancyLabel = formatOccupancyLabel(resident);

  return {
    resident: {
      id: resident.id,
      name: resident.name,
      monthlyFee: resident.monthlyFee,
      active: resident.active,
      activeFromYear: resident.activeFromYear,
      activeFromMonth: resident.activeFromMonth,
      activeToYear: resident.activeToYear,
      activeToMonth: resident.activeToMonth,
      occupancyLabel,
    },
    payments: resident.payments.map((p) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      amount: p.amount,
      kind: p.kind,
      note: p.note,
    })),
    paidMonthlyCount: monthlyPaid.size,
    totalPaid,
    lateMonths,
    lateCount: lateMonths.length,
    owed: lateMonths.length * resident.monthlyFee,
    byYear,
  };
}
