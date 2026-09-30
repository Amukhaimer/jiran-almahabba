import { Suspense } from "react";
import { AddPanel } from "@/components/AddPanel";
import { ConfirmForm } from "@/components/ConfirmForm";
import { EditToggle } from "@/components/EditToggle";
import {
  createCategory,
  createExpense,
  deleteExpense,
  updateExpense,
} from "@/lib/actions";
import { formatMoney, MONTH_NAMES } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; add?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();

  const [categories, expenses, yearsRaw] = await Promise.all([
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.expense.findMany({
      where: { year },
      include: { category: true },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
    }),
    prisma.expense.findMany({
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
  ]);

  const years = yearsRaw.map((y) => y.year);
  if (!years.includes(year)) years.unshift(year);
  const yearTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = categories.map((c) => ({
    name: c.name,
    total: expenses
      .filter((e) => e.categoryId === c.id)
      .reduce((s, e) => s + e.amount, 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">المصاريف</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            إجمالي {year}:{" "}
            <span className="font-semibold text-[var(--bad)]">
              {formatMoney(yearTotal)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1 no-print">
          {years.map((y) => (
            <a
              key={y}
              href={`/expenses?year=${y}`}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                y === year
                  ? "bg-[var(--accent)] text-white border-transparent"
                  : "border-[var(--line)] bg-white"
              }`}
            >
              {y}
            </a>
          ))}
        </div>
      </div>

      {byCategory.some((c) => c.total > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {byCategory
            .filter((c) => c.total > 0)
            .map((c) => (
              <div
                key={c.name}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="text-xs text-[var(--muted)]">{c.name}</div>
                <div className="mt-1 font-bold tabular-nums">
                  {formatMoney(c.total)}
                </div>
              </div>
            ))}
        </div>
      )}

      <Suspense fallback={null}>
        <AddPanel label="إضافة مصروف">
          <ConfirmForm
            message="هل أنت متأكد من حفظ المصروف؟"
            action={createExpense}
            className="panel grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <div className="field lg:col-span-2">
              <label>البند</label>
              <select name="categoryId" required defaultValue="">
                <option value="" disabled>
                  اختر البند
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>السنة</label>
              <input name="year" type="number" required defaultValue={year} />
            </div>
            <div className="field">
              <label>الشهر</label>
              <select name="month" defaultValue={now.getMonth() + 1}>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>المبلغ</label>
              <input name="amount" type="number" step="0.001" required />
            </div>
            <div className="field lg:col-span-4">
              <label>ملاحظة</label>
              <input name="note" placeholder="مثال: صيانة المصعد" />
            </div>
            <div className="flex items-end lg:col-span-2">
              <button type="submit" className="btn btn-primary w-full">
                حفظ المصروف
              </button>
            </div>
          </ConfirmForm>
        </AddPanel>
      </Suspense>

      <Suspense fallback={null}>
        <AddPanel label="إضافة بند مصروف" paramKey="addCat">
          <ConfirmForm
            message="هل أنت متأكد من حفظ البند؟"
            action={createCategory}
            className="panel flex flex-wrap gap-3 items-end"
          >
            <div className="field grow min-w-[200px]">
              <label>اسم البند</label>
              <input name="name" required placeholder="مثال: نظافة" />
            </div>
            <button type="submit" className="btn btn-primary">
              حفظ البند
            </button>
          </ConfirmForm>
        </AddPanel>
      </Suspense>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>البند</th>
              <th>الفترة</th>
              <th>ملاحظة</th>
              <th>المبلغ</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{e.category.name}</td>
                <td>
                  {MONTH_NAMES[e.month - 1]} {e.year}
                </td>
                <td className="text-[var(--muted)]">{e.note || "—"}</td>
                <td className="tabular-nums font-semibold text-[var(--bad)]">
                  {formatMoney(e.amount)}
                </td>
                <td className="no-print">
                  <div className="flex flex-wrap items-center gap-1">
                    <EditToggle title="تعديل المصروف">
                      <ConfirmForm
                        message="هل أنت متأكد من حفظ التعديل؟"
                        action={updateExpense}
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        <input type="hidden" name="id" value={e.id} />
                        <div className="field sm:col-span-2">
                          <label>البند</label>
                          <select
                            name="categoryId"
                            required
                            defaultValue={e.categoryId}
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>السنة</label>
                          <input
                            name="year"
                            type="number"
                            required
                            defaultValue={e.year}
                          />
                        </div>
                        <div className="field">
                          <label>الشهر</label>
                          <select name="month" defaultValue={e.month}>
                            {MONTH_NAMES.map((m, i) => (
                              <option key={m} value={i + 1}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>المبلغ</label>
                          <input
                            name="amount"
                            type="number"
                            step="0.001"
                            required
                            defaultValue={e.amount}
                          />
                        </div>
                        <div className="field sm:col-span-2">
                          <label>ملاحظة</label>
                          <input name="note" defaultValue={e.note ?? ""} />
                        </div>
                        <div className="sm:col-span-2">
                          <button
                            type="submit"
                            className="btn btn-primary w-full"
                          >
                            حفظ التعديل
                          </button>
                        </div>
                      </ConfirmForm>
                    </EditToggle>
                    <ConfirmForm
                      message="هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع."
                      action={async () => {
                        "use server";
                        await deleteExpense(e.id);
                      }}
                    >
                      <button type="submit" className="btn btn-danger text-xs py-1">
                        حذف
                      </button>
                    </ConfirmForm>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="text-[var(--muted)]">
                  لا توجد مصاريف لهذه السنة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
