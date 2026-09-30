import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { formatMoney, paymentKindLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getUnitReport } from "@/lib/stats";

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

export default async function UnitReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();
  const currentYear = now.getFullYear();

  let fromYear = parseYear(sp.from, currentYear);
  let toYear = parseYear(sp.to, fromYear);
  if (fromYear > toYear) {
    const t = fromYear;
    fromYear = toYear;
    toYear = t;
  }

  const [report, yearsRaw, allResidents] = await Promise.all([
    getUnitReport(id, fromYear, toYear),
    prisma.payment.findMany({
      where: { residentId: id },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "asc" },
    }),
    prisma.resident.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, active: true },
    }),
  ]);

  if (!report) notFound();

  const yearsAsc = Array.from(
    new Set([
      ...yearsRaw.map((y) => y.year),
      fromYear,
      toYear,
      currentYear,
    ]),
  ).sort((a, b) => a - b);

  const periodLabel =
    fromYear === toYear ? `سنة ${fromYear}` : `${fromYear} – ${toYear}`;
  const printedAt = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <Link href="/reports" className="text-sm text-[var(--accent)]">
            ← التقارير
          </Link>
          <h1 className="mt-2 text-2xl font-bold">تقرير الشقة</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {report.resident.name} — {periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <form
            method="get"
            action={`/reports/unit/${id}`}
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
              تحديث الفترة
            </button>
          </form>
          <PrintButton
            label="طباعة تقرير الشقة"
            documentTitle={`تقرير شقة ${report.resident.name} — ${periodLabel.replace(/\s+/g, " ")}`}
          />
        </div>
      </div>

      <div className="panel no-print space-y-3">
        <div className="text-sm font-semibold text-[var(--muted)]">تبديل الشقة</div>
        <div className="flex flex-wrap gap-1">
          {allResidents.map((r) => (
            <Link
              key={r.id}
              href={`/reports/unit/${r.id}?from=${fromYear}&to=${toYear}`}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                r.id === id
                  ? "bg-[var(--accent)] text-white border-transparent"
                  : "border-[var(--line)] bg-white"
              }`}
            >
              {r.name}
              {!r.active ? " (خرج)" : ""}
            </Link>
          ))}
        </div>
      </div>

      <article className="report-doc">
        <header className="report-hero">
          <div className="report-hero__brand">جيران المحبة</div>
          <h2 className="report-hero__title">تقرير شقة — {report.resident.name}</h2>
          <p className="report-hero__period">الفترة: {periodLabel}</p>
          <div className="report-hero__meta">
            <span>تاريخ الإصدار: {printedAt}</span>
            <span>اشتراك شهري: {formatMoney(report.resident.monthlyFee)}</span>
            <span>فترة السكن: {report.resident.occupancyLabel}</span>
            <span>{report.resident.active ? "نشط" : "خرج"}</span>
          </div>
        </header>

        <section className="report-section">
          <h3 className="report-section__title">ملخص الشقة</h3>
          <div className="report-stats">
            <ReportStat
              label="إجمالي المدفوع"
              value={formatMoney(report.totalPaid)}
              tone="income"
            />
            <ReportStat
              label="أشهر مدفوعة"
              value={String(report.paidMonthlyCount)}
              hint="اشتراك شهري"
              tone="balance"
            />
            <ReportStat
              label="أشهر متأخرة"
              value={String(report.lateCount)}
              hint="ضمن فترة السكن فقط"
              tone="expense"
            />
            <ReportStat
              label="المستحق التقريبي"
              value={formatMoney(report.owed)}
              hint="متأخر × الاشتراك"
              tone="net"
            />
          </div>
        </section>

        {report.byYear.length > 1 && (
          <section className="report-section report-break">
            <h3 className="report-section__title">ملخص حسب السنة</h3>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>السنة</th>
                    <th>عدد القيود</th>
                    <th>المدفوع</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byYear.map((y) => (
                    <tr key={y.year}>
                      <td className="tabular-nums font-semibold">{y.year}</td>
                      <td className="tabular-nums">{y.count}</td>
                      <td className="tabular-nums cell-income font-semibold">
                        {formatMoney(y.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>المجموع</td>
                    <td className="tabular-nums">{report.payments.length}</td>
                    <td className="tabular-nums cell-income">
                      {formatMoney(report.totalPaid)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        <section className="report-section report-break">
          <h3 className="report-section__title">سجل الدفعات</h3>
          {report.payments.length === 0 ? (
            <p className="report-empty">لا دفعات في هذه الفترة</p>
          ) : (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>السنة</th>
                    <th>الشهر</th>
                    <th>النوع</th>
                    <th>المبلغ</th>
                    <th>ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {report.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="tabular-nums">{p.year}</td>
                      <td className="tabular-nums">{p.month}</td>
                      <td>{paymentKindLabel(p.kind)}</td>
                      <td
                        className={`tabular-nums font-semibold ${
                          p.kind === "PRIOR_DEBT"
                            ? "text-[var(--muted)]"
                            : "cell-income"
                        }`}
                      >
                        {formatMoney(p.amount)}
                      </td>
                      <td>{p.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="report-section report-break">
          <div className="report-section__head">
            <h3 className="report-section__title">الأشهر المتأخرة</h3>
            {report.lateCount > 0 && (
              <div className="report-badge">
                {report.lateCount} شهر — مستحق {formatMoney(report.owed)}
              </div>
            )}
          </div>
          {report.lateCount === 0 ? (
            <p className="report-empty">لا تأخير في هذه الفترة</p>
          ) : (
            <div className="month-chips" style={{ paddingTop: "0.25rem" }}>
              {report.lateMonths.map((m) => (
                <span key={m.label} className="month-chip">
                  {m.label}
                </span>
              ))}
            </div>
          )}
        </section>

        <footer className="report-footer">
          <span>جيران المحبة — تقرير شقة: {report.resident.name}</span>
          <span>نهاية التقرير</span>
        </footer>
      </article>
    </div>
  );
}
