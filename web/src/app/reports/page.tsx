import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  getArrears,
  getBalanceThroughYear,
  monthlyBreakdownRange,
  sumCashIncomeRange,
  sumExpensesRange,
  yearlyBreakdownRange,
} from "@/lib/stats";

function parseYear(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : fallback;
}

function ReportStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "income" | "expense" | "net" | "balance";
}) {
  return (
    <div className={`report-stat report-stat--${tone}`}>
      <div className="report-stat__label">{label}</div>
      <div className="report-stat__value tabular-nums">{value}</div>
      {hint ? <div className="report-stat__hint">{hint}</div> : null}
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const currentYear = now.getFullYear();

  const legacyYear = sp.year ? parseYear(sp.year, currentYear) : null;
  let fromYear = parseYear(sp.from, legacyYear ?? currentYear);
  let toYear = parseYear(sp.to, legacyYear ?? fromYear);
  if (fromYear > toYear) {
    const t = fromYear;
    fromYear = toYear;
    toYear = t;
  }

  const [yearsFromPay, yearsFromExp] = await Promise.all([
    prisma.payment.findMany({
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
    prisma.expense.findMany({
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
  ]);

  const years = Array.from(
    new Set([
      ...yearsFromPay.map((y) => y.year),
      ...yearsFromExp.map((y) => y.year),
      fromYear,
      toYear,
      currentYear,
    ]),
  ).sort((a, b) => b - a);

  const yearsAsc = [...years].sort((a, b) => a - b);

  const [
    incomePeriod,
    expensePeriod,
    throughYear,
    yearlyRows,
    monthlyRows,
    categories,
    arrears,
    residents,
  ] = await Promise.all([
    sumCashIncomeRange(fromYear, toYear),
    sumExpensesRange(fromYear, toYear),
    getBalanceThroughYear(toYear),
    yearlyBreakdownRange(fromYear, toYear),
    monthlyBreakdownRange(fromYear, toYear),
    prisma.expenseCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        expenses: {
          where: { year: { gte: fromYear, lte: toYear } },
        },
      },
    }),
    getArrears(fromYear, toYear),
    prisma.resident.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, active: true },
    }),
  ]);

  const periodNet = incomePeriod - expensePeriod;
  const periodLabel =
    fromYear === toYear ? `سنة ${fromYear}` : `${fromYear} – ${toYear}`;
  const printedAt = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const byCategory = categories
    .map((c) => ({
      name: c.name,
      total: c.expenses.reduce((s, e) => s + e.amount, 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const monthsWithActivity = monthlyRows.filter(
    (m) => m.income > 0 || m.expense > 0,
  );

  const totalArrearsOwed = arrears.reduce((s, r) => s + r.owed, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold">التقارير</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            اختر الفترة ثم اطبع التقرير بألوان واضحة
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <form
            method="get"
            action="/reports"
            className="flex flex-wrap items-end gap-2"
          >
            <div className="field">
              <label>من سنة</label>
              <select name="from" defaultValue={fromYear}>
                {yearsAsc.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>إلى سنة</label>
              <select name="to" defaultValue={toYear}>
                {yearsAsc.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary">
              عرض التقرير
            </button>
          </form>
          <PrintButton
            documentTitle={`تقرير جيران المحبة — ${periodLabel.replace(/\s+/g, " ")}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 no-print">
        {years.slice(0, 8).map((y) => (
          <Link
            key={y}
            href={`/reports?from=${y}&to=${y}`}
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              fromYear === y && toYear === y
                ? "bg-[var(--accent)] text-white border-transparent"
                : "border-[var(--line)] bg-white"
            }`}
          >
            {y}
          </Link>
        ))}
        {yearsAsc.length > 1 && (
          <Link
            href={`/reports?from=${yearsAsc[0]}&to=${yearsAsc[yearsAsc.length - 1]}`}
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              fromYear === yearsAsc[0] &&
              toYear === yearsAsc[yearsAsc.length - 1]
                ? "bg-[var(--accent)] text-white border-transparent"
                : "border-[var(--line)] bg-white"
            }`}
          >
            كل السنوات
          </Link>
        )}
      </div>

      <section className="panel no-print space-y-3">
        <h2 className="font-bold text-[var(--accent)]">تقرير شقة</h2>
        <p className="text-sm text-[var(--muted)]">
          اختر الشقة لاستخراج تقرير مستقل قابل للطباعة لنفس الفترة ({periodLabel}).
        </p>
        <div className="flex flex-wrap gap-2">
          {residents.map((r) => (
            <Link
              key={r.id}
              href={`/reports/unit/${r.id}?from=${fromYear}&to=${toYear}`}
              className="btn btn-primary text-sm"
            >
              تقرير: {r.name}
              {!r.active ? " (خرج)" : ""}
            </Link>
          ))}
        </div>
      </section>

      <article className="report-doc">
        <header className="report-hero">
          <div className="report-hero__brand">جيران المحبة</div>
          <h2 className="report-hero__title">تقرير صندوق خدمات البناية</h2>
          <p className="report-hero__period">الفترة: {periodLabel}</p>
          <div className="report-hero__meta">
            <span>تاريخ الإصدار: {printedAt}</span>
            <span>الأرقام بالدينار</span>
          </div>
        </header>

        <section className="report-section">
          <h3 className="report-section__title">ملخص الفترة</h3>
          <div className="report-stats">
            <ReportStat
              label="إيرادات الفترة"
              value={formatMoney(incomePeriod)}
              tone="income"
            />
            <ReportStat
              label="مصاريف الفترة"
              value={formatMoney(expensePeriod)}
              tone="expense"
            />
            <ReportStat
              label="صافي الفترة"
              value={formatMoney(periodNet)}
              tone="net"
            />
            <ReportStat
              label={`رصيد حتى نهاية ${toYear}`}
              value={formatMoney(throughYear.balance)}
              hint="تراكمي من البداية"
              tone="balance"
            />
          </div>
        </section>

        {yearlyRows.length > 1 && (
          <section className="report-section report-break">
            <h3 className="report-section__title">ملخص حسب السنة</h3>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>السنة</th>
                    <th>الإيرادات</th>
                    <th>المصاريف</th>
                    <th>الصافي</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyRows.map((y) => (
                    <tr key={y.year}>
                      <td className="tabular-nums font-semibold">{y.year}</td>
                      <td className="tabular-nums cell-income">
                        {formatMoney(y.income)}
                      </td>
                      <td className="tabular-nums cell-expense">
                        {formatMoney(y.expense)}
                      </td>
                      <td
                        className={`tabular-nums font-semibold ${
                          y.net >= 0 ? "cell-income" : "cell-expense"
                        }`}
                      >
                        {formatMoney(y.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>المجموع</td>
                    <td className="tabular-nums cell-income">
                      {formatMoney(incomePeriod)}
                    </td>
                    <td className="tabular-nums cell-expense">
                      {formatMoney(expensePeriod)}
                    </td>
                    <td
                      className={`tabular-nums ${
                        periodNet >= 0 ? "cell-income" : "cell-expense"
                      }`}
                    >
                      {formatMoney(periodNet)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        <section className="report-section report-break">
          <h3 className="report-section__title">التفصيل الشهري</h3>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>السنة</th>
                  <th>الشهر</th>
                  <th>الإيرادات</th>
                  <th>المصاريف</th>
                  <th>الصافي</th>
                </tr>
              </thead>
              <tbody>
                {monthsWithActivity.map((m) => (
                  <tr key={`${m.year}-${m.month}`}>
                    <td className="tabular-nums">{m.year}</td>
                    <td className="tabular-nums">{m.month}</td>
                    <td className="tabular-nums cell-income">
                      {formatMoney(m.income)}
                    </td>
                    <td className="tabular-nums cell-expense">
                      {formatMoney(m.expense)}
                    </td>
                    <td
                      className={`tabular-nums font-semibold ${
                        m.net >= 0 ? "cell-income" : "cell-expense"
                      }`}
                    >
                      {formatMoney(m.net)}
                    </td>
                  </tr>
                ))}
                {monthsWithActivity.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-[var(--muted)]">
                      لا حركة في هذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>المجموع</td>
                  <td className="tabular-nums cell-income">
                    {formatMoney(incomePeriod)}
                  </td>
                  <td className="tabular-nums cell-expense">
                    {formatMoney(expensePeriod)}
                  </td>
                  <td
                    className={`tabular-nums ${
                      periodNet >= 0 ? "cell-income" : "cell-expense"
                    }`}
                  >
                    {formatMoney(periodNet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="report-section report-break">
          <h3 className="report-section__title">توزيع المصاريف حسب البند</h3>
          {byCategory.length === 0 ? (
            <p className="report-empty">لا مصاريف لهذه الفترة</p>
          ) : (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>البند</th>
                    <th>المبلغ</th>
                    <th>النسبة</th>
                    <th className="report-bar-col">التوزيع</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((c) => {
                    const pct =
                      expensePeriod > 0
                        ? (c.total / expensePeriod) * 100
                        : 0;
                    return (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td className="tabular-nums font-semibold cell-expense">
                          {formatMoney(c.total)}
                        </td>
                        <td className="tabular-nums">
                          {pct.toFixed(1)}%
                        </td>
                        <td className="report-bar-col">
                          <div className="report-bar">
                            <span style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="report-section report-break">
          <div className="report-section__head">
            <h3 className="report-section__title">المتأخرون عن الاشتراك</h3>
            {arrears.length > 0 && (
              <div className="report-badge">
                إجمالي تقريبي: {formatMoney(totalArrearsOwed)}
              </div>
            )}
          </div>
          {arrears.length === 0 ? (
            <p className="report-empty">لا متأخرين في هذه الفترة</p>
          ) : (
            <div className="report-table-wrap">
              <table className="report-table report-table--arrears">
                <thead>
                  <tr>
                    <th className="col-name">الجار / الشقة</th>
                    <th>الأشهر المتأخرة</th>
                    <th className="col-count">العدد</th>
                    <th className="col-owed">المستحق</th>
                    <th className="no-print" style={{ width: "5rem" }}>
                      تقرير
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {arrears.map((r) => (
                    <tr key={r.residentId}>
                      <td className="col-name">
                        <Link
                          href={`/residents/${r.residentId}`}
                          className="report-link"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="cell-wrap">
                        <div className="month-chips">
                          {r.lateMonths.map((m) => (
                            <span key={m.label} className="month-chip">
                              {m.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="tabular-nums font-semibold col-count cell-warn">
                        {r.count}
                      </td>
                      <td className="tabular-nums font-semibold col-owed cell-warn">
                        {formatMoney(r.owed)}
                      </td>
                      <td className="no-print">
                        <Link
                          href={`/reports/unit/${r.residentId}?from=${fromYear}&to=${toYear}`}
                          className="btn btn-ghost text-xs py-1"
                        >
                          تقرير
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="report-footer">
          <span>جيران المحبة — إدارة خدمات البناية</span>
          <span>نهاية التقرير</span>
        </footer>
      </article>
    </div>
  );
}
