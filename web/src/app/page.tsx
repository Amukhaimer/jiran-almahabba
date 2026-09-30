import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { formatMoney, MONTH_NAMES } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getFundBalance, sumCashIncome, sumExpenses } from "@/lib/stats";

export default async function HomePage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    fund,
    incomeYear,
    expenseYear,
    incomeMonth,
    expenseMonth,
    residents,
    recentPayments,
    recentExpenses,
  ] = await Promise.all([
    getFundBalance(),
    sumCashIncome({ year }),
    sumExpenses({ year }),
    sumCashIncome({ year, month }),
    sumExpenses({ year, month }),
    prisma.resident.findMany({
      where: { active: true },
      include: {
        payments: {
          where: { year, month, kind: "MONTHLY" },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.payment.findMany({
      take: 8,
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      include: { resident: true },
    }),
    prisma.expense.findMany({
      take: 8,
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      include: { category: true },
    }),
  ]);

  const unpaid = residents.filter((r) => r.payments.length === 0);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[var(--hero-1)] to-[var(--hero-2)] px-6 py-10 text-white shadow-lg">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.12), transparent 35%)",
          }}
        />
        <div className="relative">
          <p className="text-white/75 text-sm mb-2">صندوق خدمات البناية</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            جيران المحبة
          </h1>
          <p className="mt-2 max-w-xl text-white/85">
            متابعة الاشتراكات الشهرية والمصاريف والرصيد من مكان واحد.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/payments?add=1"
              className="btn bg-white text-[var(--hero-1)]"
            >
              + دفعة
            </Link>
            <Link
              href="/expenses?add=1"
              className="btn border border-white/40 text-white hover:bg-white/10"
            >
              + مصروف
            </Link>
            <Link
              href="/reports"
              className="btn border border-white/40 text-white hover:bg-white/10"
            >
              التقارير
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="رصيد الصندوق"
          value={formatMoney(fund.balance)}
          hint="إيرادات نقدية − مصاريف"
          tone={fund.balance >= 0 ? "good" : "bad"}
        />
        <StatCard label={`إيرادات ${year}`} value={formatMoney(incomeYear)} />
        <StatCard label={`مصاريف ${year}`} value={formatMoney(expenseYear)} />
        <StatCard
          label={`هذا الشهر (${MONTH_NAMES[month - 1]})`}
          value={`${formatMoney(incomeMonth)} / ${formatMoney(expenseMonth)}`}
          hint="إيراد / مصروف"
        />
      </section>

      {unpaid.length > 0 && (
        <section className="panel border-[var(--warn)]/30 bg-[#fff8e8]">
          <h2 className="font-bold text-[var(--warn)]">
            لم يدفعوا اشتراك {MONTH_NAMES[month - 1]} {year}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {unpaid.map((r) => (
              <Link
                key={r.id}
                href={`/residents/${r.id}`}
                className="rounded-full bg-white px-3 py-1 text-sm border border-[var(--line)]"
              >
                {r.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">آخر الإيرادات</h2>
            <Link href="/payments" className="text-sm text-[var(--accent)]">
              عرض الكل
            </Link>
          </div>
          <div className="table-wrap border-0">
            <table className="data">
              <thead>
                <tr>
                  <th>الجار</th>
                  <th>الفترة</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.resident.name}</td>
                    <td>
                      {MONTH_NAMES[p.month - 1]} {p.year}
                    </td>
                    <td className="tabular-nums font-semibold text-[var(--good)]">
                      {formatMoney(p.amount)}
                    </td>
                  </tr>
                ))}
                {recentPayments.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-[var(--muted)]">
                      لا توجد دفعات بعد — شغّل استيراد الإكسل
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">آخر المصاريف</h2>
            <Link href="/expenses" className="text-sm text-[var(--accent)]">
              عرض الكل
            </Link>
          </div>
          <div className="table-wrap border-0">
            <table className="data">
              <thead>
                <tr>
                  <th>البند</th>
                  <th>الفترة</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.category.name}
                      {e.note ? (
                        <div className="text-xs text-[var(--muted)]">
                          {e.note}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {MONTH_NAMES[e.month - 1]} {e.year}
                    </td>
                    <td className="tabular-nums font-semibold text-[var(--bad)]">
                      {formatMoney(e.amount)}
                    </td>
                  </tr>
                ))}
                {recentExpenses.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-[var(--muted)]">
                      لا توجد مصاريف بعد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="text-sm text-[var(--muted)]">
        الإجمالي التراكمي: إيرادات نقدية {formatMoney(fund.income)} — مصاريف{" "}
        {formatMoney(fund.expenses)}
      </section>
    </div>
  );
}
